import { Module } from "@nestjs/common";
import { AnalyticsCaptureService } from "./analytics/analytics-capture.service.js";
import { AnalyticsOverviewController } from "./analytics/analytics-overview.controller.js";
import { AnalyticsOverviewService } from "./analytics/analytics-overview.service.js";
import { HealthController } from "./health/health.controller.js";
import { LinksController } from "./links/links.controller.js";
import { LinksService } from "./links/links.service.js";
import { PublicRedirectController } from "./redirect/public-redirect.controller.js";
import { PublicRedirectService } from "./redirect/public-redirect.service.js";

@Module({
  controllers: [
    AnalyticsOverviewController,
    HealthController,
    LinksController,
    PublicRedirectController,
  ],
  providers: [
    AnalyticsCaptureService,
    AnalyticsOverviewService,
    LinksService,
    PublicRedirectService,
  ],
})
export class AppModule {}
