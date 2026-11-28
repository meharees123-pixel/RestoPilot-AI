import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { hash } from "bcryptjs";
import { createHmac } from "node:crypto";
import { Model, Types } from "mongoose";
import { RestaurantDocument, RestaurantStatus } from "../src/modules/tenant/schemas/restaurant.schema";
import { AuthService } from "../src/modules/auth/auth.service";
import { OtpChallengeDocument } from "../src/modules/auth/otp-challenge.schema";
import { UserDocument, UserRole, UserStatus } from "../src/modules/auth/user.schema";

describe("AuthService", () => {
  const phoneNumber = "+97455112233";
  const restaurantId = new Types.ObjectId();

  function createService(overrides?: {
    users?: Partial<Model<UserDocument>>;
    restaurants?: Partial<Model<RestaurantDocument>>;
    challenges?: Partial<Model<OtpChallengeDocument>>;
    jwt?: Partial<JwtService>;
    config?: Partial<ConfigService>;
  }): AuthService {
    return new AuthService(
      (overrides?.users ?? {}) as Model<UserDocument>,
      (overrides?.restaurants ?? {}) as Model<RestaurantDocument>,
      (overrides?.challenges ?? {}) as Model<OtpChallengeDocument>,
      (overrides?.jwt ?? {}) as JwtService,
      (overrides?.config ?? {}) as ConfigService,
    );
  }

  it("restricts email/password login to active super administrators", async () => {
    const select = jest.fn().mockResolvedValue(null);
    const findOne = jest.fn().mockReturnValue({ select });
    const service = createService({ users: { findOne } });

    await expect(service.login("owner@example.com", "some-long-password", "123456"))
      .rejects.toThrow("Invalid email or password");
    expect(findOne).toHaveBeenCalledWith({
      email: "owner@example.com",
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
    });
  });

  it("stores an OTP hash and sends the one-time code through a WhatsApp template", async () => {
    const updateChallenge = jest.fn().mockResolvedValue({});
    const findUser = jest.fn().mockResolvedValue({
      role: UserRole.RESTAURANT_OWNER,
      status: UserStatus.INVITED,
      restaurantId,
    });
    const findRestaurant = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue({ status: RestaurantStatus.ACTIVE }),
    });
    const fetch = jest.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true } as Response);
    const service = createService({
      users: { findOne: findUser },
      restaurants: { findById: findRestaurant },
      challenges: {
        findOne: jest.fn().mockResolvedValue(null),
        findOneAndUpdate: updateChallenge,
      },
      config: {
        get: jest.fn((key: string) => ({
          JWT_SECRET: "a-valid-development-secret-with-at-least-32-characters",
          WHATSAPP_TOKEN: "test-token",
          WHATSAPP_PHONE_NUMBER_ID: "123456",
        })[key]),
      },
    });

    try {
      const result = await service.requestOtp(phoneNumber);
      const update = updateChallenge.mock.calls[0][1];
      const requestBody = JSON.parse(String(fetch.mock.calls[0][1]?.body));
      const code = requestBody.template.components[0].parameters[0].text as string;

      expect(result.message).toContain("If this number is invited");
      expect(requestBody.to).toBe(phoneNumber.slice(1));
      expect(code).toMatch(/^\d{6}$/);
      expect(update.$set.otpHash).toMatch(/^[a-f\d]{64}$/);
      expect(update.$set.otpHash).not.toBe(code);
      expect(update.$set.expiresAt.getTime()).toBeGreaterThan(Date.now() + 4 * 60 * 1000);
      expect(update.$set.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 5 * 60 * 1000);
    } finally {
      fetch.mockRestore();
    }
  });

  it("requires and accepts a valid time-based MFA code for super-admin login", async () => {
    const secret = "JBSWY3DPEHPK3PXP";
    const passwordHash = await hash("test-password", 4);
    const user = {
      id: new Types.ObjectId().toString(),
      _id: new Types.ObjectId(),
      firstName: "Platform",
      lastName: "Admin",
      phoneNumber,
      email: "admin@example.com",
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      restaurantId: null,
      branchIds: [],
      passwordHash,
      mfaSecret: secret,
      save: jest.fn().mockResolvedValue(undefined),
    };
    const select = jest.fn().mockResolvedValue(user);
    const signAsync = jest.fn().mockResolvedValueOnce("access-token").mockResolvedValueOnce("refresh-token");
    const service = createService({
      users: {
        findOne: jest.fn().mockReturnValue({ select }),
        updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      },
      jwt: { signAsync },
      config: {
        get: jest.fn((key: string) =>
          key === "JWT_REFRESH_SECRET" ? "another-distinct-secret-with-at-least-32-characters" : undefined,
        ),
      },
    });
    let bits = 0;
    let value = 0;
    const keyBytes: number[] = [];
    for (const character of secret) {
      value = (value << 5) | "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".indexOf(character);
      bits += 5;
      if (bits >= 8) {
        keyBytes.push((value >>> (bits - 8)) & 0xff);
        bits -= 8;
      }
    }
    const key = Buffer.from(keyBytes);
    const counter = Buffer.alloc(8);
    counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
    const digest = createHmac("sha1", key).update(counter).digest();
    const offset = digest[digest.length - 1] & 0x0f;
    const totp = (
      (((digest[offset] & 0x7f) << 24) |
        ((digest[offset + 1] & 0xff) << 16) |
        ((digest[offset + 2] & 0xff) << 8) |
        (digest[offset + 3] & 0xff)) %
      1_000_000
    ).toString().padStart(6, "0");

    const result = await service.login("admin@example.com", "test-password", totp);
    expect(result.user.role).toBe(UserRole.SUPER_ADMIN);
    expect(user.save).toHaveBeenCalled();
  });

  it("rejects a wrong verification code and increments its attempt counter", async () => {
    const updateOne = jest.fn().mockResolvedValue({});
    const challenge = {
      _id: new Types.ObjectId(),
      otpHash: "0".repeat(64),
      expiresAt: new Date(Date.now() + 60_000),
      attempts: 0,
    };
    const select = jest.fn().mockResolvedValue(challenge);
    const service = createService({
      challenges: { findOne: jest.fn().mockReturnValue({ select }), updateOne },
      config: { get: jest.fn(() => "a-valid-development-secret-with-at-least-32-characters") },
    });

    await expect(service.verifyOtp(phoneNumber, "123456")).rejects.toThrow(
      "Invalid or expired verification code",
    );
    expect(updateOne).toHaveBeenCalledWith(
      { _id: challenge._id, attempts: { $lt: 5 } },
      { $inc: { attempts: 1 } },
    );
  });
});
