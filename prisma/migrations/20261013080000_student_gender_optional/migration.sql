-- Optional self-reported gender for authorized aggregate hostel demographics.
-- Existing student records remain NULL (unrecorded); never infer gender from names.
CREATE TYPE "StudentGender" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY');
ALTER TABLE "Student" ADD COLUMN "gender" "StudentGender";
