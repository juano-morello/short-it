import { Module } from "@nestjs/common";
import { AnalyticsCaptureService } from "./analytics/analytics-capture.service.js";
import { AnalyticsOverviewController } from "./analytics/analytics-overview.controller.js";
import { AnalyticsOverviewService } from "./analytics/analytics-overview.service.js";
import { WorkspaceInvitationController } from "./auth/workspace-invitation.controller.js";
import { WorkspaceInvitationService } from "./auth/workspace-invitation.service.js";
import { WorkspaceMembershipController } from "./auth/workspace-membership.controller.js";
import { WorkspaceMembershipService } from "./auth/workspace-membership.service.js";
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
    WorkspaceInvitationController,
    WorkspaceMembershipController,
  ],
  providers: [
    AnalyticsCaptureService,
    AnalyticsOverviewService,
    LinksService,
    PublicRedirectService,
    WorkspaceInvitationService,
    WorkspaceMembershipService,
  ],
})
export class AppModule {}
