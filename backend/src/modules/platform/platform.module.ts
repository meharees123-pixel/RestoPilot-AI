import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AuthModule } from "../auth/auth.module";
import { RolesGuard } from "../../common/roles.guard";
import { Restaurant, RestaurantSchema } from "../tenant/schemas/restaurant.schema";
import { User, UserSchema } from "../auth/user.schema";
import { AccessAudit, AccessAuditSchema } from "../audit/access-audit.schema";
import { PlatformController } from "./platform.controller";
import { PlatformService } from "./platform.service";

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: Restaurant.name, schema: RestaurantSchema },
      { name: User.name, schema: UserSchema },
      { name: AccessAudit.name, schema: AccessAuditSchema },
    ]),
  ],
  controllers: [PlatformController],
  providers: [PlatformService, RolesGuard],
})
export class PlatformModule {}
