-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "defaultBreakMonths" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "defaultSemesterMonths" INTEGER NOT NULL DEFAULT 4,
ADD COLUMN     "mpesaAccountName" TEXT,
ADD COLUMN     "mpesaShortcode" TEXT,
ADD COLUMN     "physicalAddress" TEXT,
ADD COLUMN     "receiptPrefix" TEXT NOT NULL DEFAULT 'MMH',
ADD COLUMN     "reminderDaysBefore" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN     "smsEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "whatsappEnabled" BOOLEAN NOT NULL DEFAULT true;
