import { Controller, Get } from "@nestjs/common";
import type { HealthStatus, ReadinessStatus } from "@short-it/contracts";
import { prisma } from "../database.js";

@Controller("api")
export class HealthController {
  @Get("health")
  health(): HealthStatus {
    return {
      status: "ok",
      service: "short-it-api",
    };
  }

  @Get("ready")
  async ready(): Promise<ReadinessStatus> {
    await prisma.$queryRaw`SELECT 1`;

    return {
      status: "ok",
      service: "short-it-api",
      database: "ready",
    };
  }
}
