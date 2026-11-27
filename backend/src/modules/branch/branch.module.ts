import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AuthModule } from "../auth/auth.module";
import { RolesGuard } from "../../common/roles.guard";
import { TenantContextGuard } from "../../common/tenant-context.guard";
import { BranchController } from "./branch.controller";
import { BranchService } from "./branch.service";
import { Branch, BranchSchema } from "./schemas/branch.schema";

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([{ name: Branch.name, schema: BranchSchema }]),
  ],
  controllers: [BranchController],
  providers: [BranchService, RolesGuard, TenantContextGuard],
  exports: [MongooseModule],
})
export class BranchModule {}
