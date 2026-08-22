import {
  Controller,
  Delete,
  HttpCode,
  Inject,
  Param,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import { auth } from "./auth.js";
import { WorkspaceInvitationService } from "./workspace-invitation.service.js";

@Controller("api/organizations/:organizationId/invitations")
export class WorkspaceInvitationController {
  constructor(
    @Inject(WorkspaceInvitationService)
    private readonly workspaceInvitationService: WorkspaceInvitationService,
  ) {}

  @Delete(":invitationId")
  @HttpCode(204)
  async cancel(
    @Param("organizationId") organizationId: string,
    @Param("invitationId") invitationId: string,
    @Req() request: Request,
  ): Promise<void> {
    const session = await auth.api.getSession({ headers: toHeaders(request.headers) });
    if (!session) throw new UnauthorizedException();
    await this.workspaceInvitationService.cancelPendingInvitation({
      invitationId,
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
