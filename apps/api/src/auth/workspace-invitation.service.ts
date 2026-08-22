import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "../database.js";
import { canManageInvitations } from "./access-control.js";

type InvitationDatabase = Pick<typeof prisma, "invitation" | "member">;

@Injectable()
export class WorkspaceInvitationService {
  private database: InvitationDatabase = prisma;

  static forTesting(database: InvitationDatabase): WorkspaceInvitationService {
    const service = new WorkspaceInvitationService();
    service.database = database;
    return service;
  }

  async cancelPendingInvitation(input: {
    invitationId: string;
    organizationId: string;
    userId: string;
  }): Promise<void> {
    const membership = await this.database.member.findUnique({
      select: { role: true },
      where: {
        organizationId_userId: { organizationId: input.organizationId, userId: input.userId },
      },
    });
    if (!membership || !canManageInvitations(membership.role)) {
      throw new ForbiddenException();
    }

    const cancelled = await this.database.invitation.deleteMany({
      where: {
        expiresAt: { gt: new Date() },
        id: input.invitationId,
        organizationId: input.organizationId,
        status: "pending",
      },
    });
    if (cancelled.count !== 1) throw new NotFoundException("Invitation is no longer available.");
  }
}
