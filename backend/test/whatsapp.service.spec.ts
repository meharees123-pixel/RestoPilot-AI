import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { createHmac } from "node:crypto";
import { of, throwError } from "rxjs";
import { WhatsappConfigService } from "../src/modules/whatsapp/config/whatsapp.config";
import { WhatsappWebhookDto } from "../src/modules/whatsapp/dto/whatsapp-webhook.dto";
import { WhatsappMessageRepository } from "../src/modules/whatsapp/repositories/whatsapp-message.repository";
import { WhatsappMessageStatus } from "../src/modules/whatsapp/schemas/whatsapp-message.schema";
import { WhatsappService } from "../src/modules/whatsapp/services/whatsapp.service";

describe("WhatsappService", () => {
  const incomingMessage = {
    from: "97455112233",
    id: "wamid.test-message-id",
    timestamp: "1764261977",
    type: "text",
    text: { body: "hello" },
  };

  function webhook(message: unknown = incomingMessage): WhatsappWebhookDto {
    return {
      object: "whatsapp_business_account",
      entry: [
        {
          changes: [
            {
              field: "messages",
              value: {
                metadata: { phone_number_id: "123456789" },
                messages: [message],
              },
            },
          ],
        },
      ],
    };
  }

  function setup(overrides?: {
    exists?: boolean;
    post?: jest.Mock;
  }) {
    const repository = {
      exists: jest.fn().mockResolvedValue(overrides?.exists ?? false),
      saveMessage: jest.fn().mockResolvedValue({ messageId: incomingMessage.id }),
      updateStatus: jest.fn().mockResolvedValue(undefined),
    };
    const http = {
      post: overrides?.post ?? jest.fn().mockReturnValue(of({ status: 200, data: {} })),
    };
    const config = {
      token: "test-access-token",
      phoneNumberId: "123456789",
      verifyToken: "test-verify-token",
      debugLogging: false,
      signatureBypassEnabled: false,
      debugModeEnabled: false,
      isProduction: false,
    };

    return {
      repository,
      http,
      service: new WhatsappService(
        repository as unknown as WhatsappMessageRepository,
        http as unknown as HttpService,
        config as WhatsappConfigService,
      ),
    };
  }

  it("verifies Meta webhook challenge and rejects an incorrect token", () => {
    const { service } = setup();
    expect(service.verifyWebhook("subscribe", "challenge-123", "test-verify-token")).toBe(
      "challenge-123",
    );
    expect(() => service.verifyWebhook("subscribe", "challenge-123", "wrong-token")).toThrow(
      ForbiddenException,
    );
    expect(service.getDiagnostics()).toEqual({
      webhookConfigured: true,
      accessTokenLoaded: true,
      verifyTokenLoaded: true,
      phoneNumberIdLoaded: true,
      appSecretConfigured: false,
      debugModeEnabled: false,
      signatureBypassEnabled: false,
      rawBodyConfigured: true,
    });
    expect(service.extractMessages(webhook())[0].phoneNumberId).toBe("123456789");
  });

  it("verifies Meta's request signature against the raw request body", () => {
    const appSecret = "whatsapp-app-secret";
    const rawBody = Buffer.from('{"object":"whatsapp_business_account"}');
    const signature = `sha256=${createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
    const { service } = setup();
    const signedService = new WhatsappService(
      {} as WhatsappMessageRepository,
      {} as HttpService,
      {
        token: "test-access-token",
        phoneNumberId: "123456789",
        verifyToken: "test-verify-token",
        appSecret,
      } as WhatsappConfigService,
    );

    expect(() => signedService.verifyRequestSignature(rawBody, signature)).not.toThrow();
    expect(() => signedService.verifyRequestSignature(rawBody, "sha256=invalid")).toThrow(
      "Invalid WhatsApp webhook signature",
    );
    expect(() => service.verifyRequestSignature(rawBody, undefined)).not.toThrow();

    const bypassService = new WhatsappService(
      {} as WhatsappMessageRepository,
      {} as HttpService,
      {
        token: "test-access-token",
        phoneNumberId: "123456789",
        verifyToken: "test-verify-token",
        signatureBypassEnabled: true,
      } as WhatsappConfigService,
    );
    expect(() => bypassService.verifyRequestSignature(undefined, undefined)).not.toThrow();
  });

  it("persists a new inbound message and sends the configured auto reply", async () => {
    const { repository, http, service } = setup();

    await service.processIncomingWebhook(webhook());

    expect(repository.saveMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        messageId: incomingMessage.id,
        fromPhone: incomingMessage.from,
        messageType: "text",
        messageText: "hello",
        payload: expect.objectContaining({ object: "whatsapp_business_account" }),
      }),
    );
    expect(http.post).toHaveBeenCalledWith(
      "https://graph.facebook.com/v23.0/123456789/messages",
      {
        messaging_product: "whatsapp",
        to: incomingMessage.from,
        type: "text",
        text: { body: "Welcome to RestoPilot AI 🚀" },
      },
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer test-access-token" }),
      }),
    );
    expect(repository.updateStatus).toHaveBeenCalledWith(
      incomingMessage.id,
      WhatsappMessageStatus.REPLIED,
    );
  });

  it("does not store or reply to a duplicate webhook message", async () => {
    const { repository, http, service } = setup({ exists: true });

    await service.processIncomingWebhook(webhook());

    expect(repository.saveMessage).not.toHaveBeenCalled();
    expect(http.post).not.toHaveBeenCalled();
  });

  it("records Meta send failures without causing webhook retries", async () => {
    const post = jest.fn().mockReturnValue(
      throwError(() => new Error("Meta API unavailable")),
    );
    const { repository, service } = setup({ post });

    await expect(service.processIncomingWebhook(webhook())).resolves.toBeUndefined();
    expect(repository.updateStatus).toHaveBeenCalledWith(
      incomingMessage.id,
      WhatsappMessageStatus.REPLY_FAILED,
    );
  });

  it("accepts status-only notifications and rejects malformed messages", () => {
    const { service } = setup();
    const statusPayload: WhatsappWebhookDto = {
      object: "whatsapp_business_account",
      entry: [{ changes: [{ field: "messages", value: { statuses: [] } }] }],
    };

    expect(service.extractMessages(statusPayload)).toEqual([]);
    expect(() => service.extractMessages(webhook({ id: "missing-from" }))).toThrow(
      BadRequestException,
    );
  });
});
