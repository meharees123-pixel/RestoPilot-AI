import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { InjectConnection } from "@nestjs/mongoose";
import { Connection, STATES } from "mongoose";

@ApiTags("Health")
@Controller("health")
export class HealthController {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  @Get()
  @ApiOkResponse({ description: "API health status" })
  health(): { status: "ok"; service: "foodflow-ai"; database: "connected" } {
    if (this.connection.readyState !== STATES.connected) {
      throw new ServiceUnavailableException("Database connection is unavailable");
    }

    return { status: "ok", service: "foodflow-ai", database: "connected" };
  }
}
