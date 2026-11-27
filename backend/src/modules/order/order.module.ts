import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AuthModule } from "../auth/auth.module";
import { RolesGuard } from "../../common/roles.guard";
import { TenantContextGuard } from "../../common/tenant-context.guard";
import { Branch, BranchSchema } from "../branch/schemas/branch.schema";
import { Customer, CustomerSchema } from "../customer/customer.schema";
import { MenuItem, MenuItemSchema } from "../menu/schemas/menu-item.schema";
import { OrderController } from "./order.controller";
import { OrderService } from "./order.service";
import { Order, OrderSchema } from "./order.schema";
import { OrderCounter, OrderCounterSchema } from "./order-counter.schema";

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: OrderCounter.name, schema: OrderCounterSchema },
      { name: Branch.name, schema: BranchSchema },
      { name: Customer.name, schema: CustomerSchema },
      { name: MenuItem.name, schema: MenuItemSchema },
    ]),
  ],
  controllers: [OrderController],
  providers: [OrderService, RolesGuard, TenantContextGuard],
})
export class OrderModule {}
