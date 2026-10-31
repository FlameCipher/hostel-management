ALTER TYPE "PaymentReversalType" ADD VALUE 'GATEWAY_CONFIRMED';

-- CreateTable
CREATE TABLE "RentGateway" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "credentials" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RentGateway_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentPaymentRequest" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "chargeId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "gatewayId" TEXT NOT NULL,
    "createdById" TEXT,
    "amount" DECIMAL(15,3) NOT NULL,
    "currency" TEXT NOT NULL,
    "payerName" TEXT NOT NULL,
    "payerEmail" TEXT,
    "payerPhone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'READY',
    "trackingId" TEXT,
    "checkoutUrl" TEXT,
    "paymentId" TEXT,
    "confirmationCode" TEXT,
    "exception" TEXT,
    "emailStatus" TEXT NOT NULL DEFAULT 'NOT_SENT',
    "emailAttemptedAt" TIMESTAMP(3),
    "lastCheckedAt" TIMESTAMP(3),
    "nextCheckAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RentPaymentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RentGateway_organizationId_active_idx" ON "RentGateway"("organizationId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "RentPaymentRequest_token_key" ON "RentPaymentRequest"("token");

-- CreateIndex
CREATE UNIQUE INDEX "RentPaymentRequest_trackingId_key" ON "RentPaymentRequest"("trackingId");

-- CreateIndex
CREATE UNIQUE INDEX "RentPaymentRequest_paymentId_key" ON "RentPaymentRequest"("paymentId");

-- CreateIndex
CREATE INDEX "RentPaymentRequest_organizationId_createdAt_idx" ON "RentPaymentRequest"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "RentPaymentRequest_status_nextCheckAt_idx" ON "RentPaymentRequest"("status", "nextCheckAt");

-- AddForeignKey
ALTER TABLE "RentGateway" ADD CONSTRAINT "RentGateway_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentPaymentRequest" ADD CONSTRAINT "RentPaymentRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentPaymentRequest" ADD CONSTRAINT "RentPaymentRequest_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "SemesterCharge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentPaymentRequest" ADD CONSTRAINT "RentPaymentRequest_gatewayId_fkey" FOREIGN KEY ("gatewayId") REFERENCES "RentGateway"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentPaymentRequest" ADD CONSTRAINT "RentPaymentRequest_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

