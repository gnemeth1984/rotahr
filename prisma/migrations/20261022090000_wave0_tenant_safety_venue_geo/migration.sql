-- Wave 0: tenant safety, venue attribution, server-side geofence, no_show.
--
-- Purely additive: every new column is nullable, no column is dropped or
-- retyped, and the PosSnapshot unique key is unchanged. Code deployed before
-- this migration keeps working after it, so apply this to production BEFORE
-- deploying the code that reads the new columns.

-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "webhookSecretHash" TEXT;

-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "venueId" TEXT;

-- AlterTable
ALTER TABLE "ClockEvent" ADD COLUMN     "geoDistanceM" INTEGER,
ADD COLUMN     "geoStatus" TEXT;

-- AlterTable
ALTER TABLE "PosConnection" ADD COLUMN     "venueId" TEXT;

-- AlterTable
ALTER TABLE "PosSnapshot" ADD COLUMN     "venueId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Business_webhookSecretHash_key" ON "Business"("webhookSecretHash");

-- CreateIndex
CREATE INDEX "Reservation_venueId_date_idx" ON "Reservation"("venueId", "date");

-- CreateIndex
CREATE INDEX "PosSnapshot_venueId_date_idx" ON "PosSnapshot"("venueId", "date");

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosConnection" ADD CONSTRAINT "PosConnection_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosSnapshot" ADD CONSTRAINT "PosSnapshot_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ── Backfills (safe, idempotent) ────────────────────────────────────────────

-- Single-venue businesses: every existing booking and POS snapshot can only
-- belong to that venue. Multi-venue businesses are left NULL on purpose —
-- guessing would put revenue against the wrong site.
WITH single_venue AS (
  SELECT "businessId", MIN("id") AS "venueId"
  FROM "Venue"
  WHERE "active" = true
  GROUP BY "businessId"
  HAVING COUNT(*) = 1
)
UPDATE "Reservation" r
SET "venueId" = sv."venueId"
FROM single_venue sv
WHERE r."businessId" = sv."businessId" AND r."venueId" IS NULL;

WITH single_venue AS (
  SELECT "businessId", MIN("id") AS "venueId"
  FROM "Venue"
  WHERE "active" = true
  GROUP BY "businessId"
  HAVING COUNT(*) = 1
)
UPDATE "PosSnapshot" s
SET "venueId" = sv."venueId"
FROM single_venue sv
WHERE s."businessId" = sv."businessId" AND s."venueId" IS NULL;

WITH single_venue AS (
  SELECT "businessId", MIN("id") AS "venueId"
  FROM "Venue"
  WHERE "active" = true
  GROUP BY "businessId"
  HAVING COUNT(*) = 1
)
UPDATE "PosConnection" c
SET "venueId" = sv."venueId"
FROM single_venue sv
WHERE c."businessId" = sv."businessId" AND c."venueId" IS NULL;

-- One spelling for no-show. lib/crm/stats.ts tolerated three.
UPDATE "Reservation" SET "status" = 'no_show' WHERE "status" IN ('no-show', 'noshow', 'NO_SHOW', 'No-show');
