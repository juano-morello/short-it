import { ForbiddenException, Injectable } from "@nestjs/common";
import { AnalyticsDimension } from "@prisma/client";
import { canReadAnalytics } from "../auth/access-control.js";
import { analyticsPrisma, prisma } from "../database.js";
import { getAnalyticsDay } from "./analytics-policy.js";

const OVERVIEW_DAYS = 365;

type MembershipDatabase = Pick<typeof prisma, "member">;
type OverviewDatabase = Pick<
  typeof analyticsPrisma,
  "linkAnalyticsDaily" | "linkAnalyticsDimensionDaily"
>;

type AnalyticsOverviewDependencies = {
  analyticsDatabase: OverviewDatabase;
  membershipDatabase: MembershipDatabase;
  now: () => Date;
};

type AnalyticsOverviewInput = {
  organizationId: string;
  userId: string;
};

@Injectable()
export class AnalyticsOverviewService {
  private dependencies: AnalyticsOverviewDependencies = {
    analyticsDatabase: analyticsPrisma,
    membershipDatabase: prisma,
    now: () => new Date(),
  };

  static forTesting(overrides: Partial<AnalyticsOverviewDependencies>): AnalyticsOverviewService {
    const service = new AnalyticsOverviewService();
    service.dependencies = { ...service.dependencies, ...overrides };
    return service;
  }

  async getOverview(input: AnalyticsOverviewInput) {
    const membership = await this.dependencies.membershipDatabase.member.findUnique({
      select: { role: true },
      where: {
        organizationId_userId: {
          organizationId: input.organizationId,
          userId: input.userId,
        },
      },
    });
    if (!membership || !canReadAnalytics(membership.role)) {
      throw new ForbiddenException(
        "You do not have permission to view analytics in this workspace.",
      );
    }

    const since = getOverviewStart(this.dependencies.now());
    const [dailyRows, dimensionRows] = await Promise.all([
      this.dependencies.analyticsDatabase.linkAnalyticsDaily.findMany({
        select: { clicks: true, day: true, uniqueVisitors: true },
        where: { day: { gte: since }, organizationId: input.organizationId },
      }),
      this.dependencies.analyticsDatabase.linkAnalyticsDimensionDaily.findMany({
        select: { clicks: true, dimension: true, value: true },
        where: { day: { gte: since }, organizationId: input.organizationId },
      }),
    ]);

    const daily = new Map<string, { clicks: number; dailyUniqueLinkVisitors: number }>();
    for (const row of dailyRows) {
      const date = row.day.toISOString().slice(0, 10);
      const current = daily.get(date) ?? { clicks: 0, dailyUniqueLinkVisitors: 0 };
      current.clicks += row.clicks;
      current.dailyUniqueLinkVisitors += row.uniqueVisitors;
      daily.set(date, current);
    }

    return {
      breakdowns: {
        countries: summarizeDimensions(dimensionRows, AnalyticsDimension.COUNTRY),
        devices: summarizeDimensions(dimensionRows, AnalyticsDimension.DEVICE),
        referrers: summarizeDimensions(dimensionRows, AnalyticsDimension.REFERRER),
      },
      daily: [...daily.entries()]
        .map(([date, values]) => ({ date, ...values }))
        .sort((left, right) => right.date.localeCompare(left.date)),
    };
  }
}

export function getOverviewStart(now: Date): Date {
  const today = getAnalyticsDay(now);
  return new Date(today.getTime() - (OVERVIEW_DAYS - 1) * 24 * 60 * 60 * 1000);
}

function summarizeDimensions(
  rows: Array<{ clicks: number; dimension: AnalyticsDimension; value: string }>,
  dimension: AnalyticsDimension,
) {
  const values = new Map<string, number>();
  for (const row of rows) {
    if (row.dimension !== dimension) continue;
    values.set(row.value, (values.get(row.value) ?? 0) + row.clicks);
  }
  return [...values.entries()]
    .map(([value, clicks]) => ({ clicks, value }))
    .sort((left, right) => right.clicks - left.clicks || left.value.localeCompare(right.value));
}
