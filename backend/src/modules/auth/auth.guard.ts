import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Request } from "express";
import { AccessTokenClaims } from "./auth.service";
import { UserRole } from "./user.schema";

export interface AuthenticatedRequest extends Request {
  user: AccessTokenClaims;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [scheme, token] = request.headers.authorization?.split(" ") ?? [];
    if (scheme !== "Bearer" || !token) {
      throw new UnauthorizedException("Bearer access token is required");
    }

    try {
      request.user = await this.jwt.verifyAsync<AccessTokenClaims>(token);
    } catch {
      throw new UnauthorizedException("Invalid or expired access token");
    }

    const businessUser = [
      UserRole.RESTAURANT_OWNER,
      UserRole.RESTAURANT_MANAGER,
      UserRole.BRANCH_MANAGER,
    ].includes(request.user.role);
    if (
      !request.user.sub ||
      !Object.values(UserRole).includes(request.user.role) ||
      !Array.isArray(request.user.branchIds) ||
      (businessUser && !request.user.restaurantId) ||
      (request.user.role === UserRole.SUPER_ADMIN && request.user.restaurantId !== null)
    ) {
      throw new UnauthorizedException("Invalid access token claims");
    }
    return true;
  }
}
