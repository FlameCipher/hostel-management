/*
  Warnings:

  - A unique constraint covering the columns `[breakReservationId]` on the table `SemesterCharge` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `organizationId` to the `SemesterCharge` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ChargeType" AS ENUM ('SEMESTER_RENT', 'BREAK_ACCOMMODATION', 'DAMAGE', 'OTHER');

-- CreateEnum
CREATE TYPE "BreakPeriodStatus" AS ENUM ('UPCOMING', 'ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "BreakIntent" AS ENUM ('UNDECIDED', 'RETURNING', 'NOT_RETURNING');

-- CreateEnum
CREATE TYPE "BreakReservationStatus" AS ENUM ('PENDING', 'RESERVED_FREE', 'RETURN_CONFIRMED', 'CLEARANCE_REQUIRED', 'VACATED_CLEARED', 'RETURN_CANCELLED', 'CHARGED');

-- DropIndex
DROP INDEX "SemesterCharge_occupancyId_key";

-- DropIndex
DROP INDEX "SemesterCharge_semesterId_studentId_key";

-- DropIndex
DROP INDEX "SemesterCharge_status_dueDate_idx";

-- AlterTable
ALTER TABLE "SemesterCharge" ADD COLUMN     "breakReservationId" TEXT,
ADD COLUMN     "organizationId" TEXT NOT NULL,
ADD COLUMN     "type" "ChargeType" NOT NULL DEFAULT 'SEMESTER_RENT',
ALTER COLUMN "semesterId" DROP NOT NULL,
ALTER COLUMN "occupancyId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "BreakPeriod" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "months" INTEGER NOT NULL DEFAULT 3,
    "status" "BreakPeriodStatus" NOT NULL DEFAULT 'UPCOMING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BreakPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BreakReservation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "breakPeriodId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "intent" "BreakIntent" NOT NULL DEFAULT 'UNDECIDED',
    "status" "BreakReservationStatus" NOT NULL DEFAULT 'PENDING',
    "belongingsStored" BOOLEAN NOT NULL DEFAULT false,
    "monthlyRateSnapshot" DECIMAL(12,2) NOT NULL,
    "potentialCharge" DECIMAL(12,2) NOT NULL,
    "declaredAt" TIMESTAMP(3),
    "clearedAt" TIMESTAMP(3),
    "returnConfirmedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BreakReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceiptSequence" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "lastIssued" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReceiptSequence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BreakPeriod_organizationId_status_idx" ON "BreakPeriod"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BreakPeriod_organizationId_name_key" ON "BreakPeriod"("organizationId", "name");

-- CreateIndex
CREATE INDEX "BreakReservation_organizationId_status_idx" ON "BreakReservation"("organizationId", "status");

-- CreateIndex
CREATE INDEX "BreakReservation_roomId_status_idx" ON "BreakReservation"("roomId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BreakReservation_breakPeriodId_studentId_key" ON "BreakReservation"("breakPeriodId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "ReceiptSequence_organizationId_year_key" ON "ReceiptSequence"("organizationId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "SemesterCharge_breakReservationId_key" ON "SemesterCharge"("breakReservationId");

-- CreateIndex
CREATE INDEX "SemesterCharge_organizationId_status_dueDate_idx" ON "SemesterCharge"("organizationId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "SemesterCharge_studentId_createdAt_idx" ON "SemesterCharge"("studentId", "createdAt");

-- AddForeignKey
ALTER TABLE "BreakPeriod" ADD CONSTRAINT "BreakPeriod_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreakReservation" ADD CONSTRAINT "BreakReservation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreakReservation" ADD CONSTRAINT "BreakReservation_breakPeriodId_fkey" FOREIGN KEY ("breakPeriodId") REFERENCES "BreakPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreakReservation" ADD CONSTRAINT "BreakReservation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreakReservation" ADD CONSTRAINT "BreakReservation_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SemesterCharge" ADD CONSTRAINT "SemesterCharge_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SemesterCharge" ADD CONSTRAINT "SemesterCharge_breakReservationId_fkey" FOREIGN KEY ("breakReservationId") REFERENCES "BreakReservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptSequence" ADD CONSTRAINT "ReceiptSequence_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
