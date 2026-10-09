-- CreateTable
CREATE TABLE "AssistantRun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "principal" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'STARTED',
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistantRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "sessionVersion" INTEGER NOT NULL,
    "host" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastFingerprint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushDelivery" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "attemptAt" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppConnection" (
    "organizationId" TEXT NOT NULL,
    "phoneNumberId" TEXT NOT NULL,
    "displayPhone" TEXT NOT NULL,
    "apiVersion" TEXT NOT NULL,
    "businessAccountId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "templateLanguage" TEXT NOT NULL DEFAULT 'en',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppConnection_pkey" PRIMARY KEY ("organizationId")
);

-- CreateTable
CREATE TABLE "WhatsAppConsent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "consentText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppDelivery" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "phoneNumberId" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "providerId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "attemptAt" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationalRun" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "OperationalRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssistantRun_organizationId_principal_createdAt_idx" ON "AssistantRun"("organizationId", "principal", "createdAt");

-- CreateIndex
CREATE INDEX "AssistantRun_createdAt_idx" ON "AssistantRun"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_organizationId_accountId_enabled_idx" ON "PushSubscription"("organizationId", "accountId", "enabled");

-- CreateIndex
CREATE INDEX "PushDelivery_status_nextAttemptAt_idx" ON "PushDelivery"("status", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppConnection_phoneNumberId_key" ON "WhatsAppConnection"("phoneNumberId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppConsent_organizationId_accountId_audience_key" ON "WhatsAppConsent"("organizationId", "accountId", "audience");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppDelivery_notificationId_key" ON "WhatsAppDelivery"("notificationId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppDelivery_providerId_key" ON "WhatsAppDelivery"("providerId");

-- CreateIndex
CREATE INDEX "WhatsAppDelivery_status_nextAttemptAt_idx" ON "WhatsAppDelivery"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "OperationalRun_kind_createdAt_idx" ON "OperationalRun"("kind", "createdAt");

-- AddForeignKey
ALTER TABLE "AssistantRun" ADD CONSTRAINT "AssistantRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushDelivery" ADD CONSTRAINT "PushDelivery_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "PushSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppConnection" ADD CONSTRAINT "WhatsAppConnection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppDelivery" ADD CONSTRAINT "WhatsAppDelivery_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

