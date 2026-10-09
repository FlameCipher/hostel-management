BEGIN;
-- No existing hostel is renamed or deleted. Conflicts must be reviewed before release.
CREATE FUNCTION hostel_name_key(value text) RETURNS text LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
  SELECT lower(regexp_replace(normalize(value, NFKC), '[^[:alnum:]]', '', 'g'))
$$;
DO $$ BEGIN
 IF EXISTS (SELECT hostel_name_key(name) FROM "Property" GROUP BY hostel_name_key(name) HAVING COUNT(*)>1)
 OR EXISTS (SELECT key FROM (SELECT hostel_name_key(name) key,id org FROM "Organization" UNION ALL SELECT hostel_name_key(name),"organizationId" FROM "Property") names GROUP BY key HAVING COUNT(DISTINCT org)>1)
 THEN RAISE EXCEPTION 'HOSTEL_NAME_CONFLICT_REVIEW_REQUIRED: existing hostel names overlap; review them before migration'; END IF;
END $$;
CREATE UNIQUE INDEX "Property_hostel_name_unique" ON "Property" (hostel_name_key(name));
CREATE UNIQUE INDEX "Organization_hostel_name_unique" ON "Organization" (hostel_name_key(name));
CREATE FUNCTION enforce_hostel_name() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE key text; org text;
BEGIN
 key := hostel_name_key(NEW.name);
 IF key='' THEN RAISE EXCEPTION 'INVALID_HOSTEL_NAME'; END IF;
 IF TG_TABLE_NAME='Organization' THEN org:=NEW.id; ELSE org:=NEW."organizationId"; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('hostel-name:' || key));
 IF EXISTS (SELECT 1 FROM "Organization" o WHERE hostel_name_key(o.name)=key AND o.id<>org)
 OR EXISTS (SELECT 1 FROM "Property" p WHERE hostel_name_key(p.name)=key AND p."organizationId"<>org)
 THEN RAISE EXCEPTION 'HOSTEL_NAME_TAKEN' USING ERRCODE='23505',CONSTRAINT='hostel_name_claimed'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "Organization_hostel_name" BEFORE INSERT OR UPDATE OF name ON "Organization" FOR EACH ROW EXECUTE FUNCTION enforce_hostel_name();
CREATE TRIGGER "Property_hostel_name" BEFORE INSERT OR UPDATE OF name,"organizationId" ON "Property" FOR EACH ROW EXECUTE FUNCTION enforce_hostel_name();

CREATE TABLE "PasswordRecovery" (
 "id" TEXT NOT NULL PRIMARY KEY, "organizationId" TEXT NOT NULL, "propertyId" TEXT NOT NULL,
 "kind" TEXT NOT NULL, "userId" TEXT, "studentId" TEXT, "sessionVersion" INTEGER NOT NULL,
 "recipient" TEXT NOT NULL, "host" TEXT NOT NULL, "tokenHash" TEXT NOT NULL UNIQUE,
 "expiresAt" TIMESTAMP(3) NOT NULL, "usedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "deliveryStatus" TEXT NOT NULL DEFAULT 'SENDING',
 CONSTRAINT "PasswordRecovery_account_kind" CHECK ((kind='MANAGEMENT' AND "userId" IS NOT NULL AND "studentId" IS NULL) OR (kind='TENANT' AND "studentId" IS NOT NULL AND "userId" IS NULL)),
 CONSTRAINT "PasswordRecovery_delivery" CHECK ("deliveryStatus" IN ('SENDING','PROVIDER_ACCEPTED','FAILED','REVIEW')),
 CONSTRAINT "PasswordRecovery_property_scope" FOREIGN KEY ("propertyId","organizationId") REFERENCES "Property"(id,"organizationId") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "PasswordRecovery_user" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "PasswordRecovery_student" FOREIGN KEY ("studentId") REFERENCES "Student"(id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "PasswordRecovery_organizationId_createdAt_idx" ON "PasswordRecovery"("organizationId","createdAt");
CREATE INDEX "PasswordRecovery_userId_idx" ON "PasswordRecovery"("userId");
CREATE INDEX "PasswordRecovery_studentId_idx" ON "PasswordRecovery"("studentId");
CREATE INDEX "PasswordRecovery_expiresAt_idx" ON "PasswordRecovery"("expiresAt");
CREATE TABLE "RecoveryRateLimit" (id TEXT NOT NULL PRIMARY KEY, attempts INTEGER NOT NULL DEFAULT 1, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX "RecoveryRateLimit_createdAt_idx" ON "RecoveryRateLimit"("createdAt");

COMMIT;
