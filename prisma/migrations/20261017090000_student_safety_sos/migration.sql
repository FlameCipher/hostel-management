-- Additive SOS incident table; location is supplied only after an explicit
-- resident action. No historical student-location backfill or tracking.
CREATE TABLE "SafetyAlert" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "roomLabel" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "note" TEXT,
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "accuracyMeters" DOUBLE PRECISION,
  "locationSharedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "acknowledgedAt" TIMESTAMP(3),
  "acknowledgedById" TEXT,
  "closedAt" TIMESTAMP(3),
  "closedById" TEXT,
  "closureNote" TEXT,
  CONSTRAINT "SafetyAlert_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SafetyAlert_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SafetyAlert_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "Student"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SafetyAlert_coordinate_pair_check"
    CHECK (("latitude" IS NULL AND "longitude" IS NULL) OR
      ("latitude" BETWEEN -90 AND 90 AND "longitude" BETWEEN -180 AND 180))
);
CREATE UNIQUE INDEX "SafetyAlert_organizationId_studentId_requestId_key"
  ON "SafetyAlert"("organizationId","studentId","requestId");
CREATE INDEX "SafetyAlert_organizationId_status_createdAt_idx"
  ON "SafetyAlert"("organizationId","status","createdAt");
CREATE INDEX "SafetyAlert_organizationId_studentId_createdAt_idx"
  ON "SafetyAlert"("organizationId","studentId","createdAt");
CREATE INDEX "SafetyAlert_locationSharedAt_idx" ON "SafetyAlert"("locationSharedAt");
