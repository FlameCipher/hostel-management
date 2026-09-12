CREATE TABLE "PaymentReceiptLink" (
  "codeHash" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentReceiptLink_pkey" PRIMARY KEY ("codeHash")
);
CREATE INDEX "PaymentReceiptLink_paymentId_idx" ON "PaymentReceiptLink"("paymentId");
CREATE INDEX "PaymentReceiptLink_expiresAt_idx" ON "PaymentReceiptLink"("expiresAt");
ALTER TABLE "PaymentReceiptLink" ADD CONSTRAINT "PaymentReceiptLink_paymentId_fkey"
  FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
