-- CreateEnum
CREATE TYPE "PaymentReversalType" AS ENUM ('INTERNAL_CORRECTION', 'MPESA_CONFIRMED');

-- CreateEnum
CREATE TYPE "ReconciliationStatus" AS ENUM ('UNMATCHED', 'MATCHED', 'AMOUNT_MISMATCH', 'REVERSED', 'IGNORED');

-- CreateEnum
CREATE TYPE "MpesaSource" AS ENUM ('MANUAL', 'CSV', 'CALLBACK');

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "reversalType" "PaymentReversalType",
ADD COLUMN     "reversedById" TEXT;

-- CreateTable
CREATE TABLE "MpesaTransaction" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "paymentId" TEXT,
    "transactionCode" TEXT NOT NULL,
    "phone" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "transactedAt" TIMESTAMP(3) NOT NULL,
    "reference" TEXT,
    "source" "MpesaSource" NOT NULL DEFAULT 'CSV',
    "status" "ReconciliationStatus" NOT NULL DEFAULT 'UNMATCHED',
    "matchedAt" TIMESTAMP(3),
    "notes" TEXT,
    "rawData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MpesaTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MpesaTransaction_paymentId_key" ON "MpesaTransaction"("paymentId");

-- CreateIndex
CREATE INDEX "MpesaTransaction_organizationId_status_transactedAt_idx" ON "MpesaTransaction"("organizationId", "status", "transactedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MpesaTransaction_organizationId_transactionCode_key" ON "MpesaTransaction"("organizationId", "transactionCode");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_reversedById_fkey" FOREIGN KEY ("reversedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MpesaTransaction" ADD CONSTRAINT "MpesaTransaction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MpesaTransaction" ADD CONSTRAINT "MpesaTransaction_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
