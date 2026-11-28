import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ParseObjectIdPipe } from "../../common/parse-object-id.pipe";
import { Roles } from "../../common/roles.decorator";
import { RolesGuard } from "../../common/roles.guard";
import { JwtAuthGuard } from "../auth/auth.guard";
import { UserRole } from "../auth/user.schema";
import { CreateRestaurantDto } from "./platform.dto";
import { PlatformService } from "./platform.service";

@ApiTags("Platform administration")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
@Controller("platform")
export class PlatformController {
  constructor(private readonly platform: PlatformService) {}

  @Get("overview")
  overview() {
    return this.platform.overview();
  }

  @Get("restaurants")
  listRestaurants() {
    return this.platform.listRestaurants();
  }

  @Post("restaurants")
  createRestaurant(@Body() dto: CreateRestaurantDto) {
    return this.platform.createRestaurant(dto);
  }

  @Get("users")
  listUsers() {
    return this.platform.listUsers();
  }

  @Get("access-audits")
  listAccessAudits() {
    return this.platform.listAccessAudits();
  }

  @Post("users/:id/invite")
  inviteUser(@Param("id", ParseObjectIdPipe) id: string) {
    return this.platform.inviteUser(id);
  }
}
