-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "marketingConsent" BOOLEAN NOT NULL DEFAULT false;
