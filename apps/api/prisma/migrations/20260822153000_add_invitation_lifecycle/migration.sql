ALTER TABLE "Invitation" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Session" ADD COLUMN "activeOrganizationId" TEXT;
CREATE INDEX "Invitation_expiresAt_idx" ON "Invitation"("expiresAt");
