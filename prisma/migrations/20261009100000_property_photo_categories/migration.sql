ALTER TABLE "PropertyPhoto" ADD COLUMN "category" TEXT, ADD COLUMN "roomTypeId" TEXT, ADD COLUMN "confirmedAt" TIMESTAMP(3);
ALTER TABLE "PropertyPhoto" ADD CONSTRAINT "PropertyPhoto_roomTypeId_organizationId_fkey" FOREIGN KEY ("roomTypeId", "organizationId") REFERENCES "RoomType"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PropertyPhoto" ADD CONSTRAINT "PropertyPhoto_category_check" CHECK (COALESCE((
 ("category" IS NULL AND "roomTypeId" IS NULL) OR
 ("category" IN ('EXTERIOR', 'COMPOUND') AND "roomTypeId" IS NULL AND "confirmedAt" IS NOT NULL) OR
 ("category" = 'ROOM' AND "roomTypeId" IS NOT NULL AND "confirmedAt" IS NOT NULL)
), false));
CREATE INDEX "PropertyPhoto_propertyId_category_roomTypeId_idx" ON "PropertyPhoto"("propertyId", "category", "roomTypeId");
-- Preserve older photographs for owner review. Their contents have not been classified.
UPDATE "PropertyPhoto" SET "visible" = false, "isCover" = false;

ALTER TABLE "TenantPortalInvitation" ADD COLUMN "activationHost" TEXT;
