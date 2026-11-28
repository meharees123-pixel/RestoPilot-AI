import { HttpModule } from "@nestjs/axios";
import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { WhatsappConfigService } from "./config/whatsapp.config";
import { WhatsappController } from "./controllers/whatsapp.controller";
import { WhatsappDebugMiddleware } from "./middleware/whatsapp-debug.middleware";
import { WhatsappWebhookExceptionFilter } from "./filters/whatsapp-webhook-exception.filter";
import { WhatsappMessageRepository } from "./repositories/whatsapp-message.repository";
import { WhatsappMessage, WhatsappMessageSchema } from "./schemas/whatsapp-message.schema";
import { WhatsappService } from "./services/whatsapp.service";

@Module({
  imports: [
    ConfigModule,
    HttpModule,
    MongooseModule.forFeature([{ name: WhatsappMessage.name, schema: WhatsappMessageSchema }]),
  ],
  controllers: [WhatsappController],
  providers: [
    WhatsappService,
    WhatsappMessageRepository,
    WhatsappConfigService,
    WhatsappDebugMiddleware,
    WhatsappWebhookExceptionFilter,
  ],
  exports: [WhatsappService],
})
export class WhatsappModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(WhatsappDebugMiddleware).forRoutes(WhatsappController);
  }
}
