import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Post,
  Query,
  RawBodyRequest,
  Req,
  Res,
  UseFilters,
} from "@nestjs/common";
import {
  ApiBody,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { Request, Response } from "express";
import {
  WhatsappDebugTestDto,
  WhatsappWebhookDto,
} from "../dto/whatsapp-webhook.dto";
import { WhatsappWebhookExceptionFilter } from "../filters/whatsapp-webhook-exception.filter";
import { WhatsappService } from "../services/whatsapp.service";

@ApiTags("WhatsApp Webhooks")
@UseFilters(WhatsappWebhookExceptionFilter)
@Controller("webhooks/whatsapp")
export class WhatsappController {
  constructor(private readonly whatsapp: WhatsappService) {}

  @Get()
  @ApiOperation({ summary: "Verify the WhatsApp webhook subscription with Meta" })
  @ApiQuery({ name: "hub.mode", required: true, example: "subscribe" })
  @ApiQuery({ name: "hub.challenge", required: true, example: "123456789" })
  @ApiQuery({ name: "hub.verify_token", required: true, example: "configured-verification-token" })
  @ApiOkResponse({ description: "Returns the supplied hub.challenge as plain text" })
  verify(
    @Query() query: Record<string, string>,
    @Res() response: Response,
  ): void {
    this.whatsapp.logVerificationQuery(query);
    const result = this.whatsapp.verifyWebhook(
      query["hub.mode"],
      query["hub.challenge"],
      query["hub.verify_token"],
    );
    response.status(200).type("text/plain").send(result);
  }

  @Get("debug")
  @ApiOperation({ summary: "Check WhatsApp webhook configuration status" })
  @ApiOkResponse({
    schema: {
      type: "object",
      properties: {
        webhookConfigured: { type: "boolean" },
        accessTokenLoaded: { type: "boolean" },
        verifyTokenLoaded: { type: "boolean" },
        phoneNumberIdLoaded: { type: "boolean" },
        appSecretConfigured: { type: "boolean" },
        debugModeEnabled: { type: "boolean" },
        signatureBypassEnabled: { type: "boolean" },
        rawBodyConfigured: { type: "boolean" },
      },
    },
  })
  debug() {
    return this.whatsapp.getDiagnostics();
  }

  @Post()
  @HttpCode(200)
  @Header("Content-Type", "text/plain")
  @ApiOperation({ summary: "Receive WhatsApp messages and send the welcome auto-reply" })
  @ApiHeader({
    name: "X-Hub-Signature-256",
    required: false,
    description: "Meta request signature; required when WHATSAPP_APP_SECRET is configured",
  })
  @ApiBody({
    schema: {
      type: "object",
      required: ["object", "entry"],
      properties: {
        object: { type: "string", enum: ["whatsapp_business_account"] },
        entry: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: true,
          },
        },
      },
      example: {
        object: "whatsapp_business_account",
        entry: [
          {
            id: "WHATSAPP_BUSINESS_ACCOUNT_ID",
            changes: [
              {
                field: "messages",
                value: {
                  messaging_product: "whatsapp",
                  metadata: { phone_number_id: "PHONE_NUMBER_ID" },
                  messages: [
                    {
                      from: "97455112233",
                      id: "wamid.example",
                      timestamp: "1764261977",
                      type: "text",
                      text: { body: "hello" },
                    },
                  ],
                },
              },
            ],
          },
        ],
      },
    },
  })
  @ApiOkResponse({
    description: "Webhook event acknowledged",
    schema: { type: "string", example: "EVENT_RECEIVED" },
  })
  async receive(
    @Body() payload: WhatsappWebhookDto,
    @Req() request: RawBodyRequest<Request>,
  ): Promise<string> {
    this.whatsapp.logPostWebhookHit(payload);
    this.whatsapp.verifyRequestSignature(
      request.rawBody,
      request.header("x-hub-signature-256"),
    );
    await this.whatsapp.processIncomingWebhook(payload);
    return "EVENT_RECEIVED";
  }

  @Post("test")
  @HttpCode(200)
  @ApiOperation({ summary: "Log a local webhook test payload (disabled in production)" })
  @ApiBody({ type: WhatsappDebugTestDto })
  @ApiOkResponse({
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean" },
        received: { type: "boolean" },
      },
    },
  })
  debugTest(@Body() payload: WhatsappDebugTestDto): { success: true; received: true } {
    return this.whatsapp.logDebugTest(payload);
  }
}
