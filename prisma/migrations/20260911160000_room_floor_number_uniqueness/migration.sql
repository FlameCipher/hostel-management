-- Use normalized keys so room numbers cannot be duplicated on the same floor.
-- The previous constraint was organization-wide and incorrectly prevented the
-- same room number from being used on different floors.
ALTER TABLE "Room"
ADD COLUMN "numberKey" TEXT,
ADD COLUMN "floorKey" TEXT;

UPDATE "Room"
SET
  "numberKey" = LOWER(REGEXP_REPLACE(BTRIM("number"), '\s+', ' ', 'g')),
  "floorKey" = LOWER(REGEXP_REPLACE(BTRIM(COALESCE("floor", '')), '\s+', ' ', 'g'));

ALTER TABLE "Room"
ALTER COLUMN "numberKey" SET NOT NULL,
ALTER COLUMN "floorKey" SET NOT NULL;

ALTER TABLE "Room"
DROP CONSTRAINT IF EXISTS "Room_organizationId_number_key";

CREATE UNIQUE INDEX "Room_organizationId_floorKey_numberKey_key"
ON "Room"("organizationId", "floorKey", "numberKey");
