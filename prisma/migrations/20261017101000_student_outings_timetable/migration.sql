-- Additive multi-hostel, resident-owned safety check-in and academic schedule.
-- No historical whereabouts collected. No finances, room allocations or residents changed.
CREATE TABLE "StudentOuting" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "occupancyId" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "roomLabel" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OUT',
  "leftAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "initialExpectedReturnAt" TIMESTAMP(3) NOT NULL,
  "expectedReturnAt" TIMESTAMP(3) NOT NULL,
  "lateNotifiedAt" TIMESTAMP(3),
  "lateMessage" TEXT,
  "lateAcknowledgedAt" TIMESTAMP(3),
  "lateAcknowledgedById" TEXT,
  "studentReturnedAt" TIMESTAMP(3),
  "verifiedReturnAt" TIMESTAMP(3),
  "verifiedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudentOuting_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StudentOuting_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
      ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StudentOuting_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "Student"("id")
      ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StudentOuting_status_check"
    CHECK ("status" IN ('OUT','RETURN_REPORTED','VERIFIED_RETURN')),
  CONSTRAINT "StudentOuting_return_order_check"
    CHECK ("expectedReturnAt" > "leftAt")
);
CREATE UNIQUE INDEX "StudentOuting_organizationId_studentId_requestId_key"
  ON "StudentOuting"("organizationId","studentId","requestId");
CREATE INDEX "StudentOuting_organizationId_status_expectedReturnAt_idx"
  ON "StudentOuting"("organizationId","status","expectedReturnAt");
CREATE INDEX "StudentOuting_organizationId_studentId_createdAt_idx"
  ON "StudentOuting"("organizationId","studentId","createdAt");

CREATE TABLE "StudentLesson" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "courseCode" TEXT,
  "venue" TEXT,
  "dayOfWeek" INTEGER NOT NULL,
  "startMinutes" INTEGER NOT NULL,
  "endMinutes" INTEGER NOT NULL,
  "timeZone" TEXT NOT NULL,
  "remindBeforeMinutes" INTEGER NOT NULL DEFAULT 15,
  "reminderEnabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudentLesson_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StudentLesson_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
      ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StudentLesson_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "Student"("id")
      ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StudentLesson_day_time_check"
    CHECK ("dayOfWeek" BETWEEN 0 AND 6 AND
      "startMinutes" BETWEEN 0 AND 1439 AND
      "endMinutes" BETWEEN 1 AND 1440 AND
      "endMinutes">"startMinutes" AND
      "remindBeforeMinutes" IN (0,10,15,30,60))
);
CREATE INDEX "StudentLesson_organizationId_studentId_active_idx"
  ON "StudentLesson"("organizationId","studentId","active");
CREATE INDEX "StudentLesson_organizationId_propertyId_active_idx"
  ON "StudentLesson"("organizationId","propertyId","active");

ALTER TABLE "PushDelivery"
  ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'ACTIVITY',
  ADD COLUMN "targetUrl" TEXT;
