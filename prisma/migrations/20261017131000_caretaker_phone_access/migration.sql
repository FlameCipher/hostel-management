-- Existing email accounts and contact numbers are preserved. Phone sign-in is
-- explicitly enrolled by Owner/Admin; legacy contact numbers are not enabled.
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "User" ADD COLUMN "loginPhone" TEXT,
                   ADD COLUMN "dutyStart" TEXT,
                   ADD COLUMN "dutyEnd" TEXT,
                   ADD COLUMN "dutyTimeZone" TEXT;
CREATE UNIQUE INDEX "User_organizationId_loginPhone_key" ON "User"("organizationId", "loginPhone");
ALTER TABLE "User" ADD CONSTRAINT "User_phone_login_caretaker_check"
  CHECK ("loginPhone" IS NULL OR (role = 'CARETAKER' AND "loginPhone" ~ '^\+[1-9][0-9]{7,14}$'));
ALTER TABLE "User" ADD CONSTRAINT "User_login_required_check"
  CHECK (email IS NOT NULL OR "loginPhone" IS NOT NULL);
ALTER TABLE "User" ADD CONSTRAINT "User_duty_hours_check"
  CHECK (("dutyStart" IS NULL AND "dutyEnd" IS NULL AND "dutyTimeZone" IS NULL)
    OR ("dutyStart" IS NOT NULL AND "dutyEnd" IS NOT NULL AND "dutyTimeZone" IS NOT NULL
      AND "dutyStart" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      AND "dutyEnd" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      AND "dutyStart" <> "dutyEnd"));
