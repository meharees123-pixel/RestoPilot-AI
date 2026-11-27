import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AuthModule } from "../auth/auth.module";
import { RolesGuard } from "../../common/roles.guard";
import { TenantContextGuard } from "../../common/tenant-context.guard";
import { Branch, BranchSchema } from "../branch/schemas/branch.schema";
import { Category, CategorySchema } from "./schemas/category.schema";
import { MenuItem, MenuItemSchema } from "./schemas/menu-item.schema";
import { MenuController } from "./menu.controller";
import { MenuService } from "./menu.service";

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: Branch.name, schema: BranchSchema },
      { name: Category.name, schema: CategorySchema },
      { name: MenuItem.name, schema: MenuItemSchema },
    ]),
  ],
  controllers: [MenuController],
  providers: [MenuService, RolesGuard, TenantContextGuard],
  exports: [MongooseModule],
})
export class MenuModule {}
