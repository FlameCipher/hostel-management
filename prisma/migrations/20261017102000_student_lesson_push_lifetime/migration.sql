-- A lesson reminder can be cancelled if its class was removed or its
-- delivery deadline passed. No school content is persisted in the push job.
ALTER TABLE "PushDelivery" ADD COLUMN "subjectId" TEXT;
ALTER TABLE "PushDelivery" ADD COLUMN "expiresAt" TIMESTAMP(3);
CREATE INDEX "PushDelivery_kind_expiresAt_idx" ON "PushDelivery"("kind","expiresAt");
