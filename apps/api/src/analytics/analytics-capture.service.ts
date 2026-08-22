import { Injectable, Logger } from "@nestjs/common";
import { AnalyticsDimension, type Prisma } from "@prisma/client";
import { getConfig } from "../config.js";
import { analyticsPrisma } from "../database.js";
import {
  classifyDevice,
  createDailyVisitorDigest,
  getAnalyticsDay,
  getVisitorExpiry,
  normalizeReferrerHost,
  normalizeTrustedIp,
} from "./analytics-policy.js";

const MAX_CONCURRENT_CAPTURES = 20;
const MAX_REFERRER_HOSTS_PER_LINK_DAY = 100;

type AnalyticsCaptureInput = {
  ipAddress: string | undefined;
  linkId: string;
  organizationId: string;
  referrer: string | undefined;
  requestId: string;
  userAgent: string | undefined;
};

type SanitizedCapture = {
  country: string;
  day: Date;
  device: string;
  linkId: string;
  organizationId: string;
  referrerHost: string;
  requestId: string;
  visitorDigest: string | undefined;
  visitorExpiresAt: Date | undefined;
};

type AnalyticsCaptureDatabase = Pick<typeof analyticsPrisma, "$transaction">;

type AnalyticsCaptureDependencies = {
  database: AnalyticsCaptureDatabase;
  now: () => Date;
  visitorSecret: string;
};

@Injectable()
export class AnalyticsCaptureService {
  private activeCaptures = 0;
  private readonly logger = new Logger(AnalyticsCaptureService.name);
  private dependencies: AnalyticsCaptureDependencies = {
    database: analyticsPrisma,
    now: () => new Date(),
    visitorSecret: getConfig().analyticsVisitorSecret,
  };

  static forTesting(overrides: Partial<AnalyticsCaptureDependencies>): AnalyticsCaptureService {
    const service = new AnalyticsCaptureService();
    service.dependencies = { ...service.dependencies, ...overrides };
    return service;
  }

  tryCapture(input: AnalyticsCaptureInput): boolean {
    const startedAt = performance.now();
    if (this.activeCaptures >= MAX_CONCURRENT_CAPTURES) {
      this.logOutcome("dropped_capacity", input.requestId, startedAt);
      return false;
    }

    this.activeCaptures += 1;
    let capture: SanitizedCapture;
    try {
      capture = this.sanitize(input);
    } catch {
      this.activeCaptures -= 1;
      this.logOutcome("failed", input.requestId, startedAt);
      return false;
    }
    void Promise.resolve()
      .then(async () => this.persist(capture))
      .then(() => this.logOutcome("captured", capture.requestId, startedAt))
      .catch(() => this.logOutcome("failed", capture.requestId, startedAt))
      .finally(() => {
        this.activeCaptures -= 1;
      });
    return true;
  }

  private sanitize(input: AnalyticsCaptureInput): SanitizedCapture {
    const now = this.dependencies.now();
    const day = getAnalyticsDay(now);
    const ipAddress = normalizeTrustedIp(input.ipAddress);
    const visitorDigest = ipAddress
      ? createDailyVisitorDigest({
          day,
          ipAddress,
          linkId: input.linkId,
          organizationId: input.organizationId,
          secret: this.dependencies.visitorSecret,
        })
      : undefined;

    return {
      country: "Unknown",
      day,
      device: classifyDevice(input.userAgent),
      linkId: input.linkId,
      organizationId: input.organizationId,
      referrerHost: normalizeReferrerHost(input.referrer),
      requestId: input.requestId,
      visitorDigest,
      visitorExpiresAt: visitorDigest ? getVisitorExpiry(day) : undefined,
    };
  }

  private async persist(capture: SanitizedCapture): Promise<void> {
    await this.dependencies.database.$transaction(
      async (transaction) => {
        await transaction.linkAnalyticsDaily.upsert({
          create: {
            clicks: 1,
            day: capture.day,
            linkId: capture.linkId,
            organizationId: capture.organizationId,
          },
          update: { clicks: { increment: 1 } },
          where: {
            organizationId_linkId_day: {
              day: capture.day,
              linkId: capture.linkId,
              organizationId: capture.organizationId,
            },
          },
        });

        let isUniqueVisitor = false;
        if (capture.visitorDigest && capture.visitorExpiresAt) {
          const visitor = await transaction.linkAnalyticsVisitor.createMany({
            data: {
              day: capture.day,
              expiresAt: capture.visitorExpiresAt,
              linkId: capture.linkId,
              organizationId: capture.organizationId,
              visitorDigest: capture.visitorDigest,
            },
            skipDuplicates: true,
          });
          isUniqueVisitor = visitor.count === 1;
        }

        if (isUniqueVisitor) {
          await transaction.linkAnalyticsDaily.update({
            data: { uniqueVisitors: { increment: 1 } },
            where: {
              organizationId_linkId_day: {
                day: capture.day,
                linkId: capture.linkId,
                organizationId: capture.organizationId,
              },
            },
          });
        }

        const referrerHost = await this.getStoredReferrerHost(transaction, capture);
        await Promise.all([
          this.incrementDimension(
            transaction,
            capture,
            AnalyticsDimension.COUNTRY,
            capture.country,
          ),
          this.incrementDimension(transaction, capture, AnalyticsDimension.DEVICE, capture.device),
          this.incrementDimension(transaction, capture, AnalyticsDimension.REFERRER, referrerHost),
        ]);
      },
      { maxWait: 100, timeout: 500 },
    );
  }

  private async getStoredReferrerHost(
    transaction: Prisma.TransactionClient,
    capture: SanitizedCapture,
  ): Promise<string> {
    if (["direct", "other", "unknown"].includes(capture.referrerHost)) return capture.referrerHost;

    const where = {
      organizationId_linkId_day_dimension_value: {
        day: capture.day,
        dimension: AnalyticsDimension.REFERRER,
        linkId: capture.linkId,
        organizationId: capture.organizationId,
        value: capture.referrerHost,
      },
    };
    const existing = await transaction.linkAnalyticsDimensionDaily.findUnique({ where });
    if (existing) return capture.referrerHost;

    const hostCount = await transaction.linkAnalyticsDimensionDaily.count({
      where: {
        day: capture.day,
        dimension: AnalyticsDimension.REFERRER,
        linkId: capture.linkId,
        organizationId: capture.organizationId,
        value: { notIn: ["direct", "other", "unknown"] },
      },
    });
    return hostCount >= MAX_REFERRER_HOSTS_PER_LINK_DAY ? "other" : capture.referrerHost;
  }

  private async incrementDimension(
    transaction: Prisma.TransactionClient,
    capture: SanitizedCapture,
    dimension: AnalyticsDimension,
    value: string,
  ): Promise<void> {
    await transaction.linkAnalyticsDimensionDaily.upsert({
      create: {
        clicks: 1,
        day: capture.day,
        dimension,
        linkId: capture.linkId,
        organizationId: capture.organizationId,
        value,
      },
      update: { clicks: { increment: 1 } },
      where: {
        organizationId_linkId_day_dimension_value: {
          day: capture.day,
          dimension,
          linkId: capture.linkId,
          organizationId: capture.organizationId,
          value,
        },
      },
    });
  }

  private logOutcome(
    outcome: "captured" | "dropped_capacity" | "failed",
    requestId: string,
    startedAt: number,
  ): void {
    this.logger.log(
      JSON.stringify({
        durationMs: Math.round(performance.now() - startedAt),
        event: "redirect_analytics",
        outcome,
        requestId,
        status: 302,
      }),
    );
  }
}
