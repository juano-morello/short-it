CREATE TABLE "User" (
  "id" TEXT NOT NULL, "name" TEXT NOT NULL, "email" TEXT NOT NULL,
  "emailVerified" BOOLEAN NOT NULL DEFAULT false, "image" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Session" (
  "id" TEXT NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL, "token" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, "ipAddress" TEXT, "userAgent" TEXT, "userId" TEXT NOT NULL,
  CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Account" (
  "id" TEXT NOT NULL, "accountId" TEXT NOT NULL, "providerId" TEXT NOT NULL, "issuer" TEXT, "userId" TEXT NOT NULL,
  "accessToken" TEXT, "refreshToken" TEXT, "idToken" TEXT, "accessTokenExpiresAt" TIMESTAMP(3),
  "refreshTokenExpiresAt" TIMESTAMP(3), "scope" TEXT, "password" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Verification" (
  "id" TEXT NOT NULL, "identifier" TEXT NOT NULL, "value" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Organization" (
  "id" TEXT NOT NULL, "name" TEXT NOT NULL, "slug" TEXT NOT NULL, "logo" TEXT, "metadata" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Member" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "userId" TEXT NOT NULL, "role" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Invitation" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "email" TEXT NOT NULL, "role" TEXT,
  "status" TEXT NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL, "inviterId" TEXT NOT NULL,
  CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Link" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "slug" TEXT NOT NULL, "destinationUrl" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "publishedAt" TIMESTAMP(3),
  CONSTRAINT "Link_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");
CREATE UNIQUE INDEX "Account_providerId_accountId_key" ON "Account"("providerId", "accountId");
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");
CREATE UNIQUE INDEX "Member_organizationId_userId_key" ON "Member"("organizationId", "userId");
CREATE UNIQUE INDEX "Link_organizationId_slug_key" ON "Link"("organizationId", "slug");
CREATE INDEX "Member_userId_idx" ON "Member"("userId");
CREATE INDEX "Invitation_organizationId_email_idx" ON "Invitation"("organizationId", "email");
CREATE INDEX "Link_organizationId_createdAt_idx" ON "Link"("organizationId", "createdAt");
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
ALTER TABLE "Member" ADD CONSTRAINT "Member_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE;
ALTER TABLE "Member" ADD CONSTRAINT "Member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE;
ALTER TABLE "Link" ADD CONSTRAINT "Link_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE;
