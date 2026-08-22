import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { AnalyticsCaptureService } from "./analytics/analytics-capture.service.js";
import { pruneAnalytics } from "./analytics/analytics-retention.js";
import { AccountDeletionService } from "./auth/account-deletion.service.js";
import { WorkspaceLifecycleService } from "./auth/workspace-lifecycle.service.js";
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

  it("commits a concurrent workspace creation or account deletion without an ownerless workspace", async () => {
    const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
    const userId = `lifecycle-user-${suffix}`;
    const slug = `lifecycle-${suffix}`;
    await testPrisma.user.create({
      data: { id: userId, email: `${userId}@example.test`, name: "Lifecycle User" },
    });
    const lifecycleReadBarrier = new ReadBarrier(2);
    const concurrentPrisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: container.getConnectionUri() }),
    });
    const workspaceLifecycle = WorkspaceLifecycleService.forTesting({
      afterRead: () => lifecycleReadBarrier.wait(),
      database: testPrisma as never,
    });
    const accountDeletion = AccountDeletionService.forTesting({
      afterRead: () => lifecycleReadBarrier.wait(),
      database: concurrentPrisma as never,
    });

    const outcomes = await Promise.allSettled([
      workspaceLifecycle.create({ name: "Lifecycle Workspace", slug, userId }),
      accountDeletion.delete({
        confirmationEmail: `${userId}@example.test`,
        email: `${userId}@example.test`,
        userId,
      }),
    ]).finally(() => concurrentPrisma.$disconnect());

    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    const workspace = await testPrisma.organization.findUnique({ where: { slug } });
    if (workspace) {
      expect(outcomes[0]).toMatchObject({ status: "fulfilled" });
      expect(outcomes[1]).toMatchObject({
        reason: expect.any(ConflictException),
        status: "rejected",
      });
      await expect(testPrisma.user.findUnique({ where: { id: userId } })).resolves.toBeTruthy();
      await expect(
        testPrisma.member.count({
          where: { organizationId: workspace.id, role: "owner", userId },
        }),
      ).resolves.toBe(1);
    } else {
      expect(outcomes[0]).toMatchObject({
        reason: expect.any(UnauthorizedException),
        status: "rejected",
      });
      expect(outcomes[1]).toMatchObject({ status: "fulfilled" });
      await expect(testPrisma.user.findUnique({ where: { id: userId } })).resolves.toBeNull();
    }
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
    ).resolves.toEqual({
      destinationUrl: "https://public.example/portfolio",
      linkId: link.id,
      organizationId: "redirect-workspace",
    });
    await expect(
      service.resolve({ host: "other-workspace.short.it", slug: link.slug }),
    ).rejects.toEqual(new NotFoundException());

    await testPrisma.link.update({ data: { publishedAt: null }, where: { id: link.id } });
    await expect(
      service.resolve({ host: "redirect-workspace.short.it", slug: link.slug }),
    ).rejects.toEqual(new NotFoundException());
  });

  it("persists only daily aggregates and expiring visitor digests for redirect analytics", async () => {
    await testPrisma.organization.create({
      data: { id: "analytics-workspace", name: "Analytics Workspace", slug: "analytics-workspace" },
    });
    const link = await testPrisma.link.create({
      data: {
        destinationUrl: "https://public.example/analytics",
        organizationId: "analytics-workspace",
        publishedAt: new Date(),
      },
    });
    const capture = AnalyticsCaptureService.forTesting({
      database: testPrisma as never,
      now: () => new Date("2026-08-22T10:00:00.000Z"),
      visitorSecret: "analytics-secret-for-integration-tests-only",
    });

    for (const input of [
      {
        ipAddress: "203.0.113.40",
        referrer: "https://source.example/path",
        userAgent: "Mozilla/5.0 (iPhone)",
      },
      {
        ipAddress: "203.0.113.40",
        referrer: "https://source.example/other",
        userAgent: "Mozilla/5.0 (X11)",
      },
      { ipAddress: "203.0.113.41", referrer: undefined, userAgent: undefined },
    ]) {
      expect(
        capture.tryCapture({
          ...input,
          linkId: link.id,
          organizationId: "analytics-workspace",
          requestId: "analytics-test-request",
        }),
      ).toBe(true);
    }

    await vi.waitFor(async () => {
      await expect(
        testPrisma.linkAnalyticsDaily.findUniqueOrThrow({
          where: {
            organizationId_linkId_day: {
              day: new Date("2026-08-22T00:00:00.000Z"),
              linkId: link.id,
              organizationId: "analytics-workspace",
            },
          },
        }),
      ).resolves.toMatchObject({ clicks: 3, uniqueVisitors: 2 });
    });

    await expect(
      testPrisma.linkAnalyticsDimensionDaily.findMany({
        where: { linkId: link.id, organizationId: "analytics-workspace" },
        orderBy: [{ dimension: "asc" }, { value: "asc" }],
        select: { clicks: true, dimension: true, value: true },
      }),
    ).resolves.toEqual([
      { clicks: 3, dimension: "COUNTRY", value: "Unknown" },
      { clicks: 1, dimension: "DEVICE", value: "desktop" },
      { clicks: 1, dimension: "DEVICE", value: "mobile" },
      { clicks: 1, dimension: "DEVICE", value: "unknown" },
      { clicks: 1, dimension: "REFERRER", value: "direct" },
      { clicks: 2, dimension: "REFERRER", value: "source.example" },
    ]);
    const visitors = await testPrisma.linkAnalyticsVisitor.findMany({
      where: { linkId: link.id, organizationId: "analytics-workspace" },
      select: { expiresAt: true, visitorDigest: true },
    });
    expect(visitors).toHaveLength(2);
    expect(JSON.stringify(visitors)).not.toContain("203.0.113.40");
    expect(JSON.stringify(visitors)).not.toContain("Mozilla");
    expect(visitors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ expiresAt: new Date("2026-08-23T00:00:00.000Z") }),
      ]),
    );
  });

  it("caps new referrer hosts at 100 per link per UTC day", async () => {
    await testPrisma.organization.create({
      data: { id: "referrer-workspace", name: "Referrer Workspace", slug: "referrer-workspace" },
    });
    const link = await testPrisma.link.create({
      data: {
        destinationUrl: "https://public.example/referrers",
        organizationId: "referrer-workspace",
        publishedAt: new Date(),
      },
    });
    const day = new Date("2026-08-22T00:00:00.000Z");
    await testPrisma.linkAnalyticsDaily.create({
      data: { clicks: 100, day, linkId: link.id, organizationId: "referrer-workspace" },
    });
    await testPrisma.linkAnalyticsDimensionDaily.createMany({
      data: Array.from({ length: 100 }, (_, index) => ({
        clicks: 1,
        day,
        dimension: "REFERRER" as const,
        linkId: link.id,
        organizationId: "referrer-workspace",
        value: `source-${index}.example`,
      })),
    });
    const capture = AnalyticsCaptureService.forTesting({
      database: testPrisma as never,
      now: () => new Date("2026-08-22T11:00:00.000Z"),
      visitorSecret: "analytics-secret-for-integration-tests-only",
    });

    expect(
      capture.tryCapture({
        ipAddress: "203.0.113.50",
        linkId: link.id,
        organizationId: "referrer-workspace",
        referrer: "https://source-101.example/path",
        requestId: "referrer-cap-request",
        userAgent: "Mozilla/5.0",
      }),
    ).toBe(true);

    await vi.waitFor(async () => {
      await expect(
        testPrisma.linkAnalyticsDimensionDaily.findUnique({
          where: {
            organizationId_linkId_day_dimension_value: {
              day,
              dimension: "REFERRER",
              linkId: link.id,
              organizationId: "referrer-workspace",
              value: "other",
            },
          },
        }),
      ).resolves.toMatchObject({ clicks: 1 });
    });
    await expect(
      testPrisma.linkAnalyticsDimensionDaily.findUnique({
        where: {
          organizationId_linkId_day_dimension_value: {
            day,
            dimension: "REFERRER",
            linkId: link.id,
            organizationId: "referrer-workspace",
            value: "source-101.example",
          },
        },
      }),
    ).resolves.toBeNull();
  });

  it("keeps the referrer-host cap under concurrent captures for one link day", async () => {
    await testPrisma.organization.create({
      data: {
        id: "concurrent-referrer-workspace",
        name: "Concurrent Referrer Workspace",
        slug: "concurrent-referrer-workspace",
      },
    });
    const link = await testPrisma.link.create({
      data: {
        destinationUrl: "https://public.example/concurrent-referrers",
        organizationId: "concurrent-referrer-workspace",
        publishedAt: new Date(),
      },
    });
    const day = new Date("2026-08-22T00:00:00.000Z");
    await testPrisma.linkAnalyticsDaily.create({
      data: { clicks: 99, day, linkId: link.id, organizationId: "concurrent-referrer-workspace" },
    });
    await testPrisma.linkAnalyticsDimensionDaily.createMany({
      data: Array.from({ length: 99 }, (_, index) => ({
        clicks: 1,
        day,
        dimension: "REFERRER" as const,
        linkId: link.id,
        organizationId: "concurrent-referrer-workspace",
        value: `source-${index}.example`,
      })),
    });
    const capture = AnalyticsCaptureService.forTesting({
      database: testPrisma as never,
      now: () => new Date("2026-08-22T11:00:00.000Z"),
      visitorSecret: "analytics-secret-for-integration-tests-only",
    });

    for (const [index, host] of ["source-99.example", "source-100.example"].entries()) {
      expect(
        capture.tryCapture({
          ipAddress: `203.0.113.${60 + index}`,
          linkId: link.id,
          organizationId: "concurrent-referrer-workspace",
          referrer: `https://${host}/path`,
          requestId: `concurrent-referrer-${index}`,
          userAgent: "Mozilla/5.0",
        }),
      ).toBe(true);
    }

    await vi.waitFor(async () => {
      await expect(
        testPrisma.linkAnalyticsDaily.findUniqueOrThrow({
          where: {
            organizationId_linkId_day: {
              day,
              linkId: link.id,
              organizationId: "concurrent-referrer-workspace",
            },
          },
        }),
      ).resolves.toMatchObject({ clicks: 101 });
    });
    await expect(
      testPrisma.linkAnalyticsDimensionDaily.count({
        where: {
          day,
          dimension: "REFERRER",
          linkId: link.id,
          organizationId: "concurrent-referrer-workspace",
          value: { notIn: ["direct", "other", "unknown"] },
        },
      }),
    ).resolves.toBe(100);
    await expect(
      testPrisma.linkAnalyticsDimensionDaily.findUnique({
        where: {
          organizationId_linkId_day_dimension_value: {
            day,
            dimension: "REFERRER",
            linkId: link.id,
            organizationId: "concurrent-referrer-workspace",
            value: "other",
          },
        },
      }),
    ).resolves.toMatchObject({ clicks: 1 });
  });

  it("prunes expired visitor state and aggregate days older than twelve months idempotently", async () => {
    await testPrisma.organization.create({
      data: {
        id: "retention-workspace",
        name: "Retention Workspace",
        slug: "retention-workspace",
      },
    });
    const link = await testPrisma.link.create({
      data: {
        destinationUrl: "https://public.example/retention",
        organizationId: "retention-workspace",
        publishedAt: new Date(),
      },
    });
    const oldDay = new Date("2025-08-21T00:00:00.000Z");
    const retainedDay = new Date("2025-08-22T00:00:00.000Z");
    await testPrisma.linkAnalyticsDaily.createMany({
      data: [
        { day: oldDay, linkId: link.id, organizationId: "retention-workspace" },
        { day: retainedDay, linkId: link.id, organizationId: "retention-workspace" },
      ],
    });
    await testPrisma.linkAnalyticsVisitor.create({
      data: {
        day: oldDay,
        expiresAt: new Date("2025-08-22T00:00:00.000Z"),
        linkId: link.id,
        organizationId: "retention-workspace",
        visitorDigest: "a".repeat(64),
      },
    });

    await expect(
      pruneAnalytics(testPrisma as never, new Date("2026-08-22T10:00:00.000Z")),
    ).resolves.toEqual({ expiredAggregates: 1, expiredVisitors: 1 });
    await expect(
      testPrisma.linkAnalyticsDaily.findUnique({
        where: {
          organizationId_linkId_day: {
            day: oldDay,
            linkId: link.id,
            organizationId: "retention-workspace",
          },
        },
      }),
    ).resolves.toBeNull();
    await expect(
      testPrisma.linkAnalyticsDaily.findUnique({
        where: {
          organizationId_linkId_day: {
            day: retainedDay,
            linkId: link.id,
            organizationId: "retention-workspace",
          },
        },
      }),
    ).resolves.toBeTruthy();
    await expect(
      pruneAnalytics(testPrisma as never, new Date("2026-08-22T10:00:00.000Z")),
    ).resolves.toEqual({ expiredAggregates: 0, expiredVisitors: 0 });
  });

  it("retains a daily visitor digest through UTC midnight and removes it within the cleanup grace", async () => {
    await testPrisma.organization.create({
      data: {
        id: "visitor-cleanup-workspace",
        name: "Visitor Cleanup Workspace",
        slug: "visitor-cleanup-workspace",
      },
    });
    const link = await testPrisma.link.create({
      data: {
        destinationUrl: "https://public.example/visitor-cleanup",
        organizationId: "visitor-cleanup-workspace",
        publishedAt: new Date(),
      },
    });
    const day = new Date("2026-08-22T00:00:00.000Z");
    await testPrisma.linkAnalyticsDaily.create({
      data: { day, linkId: link.id, organizationId: "visitor-cleanup-workspace" },
    });
    await testPrisma.linkAnalyticsVisitor.create({
      data: {
        day,
        expiresAt: new Date("2026-08-23T00:00:00.000Z"),
        linkId: link.id,
        organizationId: "visitor-cleanup-workspace",
        visitorDigest: "c".repeat(64),
      },
    });

    await expect(
      pruneAnalytics(testPrisma as never, new Date("2026-08-22T23:59:59.999Z")),
    ).resolves.toEqual({ expiredAggregates: 0, expiredVisitors: 0 });
    await expect(
      testPrisma.linkAnalyticsVisitor.count({
        where: { linkId: link.id, organizationId: "visitor-cleanup-workspace" },
      }),
    ).resolves.toBe(1);
    await expect(
      pruneAnalytics(testPrisma as never, new Date("2026-08-23T00:05:00.000Z")),
    ).resolves.toEqual(expect.objectContaining({ expiredVisitors: expect.any(Number) }));
    await expect(
      testPrisma.linkAnalyticsVisitor.count({
        where: { linkId: link.id, organizationId: "visitor-cleanup-workspace" },
      }),
    ).resolves.toBe(0);
  });

  it("runs the prune command against an isolated PostgreSQL database", async () => {
    await testPrisma.organization.create({
      data: { id: "prune-command-workspace", name: "Prune Command", slug: "prune-command" },
    });
    const link = await testPrisma.link.create({
      data: {
        destinationUrl: "https://public.example/prune-command",
        organizationId: "prune-command-workspace",
        publishedAt: new Date(),
      },
    });
    const oldDay = new Date("2020-01-01T00:00:00.000Z");
    await testPrisma.linkAnalyticsDaily.create({
      data: { day: oldDay, linkId: link.id, organizationId: "prune-command-workspace" },
    });
    await testPrisma.linkAnalyticsVisitor.create({
      data: {
        day: oldDay,
        expiresAt: new Date("2020-01-02T00:00:00.000Z"),
        linkId: link.id,
        organizationId: "prune-command-workspace",
        visitorDigest: "b".repeat(64),
      },
    });

    const output = execFileSync("pnpm", ["exec", "tsx", "src/analytics/prune-analytics.ts"], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: container.getConnectionUri() },
      encoding: "utf8",
    });
    expect(JSON.parse(output.trim())).toMatchObject({
      event: "redirect_analytics_pruned",
      expiredAggregates: 1,
      expiredVisitors: 1,
    });
    await expect(
      testPrisma.linkAnalyticsDaily.findUnique({
        where: {
          organizationId_linkId_day: {
            day: oldDay,
            linkId: link.id,
            organizationId: "prune-command-workspace",
          },
        },
      }),
    ).resolves.toBeNull();
  });
});

class ReadBarrier {
  private arrivals = 0;
  private release: () => void = () => undefined;
  private readonly released = new Promise<void>((resolve) => {
    this.release = resolve;
  });

  constructor(private readonly expectedArrivals: number) {}

  async wait(): Promise<void> {
    this.arrivals += 1;
    if (this.arrivals === this.expectedArrivals) this.release();
    await this.released;
  }
}
