-- Correct the official hostel name without changing tenant, room, payment, or rate data.
UPDATE "Organization"
SET "name" = 'MMAMBUGUA HOSTEL',
    "mpesaAccountName" = CASE
      WHEN "mpesaAccountName" = 'Mama Mbugua Hostel' THEN 'MMAMBUGUA HOSTEL'
      ELSE "mpesaAccountName"
    END,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "name" = 'Mama Mbugua Hostel';
