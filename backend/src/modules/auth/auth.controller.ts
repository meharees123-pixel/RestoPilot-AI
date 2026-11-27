import { Body, Controller, HttpCode, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiNoContentResponse } from "@nestjs/swagger";
import { AuthenticatedRequest, JwtAuthGuard } from "./auth.guard";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import { LoginDto, RefreshTokenDto } from "./auth.dto";

@ApiTags("Authentication")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("login")
  @ApiOkResponse({ description: "Returns a short-lived access token" })
  login(@Body() dto: LoginDto): Promise<{ accessToken: string; expiresIn: number }> {
    return this.auth.login(dto.email, dto.password);
  }

  @Post("refresh")
  @ApiOkResponse({ description: "Rotates the refresh token and returns a new access token" })
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
