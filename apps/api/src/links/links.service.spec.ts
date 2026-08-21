import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { LinksService } from "./links.service.js";

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
      new LinksService().create(
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
      new LinksService().create(
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
      new LinksService().create(
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
      new LinksService().create(
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
      new LinksService().create(
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
      new LinksService().create(
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
});

function createDatabase(member: { organizationId: string; role: string } | undefined) {
  return {
    link: { create: vi.fn() },
    member: { findUnique: vi.fn().mockResolvedValue(member) },
  };
}
