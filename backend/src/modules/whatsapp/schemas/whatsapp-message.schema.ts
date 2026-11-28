import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Schema as MongooseSchema } from "mongoose";

export enum WhatsappMessageStatus {
  RECEIVED = "RECEIVED",
  REPLIED = "REPLIED",
  REPLY_FAILED = "REPLY_FAILED",
}

export type WhatsappMessageDocument = HydratedDocument<WhatsappMessage>;

@Schema({ timestamps: true, collection: "whatsapp_messages" })
export class WhatsappMessage {
  @Prop({ required: true, trim: true })
  messageId!: string;

  @Prop({ required: true, trim: true })
  fromPhone!: string;

  @Prop({ required: true })
  messageTimestamp!: Date;

  @Prop({ required: true, trim: true, maxlength: 32 })
  messageType!: string;

  @Prop({ trim: true, maxlength: 4096 })
  messageText?: string;

  @Prop({ required: true, type: MongooseSchema.Types.Mixed })
  payload!: Record<string, unknown>;

  @Prop({
    required: true,
    enum: Object.values(WhatsappMessageStatus),
    default: WhatsappMessageStatus.RECEIVED,
  })
  status!: WhatsappMessageStatus;
}

export const WhatsappMessageSchema = SchemaFactory.createForClass(WhatsappMessage);
WhatsappMessageSchema.index({ messageId: 1 }, { unique: true });
WhatsappMessageSchema.index({ fromPhone: 1, createdAt: -1 });
