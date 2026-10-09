-- PostgreSQL CHECK treats NULL as unknown, so a checked-out record must
-- explicitly require a departure timestamp as well as ordered event times.
ALTER TABLE "VisitorRequest" DROP CONSTRAINT "VisitorRequest_gate_check";
ALTER TABLE "VisitorRequest" ADD CONSTRAINT "VisitorRequest_gate_check" CHECK (
  ("status" = 'CHECKED_IN' AND "checkedInAt" IS NOT NULL AND "checkedOutAt" IS NULL)
  OR ("status" = 'CHECKED_OUT' AND "checkedInAt" IS NOT NULL AND "checkedOutAt" IS NOT NULL AND "checkedOutAt" >= "checkedInAt")
  OR ("status" IN ('REQUESTED', 'APPROVED', 'DENIED', 'CANCELLED') AND "checkedInAt" IS NULL AND "checkedOutAt" IS NULL)
);
