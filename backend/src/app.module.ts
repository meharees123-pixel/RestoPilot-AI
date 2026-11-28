import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { AuthModule } from "./modules/auth/auth.module";
import { BranchModule } from "./modules/branch/branch.module";
import { HealthModule } from "./modules/health/health.module";
import { MenuModule } from "./modules/menu/menu.module";
import { CustomerModule } from "./modules/customer/customer.module";
import { OrderModule } from "./modules/order/order.module";
import { TenantModule } from "./modules/tenant/tenant.module";
import { PlatformModule } from "./modules/platform/platform.module";
import { AuditModule } from "./modules/audit/audit.module";
import { WhatsappModule } from "./modules/whatsapp/whatsapp.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ["../.env", ".env"] }),
    MongooseModule.forRootAsync({
      useFactory: () => {
        const uri = process.env.MONGODB_URI;
        if (!uri) {
          throw new Error("MONGODB_URI must be configured");
        }
        return {
          uri,
          dbName: process.env.MONGODB_DATABASE || "RestoPilot",
          autoIndex: process.env.NODE_ENV !== "production",
        };
      },
    }),
    AuthModule,
    HealthModule,
    TenantModule,
    BranchModule,
    MenuModule,
    CustomerModule,
    OrderModule,
    PlatformModule,
    AuditModule,
    WhatsappModule,
  ],
})
export class AppModule {}
