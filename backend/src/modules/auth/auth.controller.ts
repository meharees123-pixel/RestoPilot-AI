import { Body, Controller, HttpCode, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiNoContentResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { AuthenticatedRequest, JwtAuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";
import { LoginDto, RefreshTokenDto, RequestOtpDto, VerifyOtpDto } from "./auth.dto";

@ApiTags("Authentication")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("login")
  @ApiOkResponse({ description: "Authenticates a super administrator with password and MFA" })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password, dto.mfaCode);
  }

  @Post("request-otp")
  @HttpCode(200)
  @ApiOkResponse({ description: "Requests a WhatsApp verification code" })
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.auth.requestOtp(dto.phoneNumber);
  }

  @Post("verify-otp")
  @HttpCode(200)
  @ApiOkResponse({ description: "Verifies a WhatsApp code and returns a user session" })
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.auth.verifyOtp(dto.phoneNumber, dto.otp);
  }

  @Post("refresh")
  @ApiOkResponse({ description: "Rotates the refresh token and returns a new session" })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post("logout")
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiNoContentResponse({ description: "Revokes the stored refresh token" })
  async logout(@Req() request: AuthenticatedRequest): Promise<void> {
    await this.auth.logout(request.user.sub);
  }
}
