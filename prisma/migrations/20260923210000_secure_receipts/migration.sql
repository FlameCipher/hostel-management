ALTER TABLE "Payment"
ADD COLUMN "securityReference" TEXT,
ADD COLUMN "integrityHash" TEXT,
ADD COLUMN "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "reprintCount" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "Payment_securityReference_key" ON "Payment"("securityReference");
