import { execFileSync } from "node:child_process";
import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { LinksService } from "./links/links.service.js";
import { PublicRedirectService } from "./redirect/public-redirect.service.js";

describe("PostgreSQL integration", () => {
  let container: StartedPostgreSqlContainer;
  let testPrisma: PrismaClient;

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16-alpine").start();
    const connectionString = container.getConnectionUri();

    execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy", "--config", "prisma.config.ts"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DATABASE_URL: connectionString,
      },
      stdio: "pipe",
    });

    testPrisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString }),
    });
  }, 60_000);

  afterAll(async () => {
    await testPrisma?.$disconnect();
    await container?.stop();
  });

  it("applies the Prisma schema to an isolated PostgreSQL database", async () => {
    await testPrisma.organization.create({
      data: {
        id: "workspace-a",
        name: "Workspace A",
        slug: "workspace-a",
      },
    });

    await expect(testPrisma.organization.count()).resolves.toBe(1);
  });

  it("generates a CUID link slug without a database migration", async () => {
    await testPrisma.user.create({
      data: {
        id: "editor-1",
        email: "editor@example.test",
        name: "Editor",
      },
    });
    await testPrisma.organization.create({
      data: {
        id: "workspace-links",
        name: "Link Workspace",
        slug: "workspace-links",
      },
    });
    await testPrisma.member.create({
      data: {
        id: "workspace-links-editor-1",
        organizationId: "workspace-links",
        role: "editor",
        userId: "editor-1",
      },
    });

    const link = await testPrisma.link.create({
      data: {
        destinationUrl: "https://example.com/portfolio",
        organizationId: "workspace-links",
        publishedAt: new Date(),
      },
    });

    expect(link.slug).toMatch(/^c[a-z0-9]{24}$/);
    expect(link.publishedAt).not.toBeNull();
  });

  it("does not let a member use another workspace as an authorization source", async () => {
    await testPrisma.user.create({
      data: {
        id: "cross-tenant-editor",
        email: "cross-tenant-editor@example.test",
        name: "Cross-tenant Editor",
      },
    });
    await testPrisma.organization.create({
      data: {
        id: "workspace-member",
        name: "Member Workspace",
        slug: "workspace-member",
      },
    });
    await testPrisma.member.create({
      data: {
        id: "workspace-member-editor",
        organizationId: "workspace-member",
        role: "editor",
        userId: "cross-tenant-editor",
      },
    });
    await testPrisma.organization.create({
      data: {
        id: "workspace-other",
        name: "Other Workspace",
        slug: "workspace-other",
      },
    });
    const before = await testPrisma.link.count();

    await expect(
      LinksService.forTesting({
        database: testPrisma as never,
        validateDestination: async () => "https://example.com/portfolio",
      }).create({
        destinationUrl: "https://example.com/portfolio",
        requestedOrganizationId: "workspace-other",
        userId: "cross-tenant-editor",
      }),
    ).rejects.toEqual(
      new ForbiddenException("You do not have permission to publish links in this workspace."),
    );

    await expect(testPrisma.link.count()).resolves.toBe(before);
  });

  it("does not publish more than 1,000 links for one workspace", async () => {
    await testPrisma.user.create({
      data: {
        id: "quota-owner",
        email: "quota-owner@example.test",
        name: "Quota Owner",
      },
    });
    await testPrisma.organization.create({
      data: {
        id: "workspace-quota",
        name: "Quota Workspace",
        slug: "workspace-quota",
      },
    });
    await testPrisma.member.create({
      data: {
        id: "workspace-quota-owner",
        organizationId: "workspace-quota",
        role: "owner",
        userId: "quota-owner",
      },
    });
    await testPrisma.link.createMany({
      data: Array.from({ length: 1_000 }, () => ({
        destinationUrl: "https://example.com/portfolio",
        organizationId: "workspace-quota",
        publishedAt: new Date(),
      })),
    });

    await expect(
      LinksService.forTesting({
        database: testPrisma as never,
        validateDestination: async () => "https://example.com/next-link",
      }).create({
        destinationUrl: "https://example.com/next-link",
        requestedOrganizationId: "workspace-quota",
        userId: "quota-owner",
      }),
    ).rejects.toEqual(
      new ConflictException("This workspace has reached its 1,000 published link limit."),
    );
    await expect(
      testPrisma.link.count({
        where: { organizationId: "workspace-quota", publishedAt: { not: null } },
      }),
    ).resolves.toBe(1_000);
  });

  it("resolves a published link only through its own workspace host", async () => {
    await testPrisma.organization.createMany({
      data: [
        { id: "redirect-workspace", name: "Redirect Workspace", slug: "redirect-workspace" },
        { id: "other-workspace", name: "Other Workspace", slug: "other-workspace" },
      ],
    });
    const link = await testPrisma.link.create({
      data: {
        destinationUrl: "https://public.example/portfolio",
        organizationId: "redirect-workspace",
        publishedAt: new Date(),
      },
    });
    const service = PublicRedirectService.forTesting({
      baseDomain: "short.it",
      database: testPrisma as never,
      validateDestination: async (destinationUrl) => {
        if (typeof destinationUrl !== "string") throw new Error("Expected a destination URL.");
        return destinationUrl;
      },
    });

    await expect(
      service.resolve({ host: "redirect-workspace.short.it", slug: link.slug }),
    ).resolves.toBe("https://public.example/portfolio");
    await expect(
      service.resolve({ host: "other-workspace.short.it", slug: link.slug }),
    ).rejects.toEqual(new NotFoundException());

    await testPrisma.link.update({ data: { publishedAt: null }, where: { id: link.id } });
    await expect(
      service.resolve({ host: "redirect-workspace.short.it", slug: link.slug }),
    ).rejects.toEqual(new NotFoundException());
  });
});
