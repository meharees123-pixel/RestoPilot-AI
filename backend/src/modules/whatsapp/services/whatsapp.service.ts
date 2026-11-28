import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";
import { createHmac, timingSafeEqual } from "node:crypto";
import {
  ExtractedWhatsappMessage,
  WhatsappDebugTestDto,
  WhatsappWebhookDto,
} from "../dto/whatsapp-webhook.dto";
import { WhatsappConfigService } from "../config/whatsapp.config";
import { WhatsappMessageRepository } from "../repositories/whatsapp-message.repository";
import { WhatsappMessageStatus } from "../schemas/whatsapp-message.schema";

const AUTO_REPLY = "Welcome to RestoPilot AI 🚀";
const META_API_VERSION = "v23.0";

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(
    private readonly messages: WhatsappMessageRepository,
    private readonly http: HttpService,
    private readonly config: WhatsappConfigService,
  ) {}

  logVerificationQuery(query: Record<string, string>): void {
    const safeQuery = { ...query };
    if (safeQuery["hub.verify_token"]) {
      const maskedToken = this.maskToken(safeQuery["hub.verify_token"]);
      if (maskedToken) {
        safeQuery["hub.verify_token"] = maskedToken;
      }
    }
    this.log("whatsapp.webhook.verification_request", {
      label: "[VERIFICATION REQUEST]",
      receivedQuery: safeQuery,
      mode: query["hub.mode"] ?? null,
      verifyToken: this.maskToken(query["hub.verify_token"]),
      challenge: query["hub.challenge"] ?? null,
    });
  }

  verifyWebhook(mode: string | undefined, challenge: string | undefined, verifyToken: string | undefined): string {
    const verifyTokenMatches = this.tokensMatch(verifyToken, this.config.verifyToken);
    this.log("whatsapp.webhook.verification_check", {
      mode: mode ?? null,
      verifyTokenProvided: Boolean(verifyToken),
      verifyTokenMatches,
      challenge: challenge ?? null,
    });
    if (
      mode !== "subscribe" ||
      typeof challenge !== "string" ||
      challenge.length === 0 ||
      !verifyTokenMatches
    ) {
      this.log("whatsapp.webhook.verification_failed", {
        mode: mode ?? null,
        verifyTokenMatches,
      });
      throw new ForbiddenException("WhatsApp webhook verification failed");
    }

    this.log("whatsapp.webhook.verified", {});
    return challenge;
  }

  verifyRequestSignature(rawBody: Buffer | undefined, signature: string | undefined): void {
    if (this.config.signatureBypassEnabled) {
      this.log("whatsapp.webhook.signature_bypassed", {
        reason: "WHATSAPP_DEBUG_BYPASS_SIGNATURE is enabled",
      });
      return;
    }

    if (!this.config.appSecret) {
      this.log("whatsapp.webhook.signature_skipped", {
        reason: "WHATSAPP_APP_SECRET is not configured",
      });
      return;
    }

    if (!rawBody || !signature || !/^sha256=[a-f\d]{64}$/i.test(signature)) {
      this.log("whatsapp.webhook.signature_failed", {});
      throw new UnauthorizedException("Invalid WhatsApp webhook signature");
    }

    const received = Buffer.from(signature.slice("sha256=".length), "hex");
    const expected = createHmac("sha256", this.config.appSecret).update(rawBody).digest();
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
      this.log("whatsapp.webhook.signature_failed", {});
      throw new UnauthorizedException("Invalid WhatsApp webhook signature");
    }
  }

  async processIncomingWebhook(payload: WhatsappWebhookDto): Promise<void> {
    this.log("whatsapp.webhook.processing_started", {
      label: "PROCESSING WEBHOOK",
      timestamp: new Date().toISOString(),
    });
    const extracted = this.extractMessages(payload);
    const messageIds = extracted.map((message) => message.messageId);
    const phoneNumberIds = [...new Set(
      extracted.map((message) => message.phoneNumberId).filter((value): value is string => Boolean(value)),
    )];
    this.log("whatsapp.webhook.processing", {
      messageCount: extracted.length,
      messageIds,
      phoneNumberIds,
    });

    if (extracted.length === 0) {
      this.log("whatsapp.webhook.received", { label: "[WEBHOOK RECEIVED]", messageCount: 0 });
      this.log("whatsapp.webhook.no_incoming_messages", {});
      return;
    }

    for (const message of extracted) {
      this.log("whatsapp.message.received", {
        label: "[MESSAGE RECEIVED]",
        messageId: message.messageId,
        fromPhone: this.maskPhone(message.fromPhone),
        messageType: message.messageType,
        timestamp: message.timestamp.toISOString(),
        phoneNumberId: message.phoneNumberId ?? null,
      });
      if (this.config.debugLogging) {
        this.log("whatsapp.message.body_debug", {
          label: "[MESSAGE BODY]",
          body: message.messageText ?? null,
        });
        this.log("whatsapp.message.text_debug", {
          label: "[MESSAGE TEXT]",
          text: message.messageText ?? null,
        });
        this.log("whatsapp.message.id_debug", {
          label: "[MESSAGE ID]",
          messageId: message.messageId,
        });
        this.log("whatsapp.message.sender_debug", {
          label: "[SENDER PHONE]",
          senderPhone: message.fromPhone,
        });
        this.log("whatsapp.message.phone_number_id_debug", {
          label: "[PHONE NUMBER ID]",
          phoneNumberId: message.phoneNumberId ?? null,
        });
      }

      if (await this.messages.exists(message.messageId)) {
        this.log("whatsapp.message.duplicate_skipped", { messageId: message.messageId });
        continue;
      }

      const saved = await this.messages.saveMessage({
        messageId: message.messageId,
        fromPhone: message.fromPhone,
        messageTimestamp: message.timestamp,
        messageType: message.messageType,
        messageText: message.messageText,
        payload: { object: payload.object, entry: payload.entry },
      });

      if (!saved) {
        this.log("whatsapp.message.duplicate_skipped", { messageId: message.messageId });
        continue;
      }

      this.log("whatsapp.message.stored", {
        label: "[MESSAGE SAVED]",
        messageId: message.messageId,
      });
      if (message.messageText) {
        await this.sendAutoReply(message);
      }
    }
  }

  extractMessages(payload: WhatsappWebhookDto): ExtractedWhatsappMessage[] {
    if (
      !this.isRecord(payload) ||
      payload.object !== "whatsapp_business_account" ||
      !Array.isArray(payload.entry) ||
      payload.entry.length === 0
    ) {
      throw new BadRequestException("Invalid WhatsApp webhook payload");
    }

    const messages: ExtractedWhatsappMessage[] = [];
    for (const entry of payload.entry) {
      if (!this.isRecord(entry) || !Array.isArray(entry.changes)) {
        throw new BadRequestException("Invalid WhatsApp webhook entry");
      }

      for (const change of entry.changes) {
        if (!this.isRecord(change) || typeof change.field !== "string" || !this.isRecord(change.value)) {
          throw new BadRequestException("Invalid WhatsApp webhook change");
        }
        if (change.field !== "messages") {
          continue;
        }

        const incoming = change.value.messages;
        if (incoming === undefined) {
          continue;
        }
        if (!Array.isArray(incoming)) {
          throw new BadRequestException("Invalid WhatsApp messages collection");
        }

        for (const message of incoming) {
          messages.push({
            ...this.extractMessage(message),
            phoneNumberId: this.extractPhoneNumberId(change.value.metadata),
          });
        }
      }
    }
    return messages;
  }

  async sendTextMessage(to: string, text: string): Promise<void> {
    const url = `https://graph.facebook.com/${META_API_VERSION}/${encodeURIComponent(
      this.config.phoneNumberId,
    )}/messages`;
    await firstValueFrom(
      this.http.post(
        url,
        {
          messaging_product: "whatsapp",
          to: to.replace(/^\+/, ""),
          type: "text",
          text: { body: text },
        },
        {
          headers: {
            Authorization: `Bearer ${this.config.token}`,
            "Content-Type": "application/json",
          },
          timeout: 10_000,
        },
      ),
    );
  }

  getDiagnostics(): {
    webhookConfigured: boolean;
    accessTokenLoaded: boolean;
    verifyTokenLoaded: boolean;
    phoneNumberIdLoaded: boolean;
    appSecretConfigured: boolean;
    debugModeEnabled: boolean;
    signatureBypassEnabled: boolean;
    rawBodyConfigured: boolean;
  } {
    const accessTokenLoaded = Boolean(this.config.token);
    const verifyTokenLoaded = Boolean(this.config.verifyToken);
    const phoneNumberIdLoaded = Boolean(this.config.phoneNumberId);
    return {
      webhookConfigured: accessTokenLoaded && verifyTokenLoaded && phoneNumberIdLoaded,
      accessTokenLoaded,
      verifyTokenLoaded,
      phoneNumberIdLoaded,
      appSecretConfigured: Boolean(this.config.appSecret),
      debugModeEnabled: this.config.debugModeEnabled,
      signatureBypassEnabled: this.config.signatureBypassEnabled,
      rawBodyConfigured: true,
    };
  }

  logPostWebhookHit(payload: WhatsappWebhookDto): void {
    this.log("whatsapp.webhook.post_hit", {
      label: "POST WEBHOOK HIT",
      body: this.config.debugLogging ? payload : "[omitted]",
      timestamp: new Date().toISOString(),
    });
  }

  logDebugTest(payload: WhatsappDebugTestDto): { success: true; received: true } {
    if (this.config.isProduction) {
      throw new NotFoundException();
    }
    this.log("whatsapp.webhook.debug_test", {
      label: "[WEBHOOK TEST]",
      message: payload.message,
    });
    return { success: true, received: true };
  }

  logWebhookError(error: unknown, stage: string): void {
    this.log(
      "whatsapp.webhook.error",
      {
        label: "[ERROR]",
        stage,
        error: this.describeHttpError(error),
      },
      true,
    );
  }

  private extractPhoneNumberId(metadata: unknown): string | undefined {
    if (!this.isRecord(metadata) || typeof metadata.phone_number_id !== "string") {
      return undefined;
    }
    return metadata.phone_number_id;
  }

  private extractMessage(value: unknown): ExtractedWhatsappMessage {
    if (
      !this.isRecord(value) ||
      typeof value.id !== "string" ||
      value.id.length === 0 ||
      value.id.length > 256 ||
      typeof value.from !== "string" ||
      !/^\+?\d{5,20}$/.test(value.from) ||
      typeof value.timestamp !== "string" ||
      !/^\d{1,12}$/.test(value.timestamp) ||
      typeof value.type !== "string" ||
      value.type.length === 0 ||
      value.type.length > 32
    ) {
      throw new BadRequestException("Invalid WhatsApp message");
    }

    const seconds = Number(value.timestamp);
    const timestamp = new Date(seconds * 1000);
    if (!Number.isSafeInteger(seconds) || !Number.isFinite(timestamp.getTime())) {
      throw new BadRequestException("Invalid WhatsApp message timestamp");
    }

    let messageText: string | undefined;
    if (value.type === "text") {
      if (!this.isRecord(value.text) || typeof value.text.body !== "string") {
        throw new BadRequestException("Text message is missing its body");
      }
      if (value.text.body.length > 4096) {
        throw new BadRequestException("WhatsApp text message exceeds the supported length");
      }
      messageText = value.text.body;
    }

    return {
      messageId: value.id,
      fromPhone: value.from,
      timestamp,
      messageType: value.type,
      messageText,
    };
  }

  private async sendAutoReply(message: ExtractedWhatsappMessage): Promise<void> {
    try {
      await this.sendTextMessage(message.fromPhone, AUTO_REPLY);
    } catch (error) {
      await this.messages.updateStatus(message.messageId, WhatsappMessageStatus.REPLY_FAILED);
      this.log("whatsapp.reply.failed", {
        label: "[ERROR]",
        messageId: message.messageId,
        error: this.describeHttpError(error),
      }, true);
      return;
    }

    await this.messages.updateStatus(message.messageId, WhatsappMessageStatus.REPLIED);
    this.log("whatsapp.reply.sent", {
      label: "[AUTO REPLY SENT]",
      messageId: message.messageId,
    });
  }

  private tokensMatch(candidate: string | undefined, expected: string): boolean {
    if (typeof candidate !== "string") {
      return false;
    }
    const candidateBytes = Buffer.from(candidate);
    const expectedBytes = Buffer.from(expected);
    return candidateBytes.length === expectedBytes.length && timingSafeEqual(candidateBytes, expectedBytes);
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  private maskPhone(phone: string): string {
    return `***${phone.slice(-4)}`;
  }

  private maskToken(token: string | undefined): string | null {
    if (!token) {
      return null;
    }
    return `***${token.slice(-4)}`;
  }

  private describeHttpError(error: unknown): string {
    if (this.isRecord(error) && typeof error.message === "string") {
      return error.message.slice(0, 200);
    }
    return "Unknown WhatsApp API error";
  }

  private log(event: string, fields: Record<string, unknown>, isError = false): void {
    const record = JSON.stringify({ event, ...fields });
    if (isError) {
      this.logger.error(record);
      return;
    }
    this.logger.log(record);
  }
}
