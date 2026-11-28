import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  WhatsappMessage,
  WhatsappMessageDocument,
  WhatsappMessageStatus,
} from "../schemas/whatsapp-message.schema";

@Injectable()
export class WhatsappMessageRepository {
  constructor(
    @InjectModel(WhatsappMessage.name)
    private readonly messageModel: Model<WhatsappMessageDocument>,
  ) {}

  async saveMessage(
    message: Pick<
      WhatsappMessage,
      | "messageId"
      | "fromPhone"
      | "messageTimestamp"
      | "messageType"
      | "messageText"
      | "payload"
    >,
  ): Promise<WhatsappMessageDocument | null> {
    try {
      return await this.messageModel.create(message);
    } catch (error) {
      if (this.isDuplicateKeyError(error)) {
        return null;
      }
      throw error;
    }
  }

  findByMessageId(messageId: string): Promise<WhatsappMessageDocument | null> {
    return this.messageModel.findOne({ messageId }).exec();
  }

  async exists(messageId: string): Promise<boolean> {
    return (await this.messageModel.exists({ messageId })) !== null;
  }

  async updateStatus(messageId: string, status: WhatsappMessageStatus): Promise<void> {
    const result = await this.messageModel.updateOne({ messageId }, { $set: { status } }).exec();
    if (result.matchedCount !== 1) {
      throw new Error(`WhatsApp message ${messageId} was not found while updating its status`);
    }
  }

  private isDuplicateKeyError(error: unknown): error is { code: number } {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    );
  }
}
