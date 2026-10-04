ALTER TABLE "Student" ADD COLUMN "portalEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Student" ADD COLUMN "portalPasswordHash" TEXT;
ALTER TABLE "Student" ADD COLUMN "portalLastLoginAt" TIMESTAMP(3);
