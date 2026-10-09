CREATE TABLE "VisitorRequest" (
 "id" TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL, "propertyId" TEXT NOT NULL, "studentId" TEXT NOT NULL,
 "occupancyId" TEXT NOT NULL, "requestId" TEXT NOT NULL, "visitorName" TEXT NOT NULL, "visitorPhone" TEXT NOT NULL,
 "purpose" TEXT NOT NULL, "vehicle" TEXT, "roomLabel" TEXT NOT NULL, "timeZone" TEXT NOT NULL,
 "expectedArrival" TIMESTAMP(3) NOT NULL, "expectedDeparture" TIMESTAMP(3) NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'REQUESTED', "checkedInAt" TIMESTAMP(3), "checkedOutAt" TIMESTAMP(3),
 "verifiedById" TEXT, "checkedOutById" TEXT, "reviewNote" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "VisitorRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "VisitorRequest_propertyId_organizationId_fkey" FOREIGN KEY ("propertyId","organizationId") REFERENCES "Property"(id,"organizationId") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "VisitorRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "VisitorRequest_state_check" CHECK ("status" IN ('REQUESTED','APPROVED','DENIED','CANCELLED','CHECKED_IN','CHECKED_OUT')),
 CONSTRAINT "VisitorRequest_dates_check" CHECK ("expectedDeparture">"expectedArrival"),
 CONSTRAINT "VisitorRequest_gate_check" CHECK (("status"='CHECKED_IN' AND "checkedInAt" IS NOT NULL AND "checkedOutAt" IS NULL) OR ("status"='CHECKED_OUT' AND "checkedInAt" IS NOT NULL AND "checkedOutAt">="checkedInAt") OR ("status" IN ('REQUESTED','APPROVED','DENIED','CANCELLED') AND "checkedInAt" IS NULL AND "checkedOutAt" IS NULL))
);
CREATE UNIQUE INDEX "VisitorRequest_organizationId_studentId_requestId_key" ON "VisitorRequest"("organizationId","studentId","requestId");
CREATE INDEX "VisitorRequest_organizationId_status_expectedDeparture_idx" ON "VisitorRequest"("organizationId","status","expectedDeparture");
CREATE INDEX "VisitorRequest_organizationId_studentId_createdAt_idx" ON "VisitorRequest"("organizationId","studentId","createdAt");
CREATE TABLE "TenantRegistration" (
 "id" TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL, "propertyId" TEXT NOT NULL, "studentId" TEXT,
 "requestId" TEXT NOT NULL, "fullName" TEXT NOT NULL, "phone" TEXT NOT NULL, "roomNumber" TEXT NOT NULL,
 "passwordHash" TEXT, "fingerprint" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'PENDING',
 "reviewedById" TEXT, "reviewedAt" TIMESTAMP(3), "expiresAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "TenantRegistration_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "TenantRegistration_propertyId_organizationId_fkey" FOREIGN KEY ("propertyId","organizationId") REFERENCES "Property"(id,"organizationId") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "TenantRegistration_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"(id) ON DELETE SET NULL ON UPDATE CASCADE,
 CONSTRAINT "TenantRegistration_status_check" CHECK ("status" IN ('PENDING','APPROVED','REJECTED','EXPIRED'))
);
CREATE UNIQUE INDEX "TenantRegistration_propertyId_requestId_key" ON "TenantRegistration"("propertyId","requestId");
CREATE INDEX "TenantRegistration_organizationId_status_createdAt_idx" ON "TenantRegistration"("organizationId","status","createdAt");
CREATE INDEX "TenantRegistration_fingerprint_createdAt_idx" ON "TenantRegistration"("fingerprint","createdAt");
