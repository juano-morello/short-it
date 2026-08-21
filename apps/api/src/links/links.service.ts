import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { canCreateLinks } from "../auth/access-control.js";
import { prisma } from "../database.js";
import { assertSafeDestinationUrl } from "./destination-policy.js";
import {
  LinkPublicationRateLimiter,
  MAX_DESTINATION_URL_LENGTH,
  MAX_PUBLISHED_LINKS_PER_WORKSPACE,
  WorkspacePublicationLock,
} from "./publication-policy.js";

type LinkDatabase = Pick<typeof prisma, "link" | "member">;

type CreateLinkInput = {
  destinationUrl: unknown;
  requestedOrganizationId: unknown;
  requestId?: string;
  userId: string;
};

type LinkServiceDependencies = {
  database: LinkDatabase;
  publicationRateLimiter: LinkPublicationRateLimiter;
  validateDestination: typeof assertSafeDestinationUrl;
  workspacePublicationLock: WorkspacePublicationLock;
};

@Injectable()
export class LinksService {
  private dependencies: LinkServiceDependencies = {
    database: prisma,
    publicationRateLimiter: new LinkPublicationRateLimiter(),
    validateDestination: assertSafeDestinationUrl,
    workspacePublicationLock: new WorkspacePublicationLock(),
  };

  static forTesting(overrides: Partial<LinkServiceDependencies>): LinksService {
    const service = new LinksService();
    service.dependencies = { ...service.dependencies, ...overrides };
    return service;
  }

  async create(input: CreateLinkInput) {
    const { database, publicationRateLimiter, validateDestination, workspacePublicationLock } =
      this.dependencies;
    const requestedOrganizationId = assertOrganizationId(input.requestedOrganizationId);
    const membership = await database.member.findUnique({
      where: {
        organizationId_userId: {
          organizationId: requestedOrganizationId,
          userId: input.userId,
        },
      },
    });

    if (!membership || !canCreateLinks(membership.role)) {
      throw new ForbiddenException(
        "You do not have permission to publish links in this workspace.",
      );
    }

    publicationRateLimiter.take(input.userId, membership.organizationId);
    assertDestinationLength(input.destinationUrl);

    if (await workspaceHasReachedLinkLimit(database, membership.organizationId)) {
      throw new ConflictException("This workspace has reached its 1,000 published link limit.");
    }

    const destinationUrl = await validateDestination(
      input.destinationUrl,
      undefined,
      input.requestId,
    );
    assertDestinationLength(destinationUrl);

    return workspacePublicationLock.run(membership.organizationId, async () => {
      if (await workspaceHasReachedLinkLimit(database, membership.organizationId)) {
        throw new ConflictException("This workspace has reached its 1,000 published link limit.");
      }

      try {
        return await database.link.create({
          data: {
            destinationUrl,
            organizationId: membership.organizationId,
            publishedAt: new Date(),
          },
          select: {
            createdAt: true,
            destinationUrl: true,
            id: true,
            organizationId: true,
            publishedAt: true,
            slug: true,
          },
        });
      } catch (error) {
        if (isLinkSlugConflict(error)) {
          throw new ConflictException("We couldn't publish that link. Please try again.");
        }
        throw error;
      }
    });
  }
}

function assertOrganizationId(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new BadRequestException("A workspace is required.");
  }
  return value;
}

function isLinkSlugConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function assertDestinationLength(value: unknown): void {
  if (typeof value === "string" && value.length > MAX_DESTINATION_URL_LENGTH) {
    throw new BadRequestException("Link destinations must be 2,048 characters or fewer.");
  }
}

async function workspaceHasReachedLinkLimit(
  database: LinkDatabase,
  organizationId: string,
): Promise<boolean> {
  const linkCount = await database.link.count({
    where: { organizationId, publishedAt: { not: null } },
  });
  return linkCount >= MAX_PUBLISHED_LINKS_PER_WORKSPACE;
}
