import { Module } from "@nestjs/common";
import { HealthController } from "./health/health.controller.js";
import { LinksController } from "./links/links.controller.js";
import { LinksService } from "./links/links.service.js";

@Module({
  controllers: [HealthController, LinksController],
  providers: [LinksService],
})
export class AppModule {}
