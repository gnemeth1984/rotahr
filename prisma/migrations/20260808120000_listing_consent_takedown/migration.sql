-- Applied to the live database with `prisma db push` and recorded here so
-- migration history stays complete. `migrate dev` could not generate it: an
-- older migration (20260619000000_add_geofencing) fails against a fresh shadow
-- database, so the shadow step aborts before reaching this change.

-- Marketing consent, recorded separately from the act of claiming a listing.
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "marketingOptIn" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "marketingOptInAt" TIMESTAMP(3);
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "marketingOptOutAt" TIMESTAMP(3);
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "marketingEmail" TEXT;

-- One-click removal of a page published on a venue's behalf.
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "publicTakedownToken" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Business_publicTakedownToken_key"
  ON "Business"("publicTakedownToken");

-- Append-only consent log, for GDPR Art. 7(1). Never updated or deleted; a
-- withdrawal is a new row with granted = false.
CREATE TABLE IF NOT EXISTS "MarketingConsentEvent" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "businessId" TEXT,
  "granted" BOOLEAN NOT NULL,
  "source" TEXT NOT NULL,
  "consentText" TEXT,
  "ip" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketingConsentEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "MarketingConsentEvent_email_createdAt_idx"
  ON "MarketingConsentEvent"("email", "createdAt");
CREATE INDEX IF NOT EXISTS "MarketingConsentEvent_businessId_idx"
  ON "MarketingConsentEvent"("businessId");

-- Outlives the Business row so a later import cannot republish a venue that
-- asked to be removed.
CREATE TABLE IF NOT EXISTS "ListingTakedown" (
  "id" TEXT NOT NULL,
  "nameKey" TEXT NOT NULL,
  "email" TEXT,
  "slug" TEXT,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ListingTakedown_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ListingTakedown_nameKey_key" ON "ListingTakedown"("nameKey");
CREATE INDEX IF NOT EXISTS "ListingTakedown_email_idx" ON "ListingTakedown"("email");
