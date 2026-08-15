-- Navigator batch 3: auto-archive, smart snooze, shift buffers, rituals.
-- Applied manually to Neon (Vercel only runs `prisma generate`, never migrate).
-- Every statement is idempotent so a partial run can simply be re-run.

-- 4.3 Shift buffering + 6.3 rituals: per-user knobs, both on by default.
ALTER TABLE "NavProfile" ADD COLUMN IF NOT EXISTS "bufferShifts" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "NavProfile" ADD COLUMN IF NOT EXISTS "preShiftMins" INTEGER NOT NULL DEFAULT 45;
ALTER TABLE "NavProfile" ADD COLUMN IF NOT EXISTS "postShiftMins" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "NavProfile" ADD COLUMN IF NOT EXISTS "ritualsEnabled" BOOLEAN NOT NULL DEFAULT true;

-- 5.3 Auto-archive. Nullable, so every existing row stays visible.
ALTER TABLE "NavTask" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "NavTask_userId_archivedAt_idx" ON "NavTask"("userId", "archivedAt");

-- 5.2 Smart snooze.
CREATE TABLE IF NOT EXISTS "NavSnooze" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "refKey" TEXT NOT NULL,
  "until" TIMESTAMP(3) NOT NULL,
  "condition" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NavSnooze_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "NavSnooze_userId_kind_refKey_key"
  ON "NavSnooze"("userId", "kind", "refKey");
CREATE INDEX IF NOT EXISTS "NavSnooze_userId_until_idx" ON "NavSnooze"("userId", "until");

-- 6.3 Rituals. Definitions stay in code; this only records what got ticked.
CREATE TABLE IF NOT EXISTS "NavRitualLog" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "ritual" TEXT NOT NULL,
  "steps" JSONB,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NavRitualLog_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "NavRitualLog_userId_date_ritual_key"
  ON "NavRitualLog"("userId", "date", "ritual");
CREATE INDEX IF NOT EXISTS "NavRitualLog_userId_date_idx" ON "NavRitualLog"("userId", "date");
