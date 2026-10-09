ALTER TABLE "Student" ADD COLUMN "portalSessionVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Student" ADD CONSTRAINT "Student_portalSessionVersion_nonnegative" CHECK ("portalSessionVersion" >= 0);

-- Revoke existing sessions for every credential/access update, including writes
-- from older deployments. Routine record edits and last-login updates preserve them.
CREATE FUNCTION protect_tenant_session_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."portalPasswordHash" IS DISTINCT FROM OLD."portalPasswordHash"
     OR NEW."portalEnabled" IS DISTINCT FROM OLD."portalEnabled"
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.phone IS DISTINCT FROM OLD.phone THEN
    NEW."portalSessionVersion" := OLD."portalSessionVersion" + 1;
  ELSIF NEW."portalSessionVersion" < OLD."portalSessionVersion" THEN
    RAISE EXCEPTION 'TENANT_SESSION_VERSION_CANNOT_DECREASE';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER protect_tenant_session_version BEFORE UPDATE ON "Student"
FOR EACH ROW EXECUTE FUNCTION protect_tenant_session_version();
