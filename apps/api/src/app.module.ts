import { Module } from "@nestjs/common";
import { AnalyticsCaptureService } from "./analytics/analytics-capture.service.js";
import { AnalyticsOverviewController } from "./analytics/analytics-overview.controller.js";
import { AnalyticsOverviewService } from "./analytics/analytics-overview.service.js";
import { AccountDeletionController } from "./auth/account-deletion.controller.js";
import { AccountDeletionService } from "./auth/account-deletion.service.js";
import { WorkspaceCreationRateLimiter } from "./auth/workspace-creation-rate-limiter.js";
import { WorkspaceInvitationController } from "./auth/workspace-invitation.controller.js";
import { WorkspaceInvitationService } from "./auth/workspace-invitation.service.js";
import { WorkspaceLifecycleController } from "./auth/workspace-lifecycle.controller.js";
import { WorkspaceLifecycleService } from "./auth/workspace-lifecycle.service.js";
import { WorkspaceMembershipController } from "./auth/workspace-membership.controller.js";
import { WorkspaceMembershipService } from "./auth/workspace-membership.service.js";
import { HealthController } from "./health/health.controller.js";
import { LinksController } from "./links/links.controller.js";
import { LinksService } from "./links/links.service.js";
import { PublicRedirectController } from "./redirect/public-redirect.controller.js";
import { PublicRedirectService } from "./redirect/public-redirect.service.js";

@Module({
  controllers: [
    AccountDeletionController,
    AnalyticsOverviewController,
    HealthController,
    LinksController,
    PublicRedirectController,
    WorkspaceInvitationController,
    WorkspaceLifecycleController,
    WorkspaceMembershipController,
  ],
  providers: [
    AccountDeletionService,
    AnalyticsCaptureService,
    AnalyticsOverviewService,
    LinksService,
    PublicRedirectService,
    WorkspaceInvitationService,
    WorkspaceCreationRateLimiter,
    WorkspaceLifecycleService,
    WorkspaceMembershipService,
  ],
})
export class AppModule {}
