import { BadRequestException, ConflictException, Injectable } from "@nestjs/common";
import { prisma } from "../database.js";
import { runWorkspaceLifecycleTransaction } from "./workspace-lifecycle-transaction.js";

type AccountDeletionDatabase = Pick<typeof prisma, "$transaction">;
type AccountDeletionDependencies = {
  afterRead?: () => Promise<void>;
  database: AccountDeletionDatabase;
};

type AccountDeletionInput = {
  confirmationEmail: unknown;
  email: string;
  requestId?: string;
  userId: string;
};

@Injectable()
export class AccountDeletionService {
  private dependencies: AccountDeletionDependencies = { database: prisma };

  static forTesting(overrides: Partial<AccountDeletionDependencies>): AccountDeletionService {
    const service = new AccountDeletionService();
    service.dependencies = { ...service.dependencies, ...overrides };
    return service;
  }

  async delete(input: AccountDeletionInput): Promise<void> {
    if (input.confirmationEmail !== input.email) {
      throw new BadRequestException("Enter your account email to confirm deletion.");
    }

    await runWorkspaceLifecycleTransaction(
      this.dependencies.database,
      async (transaction) => {
        const memberships = await transaction.member.findMany({
          select: { role: true },
          where: { userId: input.userId },
        });
        if (memberships.some((membership) => hasOwnerRole(membership.role))) {
          throw new ConflictException(
            "Delete or transfer every workspace you own before deleting your account.",
          );
        }
        await this.dependencies.afterRead?.();

        await transaction.user.delete({ where: { id: input.userId } });
      },
      { requestId: input.requestId },
    );
  }
}

function hasOwnerRole(role: string): boolean {
  return role.split(",").some((assignedRole) => assignedRole.trim() === "owner");
}
