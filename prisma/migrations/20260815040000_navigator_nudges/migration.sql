-- Navigator nudges: per-user notification prefs + a sent-nudge ledger for dedup.
-- Applied manually to Neon (Vercel only runs `prisma generate`, never migrate).

ALTER TABLE "NavProfile" ADD COLUMN IF NOT EXISTS "notifyEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "NavProfile" ADD COLUMN IF NOT EXISTS "notifyLeadMins" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "NavProfile" ADD COLUMN IF NOT EXISTS "notifyBlocks" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "NavProfile" ADD COLUMN IF NOT EXISTS "notifyDueToday" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "NavProfile" ADD COLUMN IF NOT EXISTS "notifyOverdue" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "NavProfile" ADD COLUMN IF NOT EXISTS "notifyErrands" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "NavProfile" ADD COLUMN IF NOT EXISTS "notifyStuck" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "NavProfile" ADD COLUMN IF NOT EXISTS "notifyIdle" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "NavProfile" ADD COLUMN IF NOT EXISTS "notifyEvening" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "NavProfile" ADD COLUMN IF NOT EXISTS "notifyDuringShift" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "NavProfile" ADD COLUMN IF NOT EXISTS "quietStart" TEXT NOT NULL DEFAULT '22:00';
ALTER TABLE "NavProfile" ADD COLUMN IF NOT EXISTS "quietEnd" TEXT NOT NULL DEFAULT '07:00';

CREATE TABLE IF NOT EXISTS "NavNudge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "kind" TEXT NOT NULL,
    "refKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NavNudge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "NavNudge_userId_date_kind_refKey_key"
  ON "NavNudge"("userId", "date", "kind", "refKey");

CREATE INDEX IF NOT EXISTS "NavNudge_userId_sentAt_idx"
  ON "NavNudge"("userId", "sentAt");
