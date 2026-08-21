import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { prisma } from "../database.js";
import { assertSafeDestinationUrl } from "./destination-policy.js";

type LinkDatabase = Pick<typeof prisma, "link" | "member">;

type CreateLinkInput = {
  destinationUrl: unknown;
  requestedOrganizationId: unknown;
  requestId?: string;
  userId: string;
};

@Injectable()
export class LinksService {
  async create(
    input: CreateLinkInput,
    database: LinkDatabase = prisma,
    validateDestination: typeof assertSafeDestinationUrl = assertSafeDestinationUrl,
  ) {
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

    const destinationUrl = await validateDestination(
      input.destinationUrl,
      undefined,
      input.requestId,
    );

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
  }
}

function assertOrganizationId(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new BadRequestException("A workspace is required.");
  }
  return value;
}

function canCreateLinks(role: string): boolean {
  return role
    .split(",")
    .some((assignedRole) => assignedRole === "owner" || assignedRole === "editor");
}

function isLinkSlugConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
