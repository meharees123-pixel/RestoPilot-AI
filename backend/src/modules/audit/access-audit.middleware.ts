import { Injectable, Logger, NestMiddleware } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { NextFunction, Request, Response } from "express";
import { Model, Types } from "mongoose";
import { AccessAudit, AccessAuditDocument } from "./access-audit.schema";
import { AccessTokenClaims } from "../auth/auth.service";

interface RequestWithUser extends Request {
  user?: AccessTokenClaims;
}

@Injectable()
export class AccessAuditMiddleware implements NestMiddleware {
  private readonly logger = new Logger(AccessAuditMiddleware.name);

  constructor(
    @InjectModel(AccessAudit.name) private readonly audits: Model<AccessAuditDocument>,
  ) {}

  use(request: RequestWithUser, response: Response, next: NextFunction): void {
    response.once("finish", () => {
      void this.audits.create({
        userId: request.user?.sub ? new Types.ObjectId(request.user.sub) : null,
        restaurantId: request.user?.restaurantId
          ? new Types.ObjectId(request.user.restaurantId)
          : null,
        role: request.user?.role ?? null,
        method: request.method,
        path: request.route?.path ?? request.path,
        statusCode: response.statusCode,
        occurredAt: new Date(),
      }).catch((error: unknown) => {
        this.logger.error("Failed to persist API access audit", error);
      });
    });
    next();
  }
}
