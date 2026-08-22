import { Controller, Get, Inject, Param, Req, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { auth } from "./auth.js";
import { WorkspaceMembershipService } from "./workspace-membership.service.js";

@Controller("api/organizations/:organizationId/membership")
export class WorkspaceMembershipController {
  constructor(
    @Inject(WorkspaceMembershipService)
    private readonly workspaceMembershipService: WorkspaceMembershipService,
  ) {}

  @Get()
  async getMembership(@Param("organizationId") organizationId: string, @Req() request: Request) {
    const session = await auth.api.getSession({ headers: toHeaders(request.headers) });
    if (!session) throw new UnauthorizedException();
    return this.workspaceMembershipService.getMembership({
      organizationId,
      userId: session.user.id,
    });
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
