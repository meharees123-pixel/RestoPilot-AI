import {
  Allow,
  ArrayMinSize,
  Equals,
  IsArray,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

export class WhatsappWebhookDto {
  @IsString()
  @Equals("whatsapp_business_account")
  object!: string;

  @IsArray()
  @ArrayMinSize(1)
  @Allow()
  entry!: unknown[];
}

export class WhatsappDebugTestDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4096)
  message!: string;
}

export interface ExtractedWhatsappMessage {
  messageId: string;
  fromPhone: string;
  timestamp: Date;
  messageType: string;
  messageText?: string;
  phoneNumberId?: string;
}
