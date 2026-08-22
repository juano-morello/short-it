import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { AnalyticsOverviewService, getOverviewStart } from "./analytics-overview.service.js";

describe("AnalyticsOverviewService", () => {
  it("returns only an authorized workspace's twelve-month aggregate overview", async () => {
    const membershipDatabase = {
      member: { findUnique: vi.fn().mockResolvedValue({ role: "analyst" }) },
    };
    const analyticsDatabase = {
      linkAnalyticsDaily: {
        groupBy: vi.fn().mockResolvedValue([
          {
            _sum: { clicks: 5, uniqueVisitors: 3 },
            day: new Date("2026-08-22T00:00:00.000Z"),
          },
          {
            _sum: { clicks: 4, uniqueVisitors: 4 },
            day: new Date("2026-08-21T00:00:00.000Z"),
          },
        ]),
      },
      linkAnalyticsDimensionDaily: {
        groupBy: vi
          .fn()
          .mockResolvedValueOnce([{ _sum: { clicks: 5 }, value: "Unknown" }])
          .mockResolvedValueOnce([
            { _sum: { clicks: 4 }, value: "desktop" },
            { _sum: { clicks: 1 }, value: "mobile" },
          ])
          .mockResolvedValueOnce([{ _sum: { clicks: 3 }, value: "source.example" }]),
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
    expect(analyticsDatabase.linkAnalyticsDaily.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          day: { gte: new Date("2025-08-22T00:00:00.000Z") },
          organizationId: "workspace-1",
        },
      }),
    );
    expect(analyticsDatabase.linkAnalyticsDimensionDaily.groupBy).toHaveBeenCalledTimes(3);
    expect(analyticsDatabase.linkAnalyticsDimensionDaily.groupBy).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: {
          day: { gte: new Date("2025-08-22T00:00:00.000Z") },
          dimension: "COUNTRY",
          organizationId: "workspace-1",
        },
      }),
    );
    expect(analyticsDatabase.linkAnalyticsDimensionDaily.groupBy).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        take: 5,
        where: {
          day: { gte: new Date("2025-08-22T00:00:00.000Z") },
          dimension: "DEVICE",
          organizationId: "workspace-1",
        },
      }),
    );
    expect(analyticsDatabase.linkAnalyticsDimensionDaily.groupBy).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        take: 5,
        where: {
          day: { gte: new Date("2025-08-22T00:00:00.000Z") },
          dimension: "REFERRER",
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

  it("uses the same twelve-calendar-month window as aggregate retention", () => {
    expect(getOverviewStart(new Date("2026-08-22T12:00:00.000Z"))).toEqual(
      new Date("2025-08-22T00:00:00.000Z"),
    );
  });
});
