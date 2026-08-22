import { Module } from "@nestjs/common";
import { HealthController } from "./health/health.controller.js";
import { LinksController } from "./links/links.controller.js";
import { LinksService } from "./links/links.service.js";
import { PublicRedirectController } from "./redirect/public-redirect.controller.js";
import { PublicRedirectService } from "./redirect/public-redirect.service.js";

@Module({
  controllers: [HealthController, LinksController, PublicRedirectController],
  providers: [LinksService, PublicRedirectService],
})
export class AppModule {}
