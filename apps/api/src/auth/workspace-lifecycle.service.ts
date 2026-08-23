import { randomUUID } from "node:crypto";
import { BadRequestException, ConflictException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { prisma } from "../database.js";
import { getDisplayNameError } from "./display-name.js";
import { getWorkspaceHandleError } from "./workspace-handle.js";
import { runWorkspaceLifecycleTransaction } from "./workspace-lifecycle-transaction.js";

type WorkspaceLifecycleDatabase = Pick<typeof prisma, "$transaction">;
type WorkspaceLifecycleTestingOverrides = Partial<{
  afterRead: () => Promise<void>;
  database: WorkspaceLifecycleDatabase;
}>;
export const maximumWorkspacesPerUser = 3;
type CreatedWorkspace = { id: string; name: string; slug: string };

@Injectable()
export class WorkspaceLifecycleService {
  private afterRead: (() => Promise<void>) | undefined;
  private database: WorkspaceLifecycleDatabase = prisma;

  static forTesting(overrides: WorkspaceLifecycleTestingOverrides) {
    const service = new WorkspaceLifecycleService();
    Object.assign(service, overrides);
    return service;
  }

  async create(input: {
    name: unknown;
    requestId?: string;
    slug: unknown;
    userId: string;
  }): Promise<CreatedWorkspace> {
    const name = assertWorkspaceName(input.name);
    const slug = assertWorkspaceHandle(input.slug);

    try {
      return await runWorkspaceLifecycleTransaction(
        this.database,
        input.userId,
        async (transaction) => {
          const workspaceCount = await transaction.member.count({
            where: { userId: input.userId },
          });
          if (workspaceCount >= maximumWorkspacesPerUser) {
            throw new ConflictException("You have reached the maximum number of workspaces.");
          }
          await this.afterRead?.();

          const organization = await transaction.organization.create({
            data: { id: randomUUID(), name, slug },
          });
          await transaction.member.create({
            data: {
              id: randomUUID(),
              organizationId: organization.id,
              role: "owner",
              userId: input.userId,
            },
          });

          return { id: organization.id, name: organization.name, slug: organization.slug };
        },
        { requestId: input.requestId },
      );
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
