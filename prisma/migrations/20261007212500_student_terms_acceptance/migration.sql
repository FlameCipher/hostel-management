CREATE TABLE "StudentTermsAcceptance" (
 "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "studentId" TEXT NOT NULL,
 "occupancyId" TEXT NOT NULL, "version" TEXT NOT NULL, "reference" TEXT NOT NULL,
 "signatureName" TEXT NOT NULL, "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "snapshot" JSONB NOT NULL, "integrityHash" TEXT NOT NULL,
 CONSTRAINT "StudentTermsAcceptance_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StudentTermsAcceptance_reference_key" ON "StudentTermsAcceptance"("reference");
CREATE UNIQUE INDEX "StudentTermsAcceptance_scope_version_key" ON "StudentTermsAcceptance"("organizationId", "studentId", "occupancyId", "version");
CREATE INDEX "StudentTermsAcceptance_organizationId_acceptedAt_idx" ON "StudentTermsAcceptance"("organizationId", "acceptedAt");
ALTER TABLE "StudentTermsAcceptance" ADD CONSTRAINT "StudentTermsAcceptance_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentTermsAcceptance" ADD CONSTRAINT "StudentTermsAcceptance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentTermsAcceptance" ADD CONSTRAINT "StudentTermsAcceptance_occupancyId_fkey" FOREIGN KEY ("occupancyId") REFERENCES "Occupancy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
