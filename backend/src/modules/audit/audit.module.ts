import { MiddlewareConsumer, Module, NestModule, RequestMethod } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AccessAudit, AccessAuditSchema } from "./access-audit.schema";
import { AccessAuditMiddleware } from "./access-audit.middleware";

@Module({
  imports: [MongooseModule.forFeature([{ name: AccessAudit.name, schema: AccessAuditSchema }])],
  providers: [AccessAuditMiddleware],
  exports: [AccessAuditMiddleware],
})
export class AuditModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(AccessAuditMiddleware).forRoutes({ path: "*", method: RequestMethod.ALL });
  }
}
