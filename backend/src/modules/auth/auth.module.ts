import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { MongooseModule } from "@nestjs/mongoose";
import { TenantModule } from "../tenant/tenant.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./auth.guard";
import { User, UserSchema } from "./user.schema";
import { OtpChallenge, OtpChallengeSchema } from "./otp-challenge.schema";

@Module({
  imports: [
    TenantModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: OtpChallenge.name, schema: OtpChallengeSchema },
    ]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>("JWT_SECRET");
        if (!secret || secret.length < 32) {
          throw new Error("JWT_SECRET must contain at least 32 characters");
        }
        const refreshSecret = config.get<string>("JWT_REFRESH_SECRET");
        if (!refreshSecret || refreshSecret.length < 32 || refreshSecret === secret) {
          throw new Error("JWT_REFRESH_SECRET must be a different secret of at least 32 characters");
        }
        return {
          secret,
          signOptions: {
            expiresIn: "15m",
            issuer: "foodflow-ai",
            audience: "foodflow-api",
          },
          verifyOptions: {
            issuer: "foodflow-ai",
            audience: "foodflow-api",
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard],
  exports: [JwtModule, JwtAuthGuard, AuthService],
})
export class AuthModule {}
