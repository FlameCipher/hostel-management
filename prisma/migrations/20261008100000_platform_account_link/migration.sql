ALTER TABLE "User" ADD COLUMN "platformUserId" TEXT;
CREATE UNIQUE INDEX "User_organizationId_platformUserId_key" ON "User"("organizationId", "platformUserId");
CREATE TABLE "PlatformSsoGrant" ("id" TEXT NOT NULL, "tokenHash" TEXT NOT NULL, "challenge" TEXT NOT NULL, "attempts" INTEGER NOT NULL DEFAULT 0, "platformUserId" TEXT NOT NULL, "platformOrganizationId" TEXT NOT NULL, "sessionVersion" INTEGER NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL, "consumedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "PlatformSsoGrant_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "PlatformSsoGrant_tokenHash_key" ON "PlatformSsoGrant"("tokenHash");
CREATE INDEX "PlatformSsoGrant_expiresAt_idx" ON "PlatformSsoGrant"("expiresAt");
