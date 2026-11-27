import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AuthModule } from "../auth/auth.module";
import { RolesGuard } from "../../common/roles.guard";
import { TenantContextGuard } from "../../common/tenant-context.guard";
import { CustomerController } from "./customer.controller";
import { CustomerService } from "./customer.service";
import { Customer, CustomerSchema } from "./customer.schema";

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([{ name: Customer.name, schema: CustomerSchema }]),
  ],
  controllers: [CustomerController],
  providers: [CustomerService, RolesGuard, TenantContextGuard],
  exports: [MongooseModule],
})
export class CustomerModule {}
