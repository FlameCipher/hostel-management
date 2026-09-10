-- Add student email for automatic receipt delivery.
ALTER TABLE "Student"
ADD COLUMN "email" TEXT;

-- Preserve the accommodation type selected before a specific room is allocated.
ALTER TABLE "SemesterCharge"
ADD COLUMN "roomTypeId" TEXT;

CREATE INDEX "SemesterCharge_roomTypeId_idx"
ON "SemesterCharge"("roomTypeId");

ALTER TABLE "SemesterCharge"
ADD CONSTRAINT "SemesterCharge_roomTypeId_fkey"
FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- Track whether a completed receipt was emailed or handed off to WhatsApp.
CREATE TYPE "ReceiptDeliveryChannel" AS ENUM ('EMAIL', 'WHATSAPP');
CREATE TYPE "ReceiptDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'ACTION_REQUIRED', 'FAILED');

ALTER TABLE "Payment"
ADD COLUMN "receiptDeliveryChannel" "ReceiptDeliveryChannel",
ADD COLUMN "receiptDeliveryStatus" "ReceiptDeliveryStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "receiptDeliveredAt" TIMESTAMP(3),
ADD COLUMN "receiptDeliveryError" TEXT;
