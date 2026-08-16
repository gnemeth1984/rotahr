-- Free-visibility autopilot: discovery provenance, submission copy, monitoring.
--
-- Idempotent on purpose. Migrations here are applied by hand against Neon
-- rather than by `prisma migrate deploy`, so a re-run must be harmless.

ALTER TABLE "LinkProspect" ADD COLUMN IF NOT EXISTS "source"        TEXT NOT NULL DEFAULT 'seed';
ALTER TABLE "LinkProspect" ADD COLUMN IF NOT EXISTS "discoveredVia" TEXT;
ALTER TABLE "LinkProspect" ADD COLUMN IF NOT EXISTS "submitUrl"     TEXT;
ALTER TABLE "LinkProspect" ADD COLUMN IF NOT EXISTS "pitch"         TEXT;
ALTER TABLE "LinkProspect" ADD COLUMN IF NOT EXISTS "lastCheckedAt" TIMESTAMP(3);
ALTER TABLE "LinkProspect" ADD COLUMN IF NOT EXISTS "lastCheckOk"   BOOLEAN;
ALTER TABLE "LinkProspect" ADD COLUMN IF NOT EXISTS "checkFailures" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "LinkProspect" ADD COLUMN IF NOT EXISTS "taskedAt"      TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "LinkProspect_status_lastCheckedAt_idx"
  ON "LinkProspect" ("status", "lastCheckedAt");
