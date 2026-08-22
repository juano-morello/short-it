CREATE TYPE "AnalyticsDimension" AS ENUM ('COUNTRY', 'DEVICE', 'REFERRER');

ALTER TABLE "LinkAnalyticsBreakdown" DROP CONSTRAINT "LinkAnalyticsBreakdown_linkId_fkey";
ALTER TABLE "LinkAnalyticsBreakdown" DROP CONSTRAINT "LinkAnalyticsBreakdown_organizationId_fkey";
ALTER TABLE "LinkAnalyticsDailyVisitor" DROP CONSTRAINT "LinkAnalyticsDailyVisitor_linkId_fkey";
ALTER TABLE "LinkAnalyticsDailyVisitor" DROP CONSTRAINT "LinkAnalyticsDailyVisitor_organizationId_fkey";
ALTER TABLE "LinkAnalyticsDay" DROP CONSTRAINT "LinkAnalyticsDay_linkId_fkey";
ALTER TABLE "LinkAnalyticsDay" DROP CONSTRAINT "LinkAnalyticsDay_organizationId_fkey";

DROP TABLE "LinkAnalyticsBreakdown";
DROP TABLE "LinkAnalyticsDailyVisitor";
DROP TABLE "LinkAnalyticsDay";

CREATE TABLE "LinkAnalyticsDaily" (
    "organizationId" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "uniqueVisitors" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LinkAnalyticsDaily_pkey" PRIMARY KEY ("organizationId", "linkId", "day")
);

CREATE TABLE "LinkAnalyticsDimensionDaily" (
    "organizationId" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "dimension" "AnalyticsDimension" NOT NULL,
    "value" VARCHAR(253) NOT NULL,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LinkAnalyticsDimensionDaily_pkey" PRIMARY KEY ("organizationId", "linkId", "day", "dimension", "value")
);

CREATE TABLE "LinkAnalyticsVisitor" (
    "organizationId" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "visitorDigest" CHAR(64) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LinkAnalyticsVisitor_pkey" PRIMARY KEY ("organizationId", "linkId", "day", "visitorDigest")
);

CREATE INDEX "LinkAnalyticsDaily_organizationId_day_idx" ON "LinkAnalyticsDaily"("organizationId", "day");
CREATE INDEX "LinkAnalyticsDaily_day_idx" ON "LinkAnalyticsDaily"("day");
CREATE INDEX "LinkAnalyticsDimensionDaily_organizationId_dimension_day_idx" ON "LinkAnalyticsDimensionDaily"("organizationId", "dimension", "day");
CREATE INDEX "LinkAnalyticsVisitor_expiresAt_idx" ON "LinkAnalyticsVisitor"("expiresAt");
CREATE UNIQUE INDEX "Link_organizationId_id_key" ON "Link"("organizationId", "id");

ALTER TABLE "LinkAnalyticsDaily" ADD CONSTRAINT "LinkAnalyticsDaily_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LinkAnalyticsDaily" ADD CONSTRAINT "LinkAnalyticsDaily_organizationId_linkId_fkey" FOREIGN KEY ("organizationId", "linkId") REFERENCES "Link"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LinkAnalyticsDimensionDaily" ADD CONSTRAINT "LinkAnalyticsDimensionDaily_organizationId_linkId_day_fkey" FOREIGN KEY ("organizationId", "linkId", "day") REFERENCES "LinkAnalyticsDaily"("organizationId", "linkId", "day") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LinkAnalyticsVisitor" ADD CONSTRAINT "LinkAnalyticsVisitor_organizationId_linkId_day_fkey" FOREIGN KEY ("organizationId", "linkId", "day") REFERENCES "LinkAnalyticsDaily"("organizationId", "linkId", "day") ON DELETE CASCADE ON UPDATE CASCADE;
