ALTER TABLE "CommunicationSettings"
 ADD COLUMN "arrearsEnabled" BOOLEAN NOT NULL DEFAULT false,
 ADD COLUMN "arrearsWhatsappCopies" BOOLEAN NOT NULL DEFAULT false,
 ADD COLUMN "arrearsEmailCopies" BOOLEAN NOT NULL DEFAULT false;
