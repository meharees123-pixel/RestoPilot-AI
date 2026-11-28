import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ParseObjectIdPipe } from "../../common/parse-object-id.pipe";
import { Roles } from "../../common/roles.decorator";
import { RolesGuard } from "../../common/roles.guard";
import { TenantContextGuard } from "../../common/tenant-context.guard";
import { AuthenticatedRequest, JwtAuthGuard } from "../auth/auth.guard";
import { UserRole } from "../auth/user.schema";
import { CreateOrderDto, UpdateOrderStatusDto } from "./order.dto";
import { OrderService } from "./order.service";

@ApiTags("Orders")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantContextGuard, RolesGuard)
@Controller("orders")
@Roles(UserRole.RESTAURANT_OWNER, UserRole.RESTAURANT_MANAGER, UserRole.BRANCH_MANAGER)
export class OrderController {
  constructor(private readonly orders: OrderService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.orders.list(request.user);
  }

  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreateOrderDto) {
    return this.orders.create(request.user, dto);
  }

  @Patch(":id/status")
  updateStatus(
    @Req() request: AuthenticatedRequest,
    @Param("id", ParseObjectIdPipe) id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.orders.updateStatus(request.user, id, dto.status);
  }
}
