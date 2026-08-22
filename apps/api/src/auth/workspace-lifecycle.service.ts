import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { prisma } from "../database.js";
import { getDisplayNameError } from "./display-name.js";
import { getWorkspaceHandleError } from "./workspace-handle.js";
import { runWorkspaceLifecycleTransaction } from "./workspace-lifecycle-transaction.js";

type WorkspaceLifecycleDatabase = Pick<typeof prisma, "$transaction">;

@Injectable()
export class WorkspaceLifecycleService {
  private database: WorkspaceLifecycleDatabase = prisma;

  static forTesting(overrides: Partial<{ database: WorkspaceLifecycleDatabase }>) {
    const service = new WorkspaceLifecycleService();
    Object.assign(service, overrides);
    return service;
  }

  async create(input: { name: unknown; slug: unknown; userId: string }) {
    const name = assertWorkspaceName(input.name);
    const slug = assertWorkspaceHandle(input.slug);

    try {
      return await runWorkspaceLifecycleTransaction(this.database, async (transaction) => {
        const user = await transaction.user.findUnique({
          select: { id: true },
          where: { id: input.userId },
        });
        if (!user) throw new UnauthorizedException();

        const workspaceCount = await transaction.member.count({ where: { userId: input.userId } });
        if (workspaceCount >= 3) {
          throw new ConflictException("You have reached the maximum number of workspaces.");
        }

        const organization = await transaction.organization.create({
          data: { id: randomUUID(), name, slug },
        });
        const member = await transaction.member.create({
          data: {
            id: randomUUID(),
            organizationId: organization.id,
            role: "owner",
            userId: input.userId,
          },
        });

        return { ...organization, members: [member] };
      });
    } catch (error) {
      if (isOrganizationSlugConflict(error)) {
        throw new BadRequestException("Organization already exists");
      }
      throw error;
    }
  }
}

function assertWorkspaceName(value: unknown): string {
  if (typeof value !== "string") {
    throw new BadRequestException("Workspace names must contain 1 to 120 characters.");
  }
  const name = value;
  const error = getDisplayNameError(name, "Workspace");
  if (error) throw new BadRequestException(error);
  return name;
}

function assertWorkspaceHandle(value: unknown): string {
  if (typeof value !== "string") {
    throw new BadRequestException(
      "Workspace handles use 3 to 30 lowercase letters, digits, and internal hyphens.",
    );
  }
  const slug = value;
  const error = getWorkspaceHandleError(slug);
  if (error) throw new BadRequestException(error);
  return slug;
}

function isOrganizationSlugConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
