-- Establish StudentsHostels as Product #1 and backfill one default property per existing organization.
-- Existing room IDs and operational records are preserved.

INSERT INTO "Product" ("id","code","name","domain","active","createdAt","updatedAt")
VALUES ('product_studentshostels','STUDENTSHOSTELS','StudentsHostels','studentshostels.com',true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE
SET "name" = EXCLUDED."name", "domain" = EXCLUDED."domain", "active" = true, "updatedAt" = CURRENT_TIMESTAMP;

UPDATE "Organization"
SET "slug" = 'org-' || lower(substr(md5("id"),1,12))
WHERE "slug" IS NULL;

INSERT INTO "Property" ("id","organizationId","slug","name","physicalAddress","phone","email","active","createdAt","updatedAt")
SELECT
  'property-' || o."id",
  o."id",
  CASE
    WHEN lower(o."name") LIKE '%mmambugua%' THEN 'mmambugua-hostel'
    ELSE 'main-property'
  END,
  o."name",
  o."physicalAddress",
  o."phone",
  o."email",
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Organization" o
WHERE NOT EXISTS (
  SELECT 1 FROM "Property" p WHERE p."organizationId" = o."id"
);

ALTER TABLE "Room" ADD COLUMN "propertyId" TEXT;

UPDATE "Room" r
SET "propertyId" = p."id"
FROM "Property" p
WHERE p."organizationId" = r."organizationId"
  AND r."propertyId" IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Room" WHERE "propertyId" IS NULL) THEN
    RAISE EXCEPTION 'Property backfill failed: one or more rooms have no property';
  END IF;
END $$;

ALTER TABLE "Room" ALTER COLUMN "propertyId" SET NOT NULL;
ALTER TABLE "Room" ADD CONSTRAINT "Room_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Room_propertyId_status_idx" ON "Room"("propertyId","status");
