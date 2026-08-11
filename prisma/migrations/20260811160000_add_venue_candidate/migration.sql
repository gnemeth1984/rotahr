-- CreateTable
CREATE TABLE "VenueCandidate" (
    "id" TEXT NOT NULL,
    "osmRef" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amenity" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'ie',
    "street" TEXT,
    "housenumber" TEXT,
    "city" TEXT,
    "postcode" TEXT,
    "lat" DOUBLE PRECISION,
    "lon" DOUBLE PRECISION,
    "phone" TEXT,
    "email" TEXT,
    "facebook" TEXT,
    "instagram" TEXT,
    "openingHours" TEXT,
    "cuisine" TEXT,
    "hasWebsite" BOOLEAN,
    "websiteFound" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "builtSlug" TEXT,
    "skipReason" TEXT,
    "notes" TEXT,
    "builtAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VenueCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VenueCandidate_osmRef_key" ON "VenueCandidate"("osmRef");

-- CreateIndex
CREATE INDEX "VenueCandidate_status_country_idx" ON "VenueCandidate"("status", "country");

-- CreateIndex
CREATE INDEX "VenueCandidate_amenity_idx" ON "VenueCandidate"("amenity");

-- CreateIndex
CREATE INDEX "VenueCandidate_city_idx" ON "VenueCandidate"("city");
