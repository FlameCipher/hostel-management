-- Auditable accommodation pricing, room-stay history and rent adjustments.

CREATE TYPE "StorageChargeMode" AS ENUM (
  'MONTHLY_RATE_MONTHS',
  'FLAT_AMOUNT',
  'PERCENTAGE_MONTHLY_RATE'
);

CREATE TYPE "RentCalculationMethod" AS ENUM (
  'KEEP_FULL',
  'STANDARD_RATE',
  'ACTUAL_DAYS',
  'CUSTOM'
);

CREATE TYPE "ChargeAdjustmentReason" AS ENUM (
  'ROOM_TRANSFER',
  'EARLY_CHECKOUT',
  'RATE_CORRECTION',
  'DISCOUNT',
  'BREAK_STORAGE',
  'MANUAL'
);

ALTER TABLE "BreakPeriod"
ADD COLUMN "storageChargeMode" "StorageChargeMode" NOT NULL DEFAULT 'MONTHLY_RATE_MONTHS',
ADD COLUMN "storageChargeValue" DECIMAL(12,2);

ALTER TABLE "BreakReservation"
ADD COLUMN "finalCharge" DECIMAL(12,2),
ADD COLUMN "chargeOverrideReason" TEXT;

UPDATE "BreakReservation"
SET "finalCharge" = "potentialCharge"
WHERE "finalCharge" IS NULL;

ALTER TABLE "SemesterCharge"
ADD COLUMN "baseAmount" DECIMAL(12,2);

UPDATE "SemesterCharge"
SET "baseAmount" = "amount"
WHERE "baseAmount" IS NULL;

CREATE TABLE "RoomRateHistory" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "roomTypeId" TEXT NOT NULL,
  "monthlyRate" DECIMAL(12,2) NOT NULL,
  "semesterRate" DECIMAL(12,2) NOT NULL,
  "effectiveAt" TIMESTAMP(3) NOT NULL,
  "changedById" TEXT,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RoomRateHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OccupancyRoomStay" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "occupancyId" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "roomTypeId" TEXT NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3),
  "monthlyRateSnapshot" DECIMAL(12,2) NOT NULL,
  "semesterRateSnapshot" DECIMAL(12,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OccupancyRoomStay_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChargeAdjustment" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "chargeId" TEXT NOT NULL,
  "createdById" TEXT,
  "reason" "ChargeAdjustmentReason" NOT NULL,
  "calculationMethod" "RentCalculationMethod" NOT NULL,
  "previousAmount" DECIMAL(12,2) NOT NULL,
  "newAmount" DECIMAL(12,2) NOT NULL,
  "adjustmentAmount" DECIMAL(12,2) NOT NULL,
  "effectiveDate" TIMESTAMP(3) NOT NULL,
  "explanation" TEXT NOT NULL,
  "calculationData" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChargeAdjustment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RoomRateHistory_organizationId_effectiveAt_idx"
ON "RoomRateHistory"("organizationId", "effectiveAt");

CREATE INDEX "RoomRateHistory_roomTypeId_effectiveAt_idx"
ON "RoomRateHistory"("roomTypeId", "effectiveAt");

CREATE INDEX "OccupancyRoomStay_organizationId_startDate_idx"
ON "OccupancyRoomStay"("organizationId", "startDate");

CREATE INDEX "OccupancyRoomStay_occupancyId_startDate_idx"
ON "OccupancyRoomStay"("occupancyId", "startDate");

CREATE INDEX "OccupancyRoomStay_roomId_endDate_idx"
ON "OccupancyRoomStay"("roomId", "endDate");

CREATE UNIQUE INDEX "OccupancyRoomStay_one_open_per_occupancy_idx"
ON "OccupancyRoomStay"("occupancyId")
WHERE "endDate" IS NULL;

CREATE INDEX "ChargeAdjustment_organizationId_createdAt_idx"
ON "ChargeAdjustment"("organizationId", "createdAt");

CREATE INDEX "ChargeAdjustment_chargeId_createdAt_idx"
ON "ChargeAdjustment"("chargeId", "createdAt");

ALTER TABLE "RoomRateHistory"
ADD CONSTRAINT "RoomRateHistory_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RoomRateHistory"
ADD CONSTRAINT "RoomRateHistory_roomTypeId_fkey"
FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OccupancyRoomStay"
ADD CONSTRAINT "OccupancyRoomStay_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OccupancyRoomStay"
ADD CONSTRAINT "OccupancyRoomStay_occupancyId_fkey"
FOREIGN KEY ("occupancyId") REFERENCES "Occupancy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OccupancyRoomStay"
ADD CONSTRAINT "OccupancyRoomStay_roomId_fkey"
FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OccupancyRoomStay"
ADD CONSTRAINT "OccupancyRoomStay_roomTypeId_fkey"
FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ChargeAdjustment"
ADD CONSTRAINT "ChargeAdjustment_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChargeAdjustment"
ADD CONSTRAINT "ChargeAdjustment_chargeId_fkey"
FOREIGN KEY ("chargeId") REFERENCES "SemesterCharge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ChargeAdjustment"
ADD CONSTRAINT "ChargeAdjustment_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "RoomRateHistory" (
  "id", "organizationId", "roomTypeId", "monthlyRate", "semesterRate", "effectiveAt", "reason"
)
SELECT
  'rate_' || md5(random()::text || clock_timestamp()::text || rt."id"),
  rt."organizationId",
  rt."id",
  rt."monthlyRate",
  rt."semesterRate",
  rt."createdAt",
  'Opening rate snapshot'
FROM "RoomType" rt;

INSERT INTO "OccupancyRoomStay" (
  "id", "organizationId", "occupancyId", "roomId", "roomTypeId", "startDate", "endDate",
  "monthlyRateSnapshot", "semesterRateSnapshot", "createdAt", "updatedAt"
)
SELECT
  'stay_' || md5(random()::text || clock_timestamp()::text || o."id"),
  o."organizationId",
  o."id",
  o."roomId",
  r."roomTypeId",
  o."checkInAt",
  o."checkedOutAt",
  rt."monthlyRate",
  rt."semesterRate",
  o."createdAt",
  CURRENT_TIMESTAMP
FROM "Occupancy" o
JOIN "Room" r ON r."id" = o."roomId"
JOIN "RoomType" rt ON rt."id" = r."roomTypeId";
