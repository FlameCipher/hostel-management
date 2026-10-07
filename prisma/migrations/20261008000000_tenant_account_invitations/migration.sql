ALTER TABLE "Student" ADD COLUMN "portalInviteBlocked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CommunicationSettings" ADD COLUMN "inviteEnabled" BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE "TenantPortalInvitation" (
 "id" TEXT NOT NULL PRIMARY KEY, "organizationId" TEXT NOT NULL, "studentId" TEXT NOT NULL,
 "hostelName" TEXT NOT NULL, "generation" INTEGER NOT NULL DEFAULT 0, "tokenHash" TEXT,
 "recipient" TEXT, "sender" TEXT, "expiresAt" TIMESTAMP(3), "usedAt" TIMESTAMP(3),
 "status" TEXT NOT NULL DEFAULT 'QUEUED', "attempts" INTEGER NOT NULL DEFAULT 0,
 "attemptedAt" TIMESTAMP(3), "providerId" TEXT, "error" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "TenantPortalInvitation_tokenHash_key" ON "TenantPortalInvitation"("tokenHash");
CREATE UNIQUE INDEX "TenantPortalInvitation_organizationId_studentId_key" ON "TenantPortalInvitation"("organizationId","studentId");
CREATE INDEX "TenantPortalInvitation_organizationId_status_createdAt_idx" ON "TenantPortalInvitation"("organizationId","status","createdAt");
UPDATE "Student" s SET "portalInviteBlocked"=true WHERE s."portalEnabled"=false AND
 (s."portalLastLoginAt" IS NOT NULL OR s."portalPasswordHash" IS NOT NULL OR EXISTS
 (SELECT 1 FROM "AuditLog" a WHERE a."organizationId"=s."organizationId" AND a."entityId"=s.id AND a.action='STUDENT_PORTAL_DISABLED'));
INSERT INTO "CommunicationSettings" ("organizationId","inviteEnabled")
 SELECT id,true FROM "Organization" WHERE id='mama-mbugua-hostel'
 ON CONFLICT ("organizationId") DO UPDATE SET "inviteEnabled"=true;
