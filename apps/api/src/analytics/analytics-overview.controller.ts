import { Controller, Get, Inject, Param, Req, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { auth } from "../auth/auth.js";
import { AnalyticsOverviewService } from "./analytics-overview.service.js";

@Controller("api/organizations/:organizationId/analytics")
export class AnalyticsOverviewController {
  constructor(
    @Inject(AnalyticsOverviewService)
    private readonly analyticsOverviewService: AnalyticsOverviewService,
  ) {}

  @Get()
  async getOverview(@Param("organizationId") organizationId: string, @Req() request: Request) {
    const session = await auth.api.getSession({ headers: toHeaders(request.headers) });
    if (!session) throw new UnauthorizedException();

    return this.analyticsOverviewService.getOverview({ organizationId, userId: session.user.id });
  }
}

function toHeaders(headers: Request["headers"]): Headers {
  const result = new Headers();
  for (const [name, value] of Object.entries(headers)) {
    if (typeof value === "string") result.set(name, value);
    else if (Array.isArray(value)) result.set(name, value.join(", "));
  }
  return result;
}
