ALTER TABLE "CommunicationSettings" ADD COLUMN "emailCopies" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TenantMessage" ADD COLUMN "emailCopy" BOOLEAN NOT NULL DEFAULT false,
 ADD COLUMN "emailStatus" TEXT NOT NULL DEFAULT 'NOT_REQUESTED', ADD COLUMN "emailRecipient" TEXT,
 ADD COLUMN "emailFrom" TEXT, ADD COLUMN "emailGeneration" INTEGER NOT NULL DEFAULT 0, ADD COLUMN "emailAttempts" INTEGER NOT NULL DEFAULT 0,
 ADD COLUMN "emailAttemptAt" TIMESTAMP(3), ADD COLUMN "emailProviderId" TEXT, ADD COLUMN "emailError" TEXT;
CREATE TABLE "TenantConversation" (
 "id" TEXT NOT NULL PRIMARY KEY, "organizationId" TEXT NOT NULL, "studentId" TEXT NOT NULL,
 "subject" TEXT NOT NULL, "category" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'OPEN',
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "TenantConversationEntry" (
 "id" TEXT NOT NULL PRIMARY KEY, "conversationId" TEXT NOT NULL, "requestId" TEXT NOT NULL,
 "author" TEXT NOT NULL, "authorUserId" TEXT, "body" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY ("conversationId") REFERENCES "TenantConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "TenantConversationEntry_requestId_key" ON "TenantConversationEntry"("requestId");
CREATE INDEX "TenantConversationEntry_conversationId_createdAt_idx" ON "TenantConversationEntry"("conversationId", "createdAt");
CREATE INDEX "TenantConversation_organizationId_studentId_updatedAt_idx" ON "TenantConversation"("organizationId", "studentId", "updatedAt");
