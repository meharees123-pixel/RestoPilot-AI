import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class WhatsappConfigService {
  private readonly logger = new Logger(WhatsappConfigService.name);
  readonly token: string;
  readonly phoneNumberId: string;
  readonly verifyToken: string;
  readonly appSecret?: string;
  readonly debugLogging: boolean;
  readonly signatureBypassEnabled: boolean;
  readonly debugModeEnabled: boolean;
  readonly webhookUrl: string;
  readonly isProduction: boolean;

  constructor(config: ConfigService) {
    this.token = this.requireValue(config, "WHATSAPP_TOKEN");
    this.phoneNumberId = this.requireValue(config, "WHATSAPP_PHONE_NUMBER_ID");
    this.verifyToken = this.requireValue(config, "WHATSAPP_VERIFY_TOKEN");
    const appSecret = config.get<string>("WHATSAPP_APP_SECRET")?.trim();
    this.appSecret = appSecret && appSecret !== "replace-me" ? appSecret : undefined;
    this.isProduction = config.get<string>("NODE_ENV") === "production";
    const debugSetting = config.get<string>("WHATSAPP_DEBUG_LOGGING");
    this.debugLogging =
      debugSetting === undefined
        ? !this.isProduction
        : debugSetting.trim().toLowerCase() === "true";
    this.signatureBypassEnabled =
      config.get<string>("WHATSAPP_DEBUG_BYPASS_SIGNATURE")?.trim().toLowerCase() === "true";
    this.debugModeEnabled = this.debugLogging || this.signatureBypassEnabled;
    const publicWebhookUrl = config.get<string>("WHATSAPP_WEBHOOK_URL")?.trim();
    const port = config.get<string>("PORT")?.trim() || "3000";
    this.webhookUrl =
      publicWebhookUrl || `http://localhost:${port}/api/v1/webhooks/whatsapp`;

    if (this.isProduction && !this.appSecret) {
      throw new Error("WHATSAPP_APP_SECRET must be configured in production");
    }
    if (this.isProduction && this.signatureBypassEnabled) {
      throw new Error("WHATSAPP_DEBUG_BYPASS_SIGNATURE cannot be enabled in production");
    }

    this.logger.log(
      JSON.stringify({
        event: "whatsapp.startup.configuration",
        webhookUrl: this.webhookUrl,
        "WHATSAPP_VERIFY_TOKEN loaded": Boolean(this.verifyToken),
        "WHATSAPP_TOKEN loaded": Boolean(this.token),
        "WHATSAPP_PHONE_NUMBER_ID loaded": Boolean(this.phoneNumberId),
        "WHATSAPP_APP_SECRET configured": Boolean(this.appSecret),
        debugModeEnabled: this.debugModeEnabled,
        signatureBypassEnabled: this.signatureBypassEnabled,
        rawBodyConfigured: true,
      }),
    );
  }

  private requireValue(config: ConfigService, key: string): string {
    const value = config.get<string>(key)?.trim();
    if (!value || value === "replace-me") {
      throw new Error(`${key} must be configured`);
    }
    return value;
  }
}
