import type { analyticsPrisma } from "../database.js";
import { getAnalyticsDay } from "./analytics-policy.js";

type AnalyticsPruneDatabase = Pick<
  typeof analyticsPrisma,
  "linkAnalyticsDaily" | "linkAnalyticsVisitor"
>;

export function getAggregateRetentionStart(now: Date): Date {
  const start = getAnalyticsDay(now);
  start.setUTCMonth(start.getUTCMonth() - 12);
  return start;
}

export async function pruneAnalytics(
  database: AnalyticsPruneDatabase,
  now: Date,
): Promise<{ expiredAggregates: number; expiredVisitors: number }> {
  const expiredVisitors = await database.linkAnalyticsVisitor.deleteMany({
    where: { expiresAt: { lte: now } },
  });
  const expiredAggregates = await database.linkAnalyticsDaily.deleteMany({
    where: { day: { lt: getAggregateRetentionStart(now) } },
  });
  return {
    expiredAggregates: expiredAggregates.count,
    expiredVisitors: expiredVisitors.count,
  };
}
