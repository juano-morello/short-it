import { describe, expect, it, vi } from "vitest";
import { getAggregateRetentionStart, pruneAnalytics } from "./analytics-retention.js";

describe("analytics retention", () => {
  it("keeps aggregate days for twelve calendar months", () => {
    expect(getAggregateRetentionStart(new Date("2026-08-22T10:00:00.000Z"))).toEqual(
      new Date("2025-08-22T00:00:00.000Z"),
    );
  });

  it("can run again after all eligible records have been removed", async () => {
    const database = {
      linkAnalyticsDaily: {
        deleteMany: vi.fn().mockResolvedValueOnce({ count: 2 }).mockResolvedValue({ count: 0 }),
      },
      linkAnalyticsVisitor: {
        deleteMany: vi.fn().mockResolvedValueOnce({ count: 1 }).mockResolvedValue({ count: 0 }),
      },
    };
    const now = new Date("2026-08-22T10:00:00.000Z");

    await expect(pruneAnalytics(database as never, now)).resolves.toEqual({
      expiredAggregates: 2,
      expiredVisitors: 1,
    });
    await expect(pruneAnalytics(database as never, now)).resolves.toEqual({
      expiredAggregates: 0,
      expiredVisitors: 0,
    });
  });
});
