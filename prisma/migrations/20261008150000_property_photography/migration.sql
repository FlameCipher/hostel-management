CREATE UNIQUE INDEX "Property_id_organizationId_key" ON "Property"("id", "organizationId");
CREATE TABLE "PropertyPhoto" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "uploadedById" TEXT NOT NULL,
  "pathname" TEXT NOT NULL,
  "url" TEXT,
  "caption" TEXT NOT NULL DEFAULT '',
  "visible" BOOLEAN NOT NULL DEFAULT false,
  "isCover" BOOLEAN NOT NULL DEFAULT false,
  "expiresAt" TIMESTAMP(3),
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PropertyPhoto_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PropertyPhoto_propertyId_organizationId_fkey" FOREIGN KEY ("propertyId", "organizationId") REFERENCES "Property"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PropertyPhoto_pathname_key" ON "PropertyPhoto"("pathname");
CREATE INDEX "PropertyPhoto_organizationId_propertyId_deletedAt_idx" ON "PropertyPhoto"("organizationId", "propertyId", "deletedAt");
UPDATE "Property" SET "customDomain"='mmambugua.studentshostels.com'
WHERE "organizationId"='mama-mbugua-hostel' AND slug='mmambugua-hostel'
AND "customDomain" IN ('mmabugua.studentshostels.com','mmambuguahostel.studentshostels.com');
