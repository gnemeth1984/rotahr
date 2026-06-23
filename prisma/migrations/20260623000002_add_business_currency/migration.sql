-- Add currency and country to Business
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'EUR';
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "country" TEXT NOT NULL DEFAULT 'IE';
