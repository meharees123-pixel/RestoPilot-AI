import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ParseObjectIdPipe } from "../../common/parse-object-id.pipe";
import { Roles } from "../../common/roles.decorator";
import { RolesGuard } from "../../common/roles.guard";
import { TenantContextGuard } from "../../common/tenant-context.guard";
import { AuthenticatedRequest, JwtAuthGuard } from "../auth/auth.guard";
import { UserRole } from "../auth/user.schema";
import { CreateCategoryDto, CreateMenuItemDto, UpdateAvailabilityDto } from "./menu.dto";
import { MenuService } from "./menu.service";

@ApiTags("Menu")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantContextGuard, RolesGuard)
@Controller("menu")
export class MenuController {
  constructor(private readonly menu: MenuService) {}

  @Get("categories")
  @Roles(UserRole.RESTAURANT_OWNER, UserRole.RESTAURANT_MANAGER, UserRole.BRANCH_MANAGER)
  listCategories(@Req() request: AuthenticatedRequest) {
    return this.menu.listCategories(request.user.restaurantId!);
  }

  @Post("categories")
  @Roles(UserRole.RESTAURANT_OWNER, UserRole.RESTAURANT_MANAGER)
  createCategory(@Req() request: AuthenticatedRequest, @Body() dto: CreateCategoryDto) {
    return this.menu.createCategory(request.user.restaurantId!, dto);
  }

  @Get("items")
  @Roles(UserRole.RESTAURANT_OWNER, UserRole.RESTAURANT_MANAGER, UserRole.BRANCH_MANAGER)
  listItems(@Req() request: AuthenticatedRequest, @Query("branchId") branchId?: string) {
    return this.menu.listItems(request.user, branchId);
  }

  @Post("items")
  @Roles(UserRole.RESTAURANT_OWNER, UserRole.RESTAURANT_MANAGER, UserRole.BRANCH_MANAGER)
  createItem(@Req() request: AuthenticatedRequest, @Body() dto: CreateMenuItemDto) {
    return this.menu.createItem(request.user, dto);
  }

  @Patch("items/:id/availability")
  @Roles(UserRole.RESTAURANT_OWNER, UserRole.RESTAURANT_MANAGER, UserRole.BRANCH_MANAGER)
  setAvailability(
    @Req() request: AuthenticatedRequest,
    @Param("id", ParseObjectIdPipe) id: string,
    @Body() dto: UpdateAvailabilityDto,
  ) {
    return this.menu.setAvailability(request.user, id, dto.isAvailable);
  }
}
