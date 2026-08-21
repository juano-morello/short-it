import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpStatus,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { LinksService } from "./links.service.js";
import { LinkPublicationRateLimiter } from "./publication-policy.js";

describe("LinksService", () => {
  it("persists an immediately published link in the membership-derived workspace", async () => {
    const database = createDatabase({ organizationId: "requested-workspace", role: "editor" });
    database.link.create.mockResolvedValue({
      createdAt: new Date("2026-08-21T12:00:00.000Z"),
      destinationUrl: "https://example.com/portfolio",
      id: "cuid-id",
      organizationId: "requested-workspace",
      publishedAt: new Date("2026-08-21T12:00:00.000Z"),
      slug: "cuid-slug",
    });

    await expect(
      createForTest(
        {
          destinationUrl: "https://example.com/portfolio",
          requestedOrganizationId: "requested-workspace",
          userId: "member-1",
        },
        database as never,
        async () => "https://example.com/portfolio",
      ),
    ).resolves.toMatchObject({
      organizationId: "requested-workspace",
      publishedAt: expect.any(Date),
      slug: "cuid-slug",
    });

    expect(database.member.findUnique).toHaveBeenCalledWith({
      where: {
        organizationId_userId: {
          organizationId: "requested-workspace",
          userId: "member-1",
        },
      },
    });
    expect(database.link.create).toHaveBeenCalledWith({
      data: {
        destinationUrl: "https://example.com/portfolio",
        organizationId: "requested-workspace",
        publishedAt: expect.any(Date),
      },
      select: expect.any(Object),
    });
  });

  it.each(["analyst", undefined])("does not let a %s publish a link", async (role) => {
    const database = createDatabase(role ? { organizationId: "workspace-a", role } : undefined);

    await expect(
      createForTest(
        {
          destinationUrl: "https://example.com/portfolio",
          requestedOrganizationId: "workspace-a",
          userId: "member-1",
        },
        database as never,
        async () => "https://example.com/portfolio",
      ),
    ).rejects.toEqual(
      new ForbiddenException("You do not have permission to publish links in this workspace."),
    );
    expect(database.link.create).not.toHaveBeenCalled();
  });

  it("does not persist a link when destination validation rejects it", async () => {
    const database = createDatabase({ organizationId: "workspace-a", role: "editor" });

    await expect(
      createForTest(
        {
          destinationUrl: "https://internal.local/private",
          requestedOrganizationId: "workspace-a",
          userId: "member-1",
        },
        database as never,
        async () => {
          throw new BadRequestException("Link destinations must not resolve privately.");
        },
      ),
    ).rejects.toEqual(new BadRequestException("Link destinations must not resolve privately."));
    expect(database.link.create).not.toHaveBeenCalled();
  });

  it("allows a member whose persisted role set includes editor", async () => {
    const database = createDatabase({ organizationId: "workspace-a", role: "analyst,editor" });
    database.link.create.mockResolvedValue({ slug: "cmfoo123" });

    await expect(
      createForTest(
        {
          destinationUrl: "https://example.com/portfolio",
          requestedOrganizationId: "workspace-a",
          userId: "member-1",
        },
        database as never,
        async () => "https://example.com/portfolio",
      ),
    ).resolves.toEqual({ slug: "cmfoo123" });
  });

  it("requires a workspace selector before it checks membership", async () => {
    const database = createDatabase({ organizationId: "workspace-a", role: "owner" });

    await expect(
      createForTest(
        {
          destinationUrl: "https://example.com/portfolio",
          requestedOrganizationId: undefined,
          userId: "member-1",
        },
        database as never,
      ),
    ).rejects.toMatchObject({ message: "A workspace is required." });
    expect(database.member.findUnique).not.toHaveBeenCalled();
  });

  it("maps a generated-slug collision to a retryable conflict", async () => {
    const database = createDatabase({ organizationId: "workspace-a", role: "owner" });
    database.link.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("slug collision", {
        clientVersion: Prisma.prismaVersion.client,
        code: "P2002",
      }),
    );

    await expect(
      createForTest(
        {
          destinationUrl: "https://example.com/portfolio",
          requestedOrganizationId: "workspace-a",
          userId: "member-1",
        },
        database as never,
        async () => "https://example.com/portfolio",
      ),
    ).rejects.toMatchObject({ message: "We couldn't publish that link. Please try again." });
  });

  it("rejects a destination longer than 2,048 characters without resolving or persisting it", async () => {
    const database = createDatabase({ organizationId: "workspace-a", role: "owner" });
    const validateDestination = vi.fn();

    await expect(
      createForTest(
        {
          destinationUrl: `https://example.com/${"a".repeat(2_048)}`,
          requestedOrganizationId: "workspace-a",
          userId: "member-1",
        },
        database as never,
        validateDestination,
      ),
    ).rejects.toEqual(
      new BadRequestException("Link destinations must be 2,048 characters or fewer."),
    );
    expect(validateDestination).not.toHaveBeenCalled();
    expect(database.link.create).not.toHaveBeenCalled();
  });

  it("allows a destination that is exactly 2,048 characters before destination validation", async () => {
    const database = createDatabase({ organizationId: "workspace-a", role: "owner" });
    database.link.create.mockResolvedValue({ slug: "cmfoo123" });
    const destinationUrl = "a".repeat(2_048);
    const validateDestination = vi.fn(async () => "https://example.com/portfolio");

    await expect(
      createForTest(
        {
          destinationUrl,
          requestedOrganizationId: "workspace-a",
          userId: "member-1",
        },
        database as never,
        validateDestination,
      ),
    ).resolves.toEqual({ slug: "cmfoo123" });
    expect(validateDestination).toHaveBeenCalledWith(destinationUrl, undefined, undefined);
  });

  it("rejects a Unicode destination that becomes longer than 2,048 characters when normalized", async () => {
    const database = createDatabase({ organizationId: "workspace-a", role: "owner" });
    const rawDestination = `https://example.com/${"é".repeat(1_000)}`;
    const normalizedDestination = new URL(rawDestination).toString();
    const validateDestination = vi.fn(async () => normalizedDestination);

    await expect(
      createForTest(
        {
          destinationUrl: rawDestination,
          requestedOrganizationId: "workspace-a",
          userId: "member-1",
        },
        database,
        validateDestination,
      ),
    ).rejects.toEqual(
      new BadRequestException("Link destinations must be 2,048 characters or fewer."),
    );
    expect(rawDestination).toHaveLength(1_020);
    expect(normalizedDestination.length).toBeGreaterThan(2_048);
    expect(database.link.create).not.toHaveBeenCalled();
  });

  it("rejects publication when a workspace has 1,000 links without resolving or persisting", async () => {
    const database = createDatabase({ organizationId: "workspace-a", role: "owner" });
    database.link.count.mockResolvedValue(1_000);
    const validateDestination = vi.fn();

    await expect(
      createForTest(
        {
          destinationUrl: "https://example.com/portfolio",
          requestedOrganizationId: "workspace-a",
          userId: "member-1",
        },
        database as never,
        validateDestination,
      ),
    ).rejects.toEqual(
      new ConflictException("This workspace has reached its 1,000 published link limit."),
    );
    expect(database.link.count).toHaveBeenCalledWith({
      where: { organizationId: "workspace-a", publishedAt: { not: null } },
    });
    expect(validateDestination).not.toHaveBeenCalled();
    expect(database.link.create).not.toHaveBeenCalled();
  });

  it("rejects the 31st publication attempt before resolution or persistence", async () => {
    const database = createDatabase({ organizationId: "workspace-a", role: "owner" });
    database.link.create.mockResolvedValue({ slug: "cmfoo123" });
    const validateDestination = vi.fn(async () => "https://example.com/portfolio");
    const limiter = new LinkPublicationRateLimiter(() => 0);
    const service = LinksService.forTesting({
      database: database as never,
      publicationRateLimiter: limiter,
      validateDestination,
    });

    for (let attempt = 0; attempt < 30; attempt += 1) {
      await service.create({
        destinationUrl: "https://example.com/portfolio",
        requestedOrganizationId: "workspace-a",
        userId: "member-1",
      });
    }

    await expect(
      service.create({
        destinationUrl: "https://example.com/portfolio",
        requestedOrganizationId: "workspace-a",
        userId: "member-1",
      }),
    ).rejects.toMatchObject({
      message: "Too many link publication attempts. Please try again later.",
      status: HttpStatus.TOO_MANY_REQUESTS,
    });
    expect(validateDestination).toHaveBeenCalledTimes(30);
    expect(database.link.create).toHaveBeenCalledTimes(30);
  });

  it("does not let concurrent publication requests exceed the workspace link limit", async () => {
    const database = createDatabase({ organizationId: "workspace-a", role: "owner" });
    let linkCount = 999;
    database.link.count.mockImplementation(async () => linkCount);
    database.link.create.mockImplementation(async () => {
      linkCount += 1;
      return { slug: "cmfoo123" };
    });
    const validateDestination = vi.fn(async () => "https://example.com/portfolio");
    const service = LinksService.forTesting({
      database: database as never,
      validateDestination,
    });

    const publication = () =>
      service.create({
        destinationUrl: "https://example.com/portfolio",
        requestedOrganizationId: "workspace-a",
        userId: "member-1",
      });

    const results = await Promise.allSettled([publication(), publication()]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(database.link.create).toHaveBeenCalledTimes(1);
    expect(linkCount).toBe(1_000);
  });
});

function createDatabase(member: { organizationId: string; role: string } | undefined) {
  return {
    link: { count: vi.fn().mockResolvedValue(0), create: vi.fn() },
    member: { findUnique: vi.fn().mockResolvedValue(member) },
  };
}

function createForTest(
  input: {
    destinationUrl: unknown;
    requestedOrganizationId: unknown;
    requestId?: string;
    userId: string;
  },
  database: ReturnType<typeof createDatabase>,
  validateDestination?: (value: unknown) => Promise<string>,
) {
  return LinksService.forTesting({
    database: database as never,
    ...(validateDestination ? { validateDestination } : {}),
  }).create(input);
}
