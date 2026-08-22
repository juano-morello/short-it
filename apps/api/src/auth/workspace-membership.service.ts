import { ForbiddenException, Injectable } from "@nestjs/common";
import { prisma } from "../database.js";

type MembershipDatabase = Pick<typeof prisma, "member">;

@Injectable()
export class WorkspaceMembershipService {
  private database: MembershipDatabase = prisma;

  static forTesting(database: MembershipDatabase): WorkspaceMembershipService {
    const service = new WorkspaceMembershipService();
    service.database = database;
    return service;
  }

  async getMembership(input: {
    organizationId: string;
    userId: string;
  }): Promise<{ role: string }> {
    const membership = await this.database.member.findUnique({
      select: { role: true },
      where: {
        organizationId_userId: {
          organizationId: input.organizationId,
          userId: input.userId,
        },
      },
    });
    if (!membership) {
      throw new ForbiddenException("You do not have access to this workspace.");
    }
    return membership;
  }
}
