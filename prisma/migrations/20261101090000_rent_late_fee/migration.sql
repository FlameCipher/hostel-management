ALTER TABLE "SemesterCharge" ADD COLUMN "lateFeeForChargeId" TEXT, ADD COLUMN "lateFeeTermsId" TEXT, ADD COLUMN "lateFeeBasis" DECIMAL(15,3);
CREATE UNIQUE INDEX "SemesterCharge_lateFeeForChargeId_key" ON "SemesterCharge"("lateFeeForChargeId");
ALTER TABLE "SemesterCharge" ADD CONSTRAINT "SemesterCharge_lateFeeForChargeId_fkey" FOREIGN KEY ("lateFeeForChargeId") REFERENCES "SemesterCharge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SemesterCharge" ADD CONSTRAINT "SemesterCharge_lateFeeTermsId_fkey" FOREIGN KEY ("lateFeeTermsId") REFERENCES "StudentTermsAcceptance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SemesterCharge" ADD CONSTRAINT "SemesterCharge_late_fee_fields_check" CHECK (("lateFeeForChargeId" IS NULL AND "lateFeeTermsId" IS NULL AND "lateFeeBasis" IS NULL) OR ("lateFeeForChargeId" IS NOT NULL AND "lateFeeTermsId" IS NOT NULL AND "lateFeeBasis" IS NOT NULL AND "lateFeeBasis" > 0 AND type = 'OTHER' AND id <> "lateFeeForChargeId"));
