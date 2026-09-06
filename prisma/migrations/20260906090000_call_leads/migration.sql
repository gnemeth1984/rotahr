-- Lead Finder: venues found on OpenStreetMap that have no website.
-- Phone leads, deliberately separate from OutreachLead (which requires a
-- unique email that none of these have).

CREATE TABLE "CallLead" (
    "id" TEXT NOT NULL,
    "osmType" TEXT NOT NULL,
    "osmId" TEXT NOT NULL,
    "osmKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'restaurant',
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "region" TEXT NOT NULL DEFAULT '',
    "country" TEXT NOT NULL DEFAULT '',
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "facebook" TEXT,
    "instagram" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "notes" TEXT,
    "source" TEXT,
    "calledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CallLead_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CallLead_osmKey_key" ON "CallLead"("osmKey");
CREATE INDEX "CallLead_status_createdAt_idx" ON "CallLead"("status", "createdAt");
CREATE INDEX "CallLead_country_status_idx" ON "CallLead"("country", "status");
CREATE INDEX "CallLead_city_idx" ON "CallLead"("city");
