import { ForbiddenException, Injectable } from "@nestjs/common";
import { AnalyticsDimension } from "@prisma/client";
import { canReadAnalytics } from "../auth/access-control.js";
import { analyticsPrisma, prisma } from "../database.js";
import { getAggregateRetentionStart } from "./analytics-retention.js";

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
    const [dailyRows, countries, devices, referrers] = await Promise.all([
      this.dependencies.analyticsDatabase.linkAnalyticsDaily.groupBy({
        _sum: { clicks: true, uniqueVisitors: true },
        by: ["day"],
        orderBy: { day: "desc" },
        where: { day: { gte: since }, organizationId: input.organizationId },
      }),
      this.getTopDimensions(input.organizationId, since, AnalyticsDimension.COUNTRY),
      this.getTopDimensions(input.organizationId, since, AnalyticsDimension.DEVICE),
      this.getTopDimensions(input.organizationId, since, AnalyticsDimension.REFERRER),
    ]);

    return {
      breakdowns: { countries, devices, referrers },
      daily: dailyRows.map((row) => ({
        clicks: row._sum.clicks ?? 0,
        dailyUniqueLinkVisitors: row._sum.uniqueVisitors ?? 0,
        date: row.day.toISOString().slice(0, 10),
      })),
    };
  }

  private async getTopDimensions(
    organizationId: string,
    since: Date,
    dimension: AnalyticsDimension,
  ): Promise<Array<{ clicks: number; value: string }>> {
    const rows = await this.dependencies.analyticsDatabase.linkAnalyticsDimensionDaily.groupBy({
      _sum: { clicks: true },
      by: ["value"],
      orderBy: [{ _sum: { clicks: "desc" } }, { value: "asc" }],
      take: 5,
      where: {
        day: { gte: since },
        dimension,
        organizationId,
      },
    });
    return rows.map((row) => ({ clicks: row._sum.clicks ?? 0, value: row.value }));
  }
}

export function getOverviewStart(now: Date): Date {
  return getAggregateRetentionStart(now);
}
