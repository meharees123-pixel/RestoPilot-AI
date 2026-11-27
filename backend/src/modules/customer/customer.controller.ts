import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Roles } from "../../common/roles.decorator";
import { RolesGuard } from "../../common/roles.guard";
import { TenantContextGuard } from "../../common/tenant-context.guard";
import { AuthenticatedRequest, JwtAuthGuard } from "../auth/auth.guard";
import { UserRole } from "../auth/user.schema";
import { CreateCustomerDto } from "./customer.dto";
import { CustomerService } from "./customer.service";

@ApiTags("Customers")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantContextGuard, RolesGuard)
@Controller("customers")
@Roles(UserRole.OWNER, UserRole.MANAGER)
export class CustomerController {
  constructor(private readonly customers: CustomerService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.customers.list(request.user.restaurantId!);
  }

  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreateCustomerDto) {
    return this.customers.create(request.user.restaurantId!, dto);
  }
}
