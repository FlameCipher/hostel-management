CREATE TABLE "CommunicationSettings" (
 "organizationId" TEXT NOT NULL PRIMARY KEY,
 "balanceEnabled" BOOLEAN NOT NULL DEFAULT false,
 "holidayEnabled" BOOLEAN NOT NULL DEFAULT false,
 "whatsappCopies" BOOLEAN NOT NULL DEFAULT false,
 CONSTRAINT "CommunicationSettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "TenantMessage" (
 "id" TEXT NOT NULL PRIMARY KEY, "organizationId" TEXT NOT NULL, "studentId" TEXT NOT NULL,
 "batchId" TEXT NOT NULL, "dedupKey" TEXT NOT NULL, "title" TEXT NOT NULL, "body" TEXT NOT NULL,
 "category" TEXT NOT NULL, "publishAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "readAt" TIMESTAMP(3), "notificationId" TEXT, "whatsappCopy" BOOLEAN NOT NULL DEFAULT false, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "TenantMessage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "TenantMessage_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "TenantMessage_organizationId_studentId_dedupKey_key" ON "TenantMessage"("organizationId", "studentId", "dedupKey");
CREATE UNIQUE INDEX "TenantMessage_notificationId_key" ON "TenantMessage"("notificationId");
CREATE INDEX "TenantMessage_organizationId_studentId_publishAt_idx" ON "TenantMessage"("organizationId", "studentId", "publishAt");
