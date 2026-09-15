CREATE TYPE "StudentDetailsUpdateStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "StudentDetailsUpdateRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "submittedName" TEXT NOT NULL,
    "submittedPhone" TEXT NOT NULL,
    "email" TEXT,
    "admissionNumber" TEXT,
    "nationalId" TEXT,
    "guardianName" TEXT NOT NULL,
    "guardianPhone" TEXT NOT NULL,
    "guardianRelationship" TEXT NOT NULL,
    "guardianEmail" TEXT,
    "status" "StudentDetailsUpdateStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "consentConfirmedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StudentDetailsUpdateRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PublicStudentLookupAttempt" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "fingerprintHash" TEXT NOT NULL,
    "matched" BOOLEAN NOT NULL DEFAULT false,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PublicStudentLookupAttempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StudentDetailsUpdateRequest_organizationId_status_createdAt_idx"
ON "StudentDetailsUpdateRequest"("organizationId", "status", "createdAt");

CREATE INDEX "StudentDetailsUpdateRequest_studentId_createdAt_idx"
ON "StudentDetailsUpdateRequest"("studentId", "createdAt");

CREATE UNIQUE INDEX "StudentDetailsUpdateRequest_one_pending_per_student"
ON "StudentDetailsUpdateRequest"("studentId")
WHERE "status" = 'PENDING';

CREATE INDEX "PublicStudentLookupAttempt_fingerprintHash_attemptedAt_idx"
ON "PublicStudentLookupAttempt"("fingerprintHash", "attemptedAt");

CREATE INDEX "PublicStudentLookupAttempt_organizationId_attemptedAt_idx"
ON "PublicStudentLookupAttempt"("organizationId", "attemptedAt");

ALTER TABLE "StudentDetailsUpdateRequest"
ADD CONSTRAINT "StudentDetailsUpdateRequest_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StudentDetailsUpdateRequest"
ADD CONSTRAINT "StudentDetailsUpdateRequest_studentId_fkey"
FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StudentDetailsUpdateRequest"
ADD CONSTRAINT "StudentDetailsUpdateRequest_reviewedById_fkey"
FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PublicStudentLookupAttempt"
ADD CONSTRAINT "PublicStudentLookupAttempt_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
