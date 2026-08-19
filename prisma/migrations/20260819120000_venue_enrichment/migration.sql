-- Proposed facts for public venue pages, awaiting human approval.
--
-- Idempotent on purpose. Migrations here are applied by hand against Neon
-- rather than by `prisma migrate deploy`, so a re-run must be harmless.

CREATE TABLE IF NOT EXISTS "VenueEnrichment" (
  "id"              TEXT NOT NULL,
  "businessId"      TEXT NOT NULL,
  "slug"            TEXT NOT NULL,
  "status"          TEXT NOT NULL DEFAULT 'pending',
  "result"          JSONB NOT NULL,
  "hasHours"        BOOLEAN NOT NULL DEFAULT false,
  "dishCount"       INTEGER NOT NULL DEFAULT 0,
  "warningCount"    INTEGER NOT NULL DEFAULT 0,
  "pagesFetched"    INTEGER NOT NULL DEFAULT 0,
  "publishedFields" JSONB,
  "reviewedBy"      TEXT,
  "reviewedAt"      TIMESTAMP(3),
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "VenueEnrichment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "VenueEnrichment_businessId_key"
  ON "VenueEnrichment" ("businessId");

CREATE INDEX IF NOT EXISTS "VenueEnrichment_status_createdAt_idx"
  ON "VenueEnrichment" ("status", "createdAt");
