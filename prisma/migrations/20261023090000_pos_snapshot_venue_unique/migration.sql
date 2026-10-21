-- PosSnapshot: one row per (business, venue, day) instead of per (business, day),
-- so a multi-site business can hold one till feed per venue.
--
-- NULLS NOT DISTINCT (PostgreSQL 15+) keeps the old guarantee for rows with no
-- venue: there can still be only one unattributed snapshot per business per day.
-- Prisma does not model NULLS NOT DISTINCT, so it reads this as a plain
-- @@unique([businessId, venueId, date]); writes go through lib/pos/snapshots.ts
-- rather than a compound-unique upsert (Prisma rejects null in that input).
--
-- Additive-safe: every existing row already satisfies the old, stricter key.
DROP INDEX IF EXISTS "PosSnapshot_businessId_date_key";
CREATE UNIQUE INDEX "PosSnapshot_businessId_venueId_date_key"
  ON "PosSnapshot" ("businessId", "venueId", "date") NULLS NOT DISTINCT;
