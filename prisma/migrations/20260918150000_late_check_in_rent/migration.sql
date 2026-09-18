-- Allow audited rent adjustments when a student joins after the semester begins.

ALTER TYPE "ChargeAdjustmentReason" ADD VALUE IF NOT EXISTS 'LATE_CHECK_IN';
