ALTER TYPE "NotificationRecipient" ADD VALUE IF NOT EXISTS 'STAFF';
ALTER TABLE "Notification" ADD COLUMN "recipientStaffId" TEXT;
CREATE INDEX "Notification_recipientStaffId_createdAt_idx" ON "Notification"("recipientStaffId", "createdAt");
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientStaffId_fkey" FOREIGN KEY ("recipientStaffId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
