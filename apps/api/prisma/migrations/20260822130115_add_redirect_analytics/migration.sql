-- DropForeignKey
ALTER TABLE "Account" DROP CONSTRAINT "Account_userId_fkey";

-- DropForeignKey
ALTER TABLE "Invitation" DROP CONSTRAINT "Invitation_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "Link" DROP CONSTRAINT "Link_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "Member" DROP CONSTRAINT "Member_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "Member" DROP CONSTRAINT "Member_userId_fkey";

-- DropForeignKey
ALTER TABLE "Session" DROP CONSTRAINT "Session_userId_fkey";

-- CreateTable
CREATE TABLE "LinkAnalyticsDay" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "day" TIMESTAMP(3) NOT NULL,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "uniqueVisitors" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LinkAnalyticsDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LinkAnalyticsBreakdown" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "day" TIMESTAMP(3) NOT NULL,
    "country" TEXT NOT NULL,
    "deviceCategory" TEXT NOT NULL,
    "referrerHost" TEXT NOT NULL,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LinkAnalyticsBreakdown_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LinkAnalyticsDailyVisitor" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "day" TIMESTAMP(3) NOT NULL,
    "visitorDigest" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LinkAnalyticsDailyVisitor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LinkAnalyticsDay_organizationId_day_idx" ON "LinkAnalyticsDay"("organizationId", "day");

-- CreateIndex
CREATE INDEX "LinkAnalyticsDay_linkId_day_idx" ON "LinkAnalyticsDay"("linkId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "LinkAnalyticsDay_organizationId_linkId_day_key" ON "LinkAnalyticsDay"("organizationId", "linkId", "day");

-- CreateIndex
CREATE INDEX "LinkAnalyticsBreakdown_organizationId_day_idx" ON "LinkAnalyticsBreakdown"("organizationId", "day");

-- CreateIndex
CREATE INDEX "LinkAnalyticsBreakdown_linkId_day_idx" ON "LinkAnalyticsBreakdown"("linkId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "LinkAnalyticsBreakdown_organizationId_linkId_day_country_de_key" ON "LinkAnalyticsBreakdown"("organizationId", "linkId", "day", "country", "deviceCategory", "referrerHost");

-- CreateIndex
CREATE INDEX "LinkAnalyticsDailyVisitor_expiresAt_idx" ON "LinkAnalyticsDailyVisitor"("expiresAt");

-- CreateIndex
CREATE INDEX "LinkAnalyticsDailyVisitor_organizationId_linkId_day_idx" ON "LinkAnalyticsDailyVisitor"("organizationId", "linkId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "LinkAnalyticsDailyVisitor_organizationId_linkId_day_visitor_key" ON "LinkAnalyticsDailyVisitor"("organizationId", "linkId", "day", "visitorDigest");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Link" ADD CONSTRAINT "Link_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkAnalyticsDay" ADD CONSTRAINT "LinkAnalyticsDay_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkAnalyticsDay" ADD CONSTRAINT "LinkAnalyticsDay_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "Link"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkAnalyticsBreakdown" ADD CONSTRAINT "LinkAnalyticsBreakdown_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkAnalyticsBreakdown" ADD CONSTRAINT "LinkAnalyticsBreakdown_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "Link"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkAnalyticsDailyVisitor" ADD CONSTRAINT "LinkAnalyticsDailyVisitor_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkAnalyticsDailyVisitor" ADD CONSTRAINT "LinkAnalyticsDailyVisitor_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "Link"("id") ON DELETE CASCADE ON UPDATE CASCADE;
