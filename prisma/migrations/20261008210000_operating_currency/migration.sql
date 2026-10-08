ALTER TABLE "RoomType" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'KES';
ALTER TABLE "BreakPeriod" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'KES';
-- Preserve existing KES amounts; additive currency snapshots and expanded exact decimal capacity.
ALTER TABLE "Organization" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'KES', ADD COLUMN "currencyLockedAt" TIMESTAMP(3);
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_currency_supported" CHECK ("currency" IN ('AED','AFN','ALL','AMD','AOA','ARS','AUD','AWG','AZN','BAM','BBD','BDT','BHD','BIF','BMD','BND','BOB','BRL','BSD','BTN','BWP','BYN','BZD','CAD','CDF','CHF','CLP','CNY','COP','CRC','CUP','CVE','CZK','DJF','DKK','DOP','DZD','EGP','ERN','ETB','EUR','FJD','FKP','GBP','GEL','GHS','GIP','GMD','GNF','GTQ','GYD','HKD','HNL','HTG','HUF','IDR','ILS','INR','IQD','IRR','ISK','JMD','JOD','JPY','KES','KGS','KHR','KMF','KPW','KRW','KWD','KYD','KZT','LAK','LBP','LKR','LRD','LSL','LYD','MAD','MDL','MGA','MKD','MMK','MNT','MOP','MRU','MUR','MVR','MWK','MXN','MYR','MZN','NAD','NGN','NIO','NOK','NPR','NZD','OMR','PAB','PEN','PGK','PHP','PKR','PLN','PYG','QAR','RON','RSD','RUB','RWF','SAR','SBD','SCR','SDG','SEK','SGD','SHP','SLE','SOS','SRD','SSP','STN','SVC','SYP','SZL','THB','TJS','TMT','TND','TOP','TRY','TTD','TWD','TZS','UAH','UGX','USD','UYU','UZS','VED','VES','VND','VUV','WST','XAF','XCD','XCG','XOF','XPF','YER','ZAR','ZMW','ZWG'));
ALTER TABLE "RoomType" ALTER COLUMN "monthlyRate" TYPE DECIMAL(15,3);
ALTER TABLE "RoomType" ALTER COLUMN "semesterRate" TYPE DECIMAL(15,3);
ALTER TABLE "Occupancy" ALTER COLUMN "finalBalance" TYPE DECIMAL(15,3);
ALTER TABLE "BreakPeriod" ALTER COLUMN "storageChargeValue" TYPE DECIMAL(15,3);
ALTER TABLE "BreakReservation" ALTER COLUMN "monthlyRateSnapshot" TYPE DECIMAL(15,3);
ALTER TABLE "BreakReservation" ALTER COLUMN "potentialCharge" TYPE DECIMAL(15,3);
ALTER TABLE "BreakReservation" ALTER COLUMN "finalCharge" TYPE DECIMAL(15,3);
ALTER TABLE "SemesterCharge" ALTER COLUMN "amount" TYPE DECIMAL(15,3);
ALTER TABLE "SemesterCharge" ALTER COLUMN "baseAmount" TYPE DECIMAL(15,3);
ALTER TABLE "SemesterCharge" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'KES';
ALTER TABLE "RoomRateHistory" ALTER COLUMN "monthlyRate" TYPE DECIMAL(15,3);
ALTER TABLE "RoomRateHistory" ALTER COLUMN "semesterRate" TYPE DECIMAL(15,3);
ALTER TABLE "OccupancyRoomStay" ALTER COLUMN "monthlyRateSnapshot" TYPE DECIMAL(15,3);
ALTER TABLE "OccupancyRoomStay" ALTER COLUMN "semesterRateSnapshot" TYPE DECIMAL(15,3);
ALTER TABLE "ChargeAdjustment" ALTER COLUMN "previousAmount" TYPE DECIMAL(15,3);
ALTER TABLE "ChargeAdjustment" ALTER COLUMN "newAmount" TYPE DECIMAL(15,3);
ALTER TABLE "ChargeAdjustment" ALTER COLUMN "adjustmentAmount" TYPE DECIMAL(15,3);
ALTER TABLE "Payment" ALTER COLUMN "amount" TYPE DECIMAL(15,3);
ALTER TABLE "Payment" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'KES';
ALTER TABLE "MpesaTransaction" ALTER COLUMN "amount" TYPE DECIMAL(15,3);
ALTER TABLE "MpesaTransaction" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'KES';
ALTER TABLE "Expense" ALTER COLUMN "amount" TYPE DECIMAL(15,3);
ALTER TABLE "Expense" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'KES';
UPDATE "Organization" o SET "currencyLockedAt"=CURRENT_TIMESTAMP WHERE EXISTS (SELECT 1 FROM "RoomType" x WHERE x."organizationId"=o.id) OR EXISTS (SELECT 1 FROM "Occupancy" x WHERE x."organizationId"=o.id) OR EXISTS (SELECT 1 FROM "BreakPeriod" x WHERE x."organizationId"=o.id) OR EXISTS (SELECT 1 FROM "BreakReservation" x WHERE x."organizationId"=o.id) OR EXISTS (SELECT 1 FROM "SemesterCharge" x WHERE x."organizationId"=o.id) OR EXISTS (SELECT 1 FROM "RoomRateHistory" x WHERE x."organizationId"=o.id) OR EXISTS (SELECT 1 FROM "OccupancyRoomStay" x WHERE x."organizationId"=o.id) OR EXISTS (SELECT 1 FROM "ChargeAdjustment" x WHERE x."organizationId"=o.id) OR EXISTS (SELECT 1 FROM "Payment" x WHERE x."organizationId"=o.id) OR EXISTS (SELECT 1 FROM "MpesaTransaction" x WHERE x."organizationId"=o.id) OR EXISTS (SELECT 1 FROM "Expense" x WHERE x."organizationId"=o.id);
CREATE FUNCTION protect_organization_currency() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD."currencyLockedAt" IS NOT NULL AND (NEW.currency IS DISTINCT FROM OLD.currency OR NEW."currencyLockedAt" IS DISTINCT FROM OLD."currencyLockedAt") THEN
  RAISE EXCEPTION 'CURRENCY_LOCKED';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER protect_organization_currency BEFORE UPDATE ON "Organization" FOR EACH ROW EXECUTE FUNCTION protect_organization_currency();

CREATE FUNCTION guard_ledger_currency() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE code TEXT; places INTEGER; field TEXT; value NUMERIC;
BEGIN
 IF TG_OP='UPDATE' AND NEW."organizationId" IS DISTINCT FROM OLD."organizationId" THEN RAISE EXCEPTION 'LEDGER_ORGANIZATION_IMMUTABLE'; END IF;
 UPDATE "Organization" SET "currencyLockedAt"=COALESCE("currencyLockedAt",CURRENT_TIMESTAMP) WHERE id=NEW."organizationId" RETURNING currency INTO code;
 IF code IS NULL THEN RAISE EXCEPTION 'ORGANIZATION_UNAVAILABLE'; END IF;
 places := CASE WHEN code IN ('BIF','CLP','DJF','GNF','ISK','JPY','KMF','KRW','PYG','RWF','UGX','VND','VUV','XAF','XOF','XPF') THEN 0 WHEN code IN ('BHD','IQD','JOD','KWD','LYD','OMR','TND') THEN 3 ELSE 2 END;
 FOREACH field IN ARRAY TG_ARGV LOOP
  IF TG_TABLE_NAME='BreakPeriod' AND (to_jsonb(NEW)->>'storageChargeMode') <> 'FLAT_AMOUNT' THEN CONTINUE; END IF;
  value := (to_jsonb(NEW)->>field)::numeric;
  IF value IS NOT NULL AND value <> round(value, places) THEN RAISE EXCEPTION 'INVALID_CURRENCY_AMOUNT'; END IF;
 END LOOP;
 IF TG_TABLE_NAME IN ('SemesterCharge','Payment','Expense','MpesaTransaction','RoomType','BreakPeriod') THEN
  IF TG_OP='UPDATE' AND NEW.currency IS DISTINCT FROM OLD.currency THEN RAISE EXCEPTION 'RECORD_CURRENCY_IMMUTABLE'; END IF;
  IF NEW.currency <> code THEN RAISE EXCEPTION 'CURRENCY_MISMATCH'; END IF;
 END IF;
 RETURN NEW;
END $$;

CREATE TRIGGER guard_ledger_currency BEFORE INSERT OR UPDATE ON "RoomType" FOR EACH ROW EXECUTE FUNCTION guard_ledger_currency('monthlyRate','semesterRate');
CREATE TRIGGER guard_ledger_currency BEFORE INSERT OR UPDATE ON "Occupancy" FOR EACH ROW EXECUTE FUNCTION guard_ledger_currency('finalBalance');
CREATE TRIGGER guard_ledger_currency BEFORE INSERT OR UPDATE ON "BreakPeriod" FOR EACH ROW EXECUTE FUNCTION guard_ledger_currency('storageChargeValue');
CREATE TRIGGER guard_ledger_currency BEFORE INSERT OR UPDATE ON "BreakReservation" FOR EACH ROW EXECUTE FUNCTION guard_ledger_currency('monthlyRateSnapshot','potentialCharge','finalCharge');
CREATE TRIGGER guard_ledger_currency BEFORE INSERT OR UPDATE ON "SemesterCharge" FOR EACH ROW EXECUTE FUNCTION guard_ledger_currency('amount','baseAmount');
CREATE TRIGGER guard_ledger_currency BEFORE INSERT OR UPDATE ON "RoomRateHistory" FOR EACH ROW EXECUTE FUNCTION guard_ledger_currency('monthlyRate','semesterRate');
CREATE TRIGGER guard_ledger_currency BEFORE INSERT OR UPDATE ON "OccupancyRoomStay" FOR EACH ROW EXECUTE FUNCTION guard_ledger_currency('monthlyRateSnapshot','semesterRateSnapshot');
CREATE TRIGGER guard_ledger_currency BEFORE INSERT OR UPDATE ON "ChargeAdjustment" FOR EACH ROW EXECUTE FUNCTION guard_ledger_currency('previousAmount','newAmount','adjustmentAmount');
CREATE TRIGGER guard_ledger_currency BEFORE INSERT OR UPDATE ON "Payment" FOR EACH ROW EXECUTE FUNCTION guard_ledger_currency('amount');
CREATE TRIGGER guard_ledger_currency BEFORE INSERT OR UPDATE ON "MpesaTransaction" FOR EACH ROW EXECUTE FUNCTION guard_ledger_currency('amount');
CREATE TRIGGER guard_ledger_currency BEFORE INSERT OR UPDATE ON "Expense" FOR EACH ROW EXECUTE FUNCTION guard_ledger_currency('amount');
