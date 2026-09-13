-- Run after existing duplicate student records have been merged or removed through the UI.
-- These expression indexes enforce tenant-scoped uniqueness after normalization.
CREATE UNIQUE INDEX "Student_org_phone_normalized_key"
ON "Student" (
  "organizationId",
  (
    CASE
      WHEN regexp_replace("phone", '[^0-9]', '', 'g') LIKE '0%'
        THEN '254' || substring(regexp_replace("phone", '[^0-9]', '', 'g') FROM 2)
      WHEN regexp_replace("phone", '[^0-9]', '', 'g') ~ '^[17][0-9]{8}$'
        THEN '254' || regexp_replace("phone", '[^0-9]', '', 'g')
      ELSE regexp_replace("phone", '[^0-9]', '', 'g')
    END
  )
);

CREATE UNIQUE INDEX "Student_org_admission_normalized_key"
ON "Student" ("organizationId", (upper(regexp_replace(trim("admissionNumber"), '\s+', '', 'g'))))
WHERE "admissionNumber" IS NOT NULL AND trim("admissionNumber") <> '';

CREATE UNIQUE INDEX "Student_org_national_id_normalized_key"
ON "Student" ("organizationId", (upper(regexp_replace(trim("nationalId"), '\s+', '', 'g'))))
WHERE "nationalId" IS NOT NULL AND trim("nationalId") <> '';
