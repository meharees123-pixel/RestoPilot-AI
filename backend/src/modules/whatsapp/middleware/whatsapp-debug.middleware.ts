import { Injectable, Logger, NestMiddleware } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";
import { WhatsappConfigService } from "../config/whatsapp.config";

@Injectable()
export class WhatsappDebugMiddleware implements NestMiddleware {
  private readonly logger = new Logger(WhatsappDebugMiddleware.name);
  private readonly sensitiveHeaders = new Set([
    "authorization",
    "cookie",
    "set-cookie",
    "x-api-key",
    "x-hub-signature-256",
  ]);

  constructor(private readonly config: WhatsappConfigService) {}

  use(request: Request, _response: Response, next: NextFunction): void {
    const headers = Object.fromEntries(
      Object.entries(request.headers).map(([name, value]) => [
        name,
        this.sensitiveHeaders.has(name.toLowerCase()) ? "[REDACTED]" : value ?? null,
      ]),
    );
    const body = this.config.debugLogging
      ? this.serializeBody(request.body)
      : "[omitted; enable WHATSAPP_DEBUG_LOGGING outside production to include]";

    this.logger.log(
      JSON.stringify({
        event: "whatsapp.http.request",
        label: "[WEBHOOK RECEIVED]",
        timestamp: new Date().toISOString(),
        method: request.method,
        url: this.sanitizeUrl(request.originalUrl),
        headers,
        body,
      }),
    );
    next();
  }

  private sanitizeUrl(originalUrl: string): string {
    const url = new URL(originalUrl, "http://localhost");
    if (url.searchParams.has("hub.verify_token")) {
      url.searchParams.set("hub.verify_token", "[REDACTED]");
    }
    return `${url.pathname}${url.search}`;
  }

  private serializeBody(body: unknown): string | null {
    if (body === undefined) {
      return null;
    }
    const serialized = JSON.stringify(body) ?? String(body);
    return serialized.length > 12_000 ? `${serialized.slice(0, 12_000)}...[truncated]` : serialized;
  }
}
