-- Navigator <-> Rotahr bridge, phase 0 + 1.
-- Every statement is idempotent so this can be re-run safely against Neon.

-- NavProfile: bridge switches.
ALTER TABLE "NavProfile" ADD COLUMN IF NOT EXISTS "systemAccess" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "NavProfile" ADD COLUMN IF NOT EXISTS "autonomyEnabled" BOOLEAN NOT NULL DEFAULT false;

-- Cached system digest. Aggregates only for other tenants (see redact.ts).
CREATE TABLE IF NOT EXISTS "NavSystemPulse" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  "refreshedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "durationMs" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NavSystemPulse_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "NavSystemPulse_userId_key" ON "NavSystemPulse"("userId");

-- What Gabor shipped.
CREATE TABLE IF NOT EXISTS "NavShipLog" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "sha" TEXT,
  "message" TEXT NOT NULL,
  "status" TEXT,
  "url" TEXT,
  "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NavShipLog_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "NavShipLog_userId_kind_sha_key" ON "NavShipLog"("userId", "kind", "sha");
CREATE INDEX IF NOT EXISTS "NavShipLog_userId_at_idx" ON "NavShipLog"("userId", "at");

-- Every cron outcome, not just SEO.
CREATE TABLE IF NOT EXISTS "CronRun" (
  "id" TEXT NOT NULL,
  "job" TEXT NOT NULL,
  "ok" BOOLEAN NOT NULL DEFAULT true,
  "detail" TEXT,
  "durationMs" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CronRun_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CronRun_job_createdAt_idx" ON "CronRun"("job", "createdAt");
CREATE INDEX IF NOT EXISTS "CronRun_createdAt_idx" ON "CronRun"("createdAt");
CREATE INDEX IF NOT EXISTS "CronRun_ok_createdAt_idx" ON "CronRun"("ok", "createdAt");

-- Audit trail for autonomous actions. Nothing acts without a row here.
CREATE TABLE IF NOT EXISTS "NavAction" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "tier" TEXT NOT NULL DEFAULT 'auto',
  "reason" TEXT,
  "input" JSONB,
  "result" JSONB,
  "undo" JSONB,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "error" TEXT,
  "businessId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "undoneAt" TIMESTAMP(3),
  CONSTRAINT "NavAction_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "NavAction_userId_createdAt_idx" ON "NavAction"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "NavAction_status_idx" ON "NavAction"("status");

-- ActivityLog gets no schema change, only far more write sites. This index
-- makes the "what did I do" rollup cheap, which is the whole point of phase 0.
CREATE INDEX IF NOT EXISTS "ActivityLog_userId_createdAt_idx" ON "ActivityLog"("userId", "createdAt");
