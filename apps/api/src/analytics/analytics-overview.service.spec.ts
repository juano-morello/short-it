import { ForbiddenException } from "@nestjs/common";
import { AnalyticsDimension } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { AnalyticsOverviewService, getOverviewStart } from "./analytics-overview.service.js";

describe("AnalyticsOverviewService", () => {
  it("returns only an authorized workspace's twelve-month aggregate overview", async () => {
    const membershipDatabase = {
      member: { findUnique: vi.fn().mockResolvedValue({ role: "analyst" }) },
    };
    const analyticsDatabase = {
      linkAnalyticsDaily: {
        findMany: vi.fn().mockResolvedValue([
          { clicks: 2, day: new Date("2026-08-22T00:00:00.000Z"), uniqueVisitors: 1 },
          { clicks: 3, day: new Date("2026-08-22T00:00:00.000Z"), uniqueVisitors: 2 },
          { clicks: 4, day: new Date("2026-08-21T00:00:00.000Z"), uniqueVisitors: 4 },
        ]),
      },
      linkAnalyticsDimensionDaily: {
        findMany: vi.fn().mockResolvedValue([
          { clicks: 5, dimension: AnalyticsDimension.COUNTRY, value: "Unknown" },
          { clicks: 4, dimension: AnalyticsDimension.DEVICE, value: "desktop" },
          { clicks: 1, dimension: AnalyticsDimension.DEVICE, value: "mobile" },
          { clicks: 3, dimension: AnalyticsDimension.REFERRER, value: "source.example" },
        ]),
      },
    };
    const service = AnalyticsOverviewService.forTesting({
      analyticsDatabase: analyticsDatabase as never,
      membershipDatabase: membershipDatabase as never,
      now: () => new Date("2026-08-22T12:00:00.000Z"),
    });

    await expect(
      service.getOverview({ organizationId: "workspace-1", userId: "analyst-1" }),
    ).resolves.toEqual({
      breakdowns: {
        countries: [{ clicks: 5, value: "Unknown" }],
        devices: [
          { clicks: 4, value: "desktop" },
          { clicks: 1, value: "mobile" },
        ],
        referrers: [{ clicks: 3, value: "source.example" }],
      },
      daily: [
        { clicks: 5, dailyUniqueLinkVisitors: 3, date: "2026-08-22" },
        { clicks: 4, dailyUniqueLinkVisitors: 4, date: "2026-08-21" },
      ],
    });
    expect(membershipDatabase.member.findUnique).toHaveBeenCalledWith({
      select: { role: true },
      where: { organizationId_userId: { organizationId: "workspace-1", userId: "analyst-1" } },
    });
    expect(analyticsDatabase.linkAnalyticsDaily.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          day: { gte: new Date("2025-08-23T00:00:00.000Z") },
          organizationId: "workspace-1",
        },
      }),
    );
    expect(analyticsDatabase.linkAnalyticsDimensionDaily.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          day: { gte: new Date("2025-08-23T00:00:00.000Z") },
          organizationId: "workspace-1",
        },
      }),
    );
  });

  it("rejects users without an analytics-readable membership", async () => {
    const service = AnalyticsOverviewService.forTesting({
      analyticsDatabase: {} as never,
      membershipDatabase: {
        member: { findUnique: vi.fn().mockResolvedValue({ role: "unknown" }) },
      } as never,
    });

    await expect(
      service.getOverview({ organizationId: "workspace-1", userId: "member-1" }),
    ).rejects.toEqual(
      new ForbiddenException("You do not have permission to view analytics in this workspace."),
    );
  });

  it("uses a 365-day inclusive reporting window", () => {
    expect(getOverviewStart(new Date("2026-08-22T12:00:00.000Z"))).toEqual(
      new Date("2025-08-23T00:00:00.000Z"),
    );
  });
});
