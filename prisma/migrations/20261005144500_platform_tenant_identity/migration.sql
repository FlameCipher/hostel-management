ALTER TABLE "Organization"
ADD COLUMN "platformOrganizationId" TEXT,
ADD COLUMN "platformProductCode" TEXT;

CREATE UNIQUE INDEX "Organization_platformOrganizationId_key"
ON "Organization"("platformOrganizationId");
