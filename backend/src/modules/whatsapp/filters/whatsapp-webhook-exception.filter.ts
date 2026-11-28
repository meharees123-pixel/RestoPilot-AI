import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from "@nestjs/common";
import { Request, Response } from "express";
import { WhatsappService } from "../services/whatsapp.service";

@Catch()
export class WhatsappWebhookExceptionFilter implements ExceptionFilter {
  constructor(private readonly whatsapp: WhatsappService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();
    const statusCode = exception instanceof HttpException ? exception.getStatus() : 500;
    const errorBody =
      exception instanceof HttpException
        ? exception.getResponse()
        : { statusCode, message: "Internal server error" };

    this.whatsapp.logWebhookError(exception, `${request.method} ${request.path}`);
    response.status(statusCode).send(errorBody);
  }
}
