import {
  Injectable,
  HttpException,
  HttpStatus,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/mongoose";
import { JwtService } from "@nestjs/jwt";
import { compare } from "bcryptjs";
import { createHash, createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { Model } from "mongoose";
import { Restaurant, RestaurantDocument, RestaurantStatus } from "../tenant/schemas/restaurant.schema";
import { OtpChallenge, OtpChallengeDocument } from "./otp-challenge.schema";
import { User, UserDocument, UserRole, UserStatus } from "./user.schema";

export interface AccessTokenClaims {
  sub: string;
  role: UserRole;
  restaurantId: string | null;
  branchIds: string[];
}

interface RefreshTokenClaims extends AccessTokenClaims {
  tokenType: "refresh";
}

interface SessionUser {
  id: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  email: string | null;
  role: UserRole;
  restaurantId: string | null;
  branchIds: string[];
}

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: SessionUser;
}

const OTP_LIFETIME_MS = 5 * 60 * 1000;
const OTP_RESEND_DELAY_MS = 60 * 1000;
const OTP_WINDOW_MS = 60 * 60 * 1000;
const OTP_MAX_REQUESTS_PER_WINDOW = 5;
const OTP_MAX_ATTEMPTS = 5;

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    @InjectModel(Restaurant.name) private readonly restaurants: Model<RestaurantDocument>,
    @InjectModel(OtpChallenge.name) private readonly otpChallenges: Model<OtpChallengeDocument>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(email: string, password: string, mfaCode: string): Promise<SessionTokens> {
    const user = await this.users
      .findOne({ email: email.toLowerCase(), role: UserRole.SUPER_ADMIN, status: UserStatus.ACTIVE })
      .select("+passwordHash +mfaSecret");
    if (!user?.passwordHash || !(await compare(password, user.passwordHash))) {
      throw new UnauthorizedException("Invalid email or password");
    }
    if (!user.mfaSecret || !this.verifyTotp(user.mfaSecret, mfaCode)) {
      throw new UnauthorizedException("Invalid email, password or MFA code");
    }

    user.lastLoginAt = new Date();
    await user.save();
    return this.issueTokens(user);
  }

  async requestOtp(phoneNumber: string): Promise<{ message: string }> {
    const now = new Date();
    const previous = await this.otpChallenges.findOne({ phoneNumber });
    let requestWindowStartedAt = previous?.requestWindowStartedAt ?? now;
    let requestCount = previous?.requestCount ?? 0;

    if (previous && now.getTime() - previous.lastRequestedAt.getTime() < OTP_RESEND_DELAY_MS) {
      throw new HttpException("Please wait before requesting another code", HttpStatus.TOO_MANY_REQUESTS);
    }
    if (now.getTime() - requestWindowStartedAt.getTime() >= OTP_WINDOW_MS) {
      requestWindowStartedAt = now;
      requestCount = 0;
    }
    if (requestCount >= OTP_MAX_REQUESTS_PER_WINDOW) {
      throw new HttpException(
        "Too many verification code requests. Try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const otp = randomInt(0, 1_000_000).toString().padStart(6, "0");
    let updatedChallenge: OtpChallengeDocument | null;
    try {
      updatedChallenge = await this.otpChallenges.findOneAndUpdate(
        previous
          ? { phoneNumber, lastRequestedAt: previous.lastRequestedAt }
          : { phoneNumber },
        {
          $set: {
            otpHash: this.hashOtp(phoneNumber, otp),
            expiresAt: new Date(now.getTime() + OTP_LIFETIME_MS),
            attempts: 0,
            requestCount: requestCount + 1,
            requestWindowStartedAt,
            lastRequestedAt: now,
          },
          $setOnInsert: { phoneNumber },
        },
        previous
          ? { new: true }
          : { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    } catch (error) {
      if (this.isDuplicateKeyError(error)) {
        throw new HttpException(
          "Please wait before requesting another code",
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      throw error;
    }
    if (!updatedChallenge) {
      throw new HttpException(
        "Please wait before requesting another code",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const user = await this.users.findOne({
      phoneNumber,
      role: { $in: [UserRole.RESTAURANT_OWNER, UserRole.RESTAURANT_MANAGER, UserRole.BRANCH_MANAGER] },
      status: { $in: [UserStatus.ACTIVE, UserStatus.INVITED] },
    });
    if (user && await this.canAccessRestaurant(user)) {
      try {
        await this.sendOtpTemplate(phoneNumber, otp);
      } catch (error) {
        await this.otpChallenges.deleteOne({ phoneNumber });
        throw error;
      }
    }

    return { message: "If this number is invited to RestoPilot, a verification code will be sent." };
  }

  async verifyOtp(phoneNumber: string, otp: string): Promise<SessionTokens> {
    const challenge = await this.otpChallenges.findOne({ phoneNumber }).select("+otpHash");
    if (!challenge || challenge.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException("Invalid or expired verification code");
    }
    if (challenge.attempts >= OTP_MAX_ATTEMPTS) {
      await this.otpChallenges.deleteOne({ _id: challenge._id });
      throw new UnauthorizedException("Invalid or expired verification code");
    }

    const suppliedHash = this.hashOtp(phoneNumber, otp);
    if (!this.safeEqual(challenge.otpHash, suppliedHash)) {
      await this.otpChallenges.updateOne(
        { _id: challenge._id, attempts: { $lt: OTP_MAX_ATTEMPTS } },
        { $inc: { attempts: 1 } },
      );
      throw new UnauthorizedException("Invalid or expired verification code");
    }

    const consumed = await this.otpChallenges.deleteOne({
      _id: challenge._id,
      otpHash: challenge.otpHash,
    });
    if (!consumed.deletedCount) {
      throw new UnauthorizedException("Invalid or expired verification code");
    }

    const user = await this.users.findOne({
      phoneNumber,
      role: { $in: [UserRole.RESTAURANT_OWNER, UserRole.RESTAURANT_MANAGER, UserRole.BRANCH_MANAGER] },
      status: { $in: [UserStatus.ACTIVE, UserStatus.INVITED] },
    });
    if (!user || !(await this.canAccessRestaurant(user))) {
      throw new UnauthorizedException("Invalid or expired verification code");
    }

    user.status = UserStatus.ACTIVE;
    user.isWhatsappVerified = true;
    user.lastLoginAt = new Date();
    await user.save();
    return this.issueTokens(user);
  }

  async refresh(token: string): Promise<SessionTokens> {
    const secret = this.refreshSecret();
    let claims: RefreshTokenClaims;
    try {
      claims = await this.jwt.verifyAsync<RefreshTokenClaims>(token, {
        secret,
        issuer: "foodflow-ai",
        audience: "foodflow-api",
      });
    } catch {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }

    if (claims.tokenType !== "refresh" || !claims.sub) {
      throw new UnauthorizedException("Invalid refresh token claims");
    }

    const oldHash = this.hashToken(token);
    const user = await this.users
      .findOne({
        _id: claims.sub,
        status: UserStatus.ACTIVE,
        refreshTokenHash: oldHash,
      })
      .select("+refreshTokenHash");
    if (!user) throw new UnauthorizedException("Refresh token has already been used or revoked");
    if (!(await this.canAccessRestaurant(user))) {
      throw new UnauthorizedException("Restaurant account is inactive");
    }

    return this.issueTokens(user, oldHash);
  }

  async logout(userId: string): Promise<void> {
    await this.users.updateOne({ _id: userId }, { $unset: { refreshTokenHash: 1 } });
  }

  private async issueTokens(user: UserDocument, expectedRefreshHash?: string): Promise<SessionTokens> {
    const claims: AccessTokenClaims = {
      sub: user.id,
      role: user.role,
      restaurantId: user.restaurantId?.toString() ?? null,
      branchIds: user.branchIds.map((id) => id.toString()),
    };
    const accessToken = await this.jwt.signAsync(claims);
    const refreshToken = await this.jwt.signAsync(
      { ...claims, tokenType: "refresh" },
      {
        secret: this.refreshSecret(),
        expiresIn: "30d",
        issuer: "foodflow-ai",
        audience: "foodflow-api",
      },
    );

    const nextHash = this.hashToken(refreshToken);
    const filter = expectedRefreshHash
      ? { _id: user._id, refreshTokenHash: expectedRefreshHash }
      : { _id: user._id };
    const result = await this.users.updateOne(filter, { $set: { refreshTokenHash: nextHash } });
    if (!result.modifiedCount) {
      throw new UnauthorizedException("Refresh token has already been used or revoked");
    }

    return {
      accessToken,
      refreshToken,
      expiresIn: 900,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        phoneNumber: user.phoneNumber,
        email: user.email ?? null,
        role: user.role,
        restaurantId: user.restaurantId?.toString() ?? null,
        branchIds: user.branchIds.map((id) => id.toString()),
      },
    };
  }

  private async canAccessRestaurant(user: UserDocument): Promise<boolean> {
    if (user.role === UserRole.SUPER_ADMIN) return true;
    if (!user.restaurantId) return false;
    const restaurant = await this.restaurants.findById(user.restaurantId).select("status");
    return restaurant?.status === RestaurantStatus.ACTIVE;
  }

  private async sendOtpTemplate(phoneNumber: string, otp: string): Promise<void> {
    const token = this.config.get<string>("WHATSAPP_TOKEN");
    const phoneNumberId = this.config.get<string>("WHATSAPP_PHONE_NUMBER_ID");
    if (!token || token === "replace-me" || !phoneNumberId || phoneNumberId === "replace-me") {
      throw new ServiceUnavailableException("WhatsApp OTP delivery is not configured");
    }

    const apiVersion = this.config.get<string>("WHATSAPP_API_VERSION") || "v21.0";
    const templateName = this.config.get<string>("WHATSAPP_OTP_TEMPLATE_NAME") || "restopilot_otp";
    const language = this.config.get<string>("WHATSAPP_OTP_TEMPLATE_LANGUAGE") || "en";
    let response: Response;
    try {
      response = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: phoneNumber.slice(1),
          type: "template",
          template: {
            name: templateName,
            language: { code: language },
            components: [
              {
                type: "body",
                parameters: [{ type: "text", text: otp }],
              },
            ],
          },
        }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new ServiceUnavailableException("WhatsApp could not deliver the verification code");
    }
    if (!response.ok) {
      throw new ServiceUnavailableException("WhatsApp could not deliver the verification code");
    }
  }

  private hashOtp(phoneNumber: string, otp: string): string {
    const secret = this.config.get<string>("OTP_HASH_SECRET") ?? this.config.get<string>("JWT_SECRET");
    if (!secret || secret.length < 32) throw new Error("OTP_HASH_SECRET or a valid JWT_SECRET is required");
    return createHmac("sha256", secret).update(`${phoneNumber}:${otp}`).digest("hex");
  }

  private safeEqual(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left, "hex");
    const rightBuffer = Buffer.from(right, "hex");
    return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
  }

  private verifyTotp(secret: string, code: string): boolean {
    const key = this.decodeBase32(secret);
    if (!key || !/^\d{6}$/.test(code)) return false;
    const currentCounter = Math.floor(Date.now() / 30_000);
    for (const offset of [-1, 0, 1]) {
      const counter = Buffer.alloc(8);
      counter.writeBigUInt64BE(BigInt(currentCounter + offset));
      const digest = createHmac("sha1", key).update(counter).digest();
      const index = digest[digest.length - 1] & 0x0f;
      const value =
        ((digest[index] & 0x7f) << 24) |
        ((digest[index + 1] & 0xff) << 16) |
        ((digest[index + 2] & 0xff) << 8) |
        (digest[index + 3] & 0xff);
      const expected = (value % 1_000_000).toString().padStart(6, "0");
      if (this.safeEqualText(code, expected)) return true;
    }
    return false;
  }

  private decodeBase32(secret: string): Buffer | null {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    const normalized = secret.replace(/[\s=-]/g, "").toUpperCase();
    let bits = 0;
    let value = 0;
    const bytes: number[] = [];
    for (const character of normalized) {
      const digit = alphabet.indexOf(character);
      if (digit < 0) return null;
      value = (value << 5) | digit;
      bits += 5;
      if (bits >= 8) {
        bytes.push((value >>> (bits - 8)) & 0xff);
        bits -= 8;
      }
    }
    return bytes.length >= 10 ? Buffer.from(bytes) : null;
  }

  private safeEqualText(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
  }

  private refreshSecret(): string {
    const secret = this.config.get<string>("JWT_REFRESH_SECRET");
    if (!secret || secret.length < 32) {
      throw new Error("JWT_REFRESH_SECRET must contain at least 32 characters");
    }
    return secret;
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private isDuplicateKeyError(error: unknown): boolean {
    return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
  }
}
