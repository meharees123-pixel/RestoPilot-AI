import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/mongoose";
import { JwtService } from "@nestjs/jwt";
import { compare } from "bcryptjs";
import { createHash } from "node:crypto";
import { Model } from "mongoose";
import { Restaurant, RestaurantDocument, RestaurantStatus } from "../tenant/schemas/restaurant.schema";
import { User, UserDocument } from "./user.schema";

export interface AccessTokenClaims {
  sub: string;
  role: User["role"];
  restaurantId: string | null;
  branchIds: string[];
}

interface RefreshTokenClaims extends AccessTokenClaims {
  tokenType: "refresh";
}

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    @InjectModel(Restaurant.name) private readonly restaurants: Model<RestaurantDocument>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(
    email: string,
    password: string,
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    const user = await this.users.findOne({ email: email.toLowerCase(), isActive: true })
      .select("+passwordHash");
    if (!user || !(await compare(password, user.passwordHash))) {
      throw new UnauthorizedException("Invalid email or password");
    }

    if (user.restaurantId) {
      const restaurant = await this.restaurants.findById(user.restaurantId).select("status");
      if (!restaurant || restaurant.status !== RestaurantStatus.ACTIVE) {
        throw new UnauthorizedException("Restaurant account is inactive");
      }
    }

    return this.issueTokens(user);
  }

  async refresh(
    token: string,
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
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
    const user = await this.users.findOne({
      _id: claims.sub,
      isActive: true,
      refreshTokenHash: oldHash,
    }).select("+refreshTokenHash");
    if (!user) throw new UnauthorizedException("Refresh token has already been used or revoked");
    await this.assertRestaurantActive(user);

    return this.issueTokens(user, oldHash);
  }

  async logout(userId: string): Promise<void> {
    await this.users.updateOne(
      { _id: userId },
      { $unset: { refreshTokenHash: 1 } },
    );
  }

  private async issueTokens(
    user: UserDocument,
    expectedRefreshHash?: string,
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
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
    return { accessToken, refreshToken, expiresIn: 900 };
  }

  private async assertRestaurantActive(user: UserDocument): Promise<void> {
    if (!user.restaurantId) return;
    const restaurant = await this.restaurants.findById(user.restaurantId).select("status");
    if (!restaurant || restaurant.status !== RestaurantStatus.ACTIVE) {
      throw new UnauthorizedException("Restaurant account is inactive");
    }
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
}
