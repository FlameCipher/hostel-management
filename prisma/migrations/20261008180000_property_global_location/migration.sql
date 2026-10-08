ALTER TABLE "Property"
  ADD COLUMN "countryCode" TEXT,
  ADD COLUMN "city" TEXT,
  ADD COLUMN "region" TEXT,
  ADD COLUMN "postalCode" TEXT,
  ADD COLUMN "latitude" DOUBLE PRECISION,
  ADD COLUMN "longitude" DOUBLE PRECISION,
  ADD COLUMN "timeZone" TEXT,
  ADD COLUMN "rentPaymentMethods" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "Property" ADD CONSTRAINT "Property_location_coordinates_check"
  CHECK (("latitude" IS NULL AND "longitude" IS NULL) OR
    ("latitude" IS NOT NULL AND "longitude" IS NOT NULL AND
     "latitude" BETWEEN -90 AND 90 AND "longitude" BETWEEN -180 AND 180));
CREATE INDEX "Property_countryCode_city_idx" ON "Property"("countryCode", "city");

-- Only the previously identified MMAMBUGUA property has a confirmed location.
-- Other properties must supply their own location; do not default them to Kenya.
UPDATE "Property" SET "countryCode" = 'KE', "city" = 'Juja', "region" = 'Kiambu', "timeZone" = 'Africa/Nairobi'
WHERE "id" = 'property-mama-mbugua-hostel' AND "organizationId" = 'mama-mbugua-hostel';
