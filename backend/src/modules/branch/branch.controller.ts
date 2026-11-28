import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthenticatedRequest, JwtAuthGuard } from "../auth/auth.guard";
import { Roles } from "../../common/roles.decorator";
import { RolesGuard } from "../../common/roles.guard";
import { TenantContextGuard } from "../../common/tenant-context.guard";
import { ParseObjectIdPipe } from "../../common/parse-object-id.pipe";
import { UserRole } from "../auth/user.schema";
import { CreateBranchDto, UpdateBranchStatusDto } from "./branch.dto";
import { BranchService } from "./branch.service";

@ApiTags("Branches")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantContextGuard, RolesGuard)
@Controller("branches")
export class BranchController {
  constructor(private readonly branches: BranchService) {}

  @Get()
  @Roles(UserRole.RESTAURANT_OWNER, UserRole.RESTAURANT_MANAGER, UserRole.BRANCH_MANAGER)
  list(@Req() request: AuthenticatedRequest) {
    return this.branches.list(request.user);
  }

  @Post()
  @Roles(UserRole.RESTAURANT_OWNER, UserRole.RESTAURANT_MANAGER)
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreateBranchDto) {
    return this.branches.create(request.user, dto);
  }

  @Patch(":id/status")
  @Roles(UserRole.RESTAURANT_OWNER, UserRole.RESTAURANT_MANAGER, UserRole.BRANCH_MANAGER)
  updateStatus(
    @Req() request: AuthenticatedRequest,
    @Param("id", ParseObjectIdPipe) id: string,
    @Body() dto: UpdateBranchStatusDto,
  ) {
    return this.branches.updateStatus(request.user, id, dto.status);
  }
}
