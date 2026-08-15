-- Navigator batch 2: coach tone + task drafts.
-- Applied manually to Neon (Vercel only runs `prisma generate`, never migrate).

-- 6.2 Personality: how blunt Navigator is allowed to be. Tone only — it never
-- changes the ADHD mechanics or the clinical boundaries.
ALTER TABLE "NavProfile" ADD COLUMN IF NOT EXISTS "coachTone" TEXT NOT NULL DEFAULT 'direct';

-- 2.3 Task drafts need no column: NavTask.status is already free-form TEXT, so
-- 'draft' is a new value, not a new shape. This index keeps the drafts query
-- (and every status filter that now has to exclude drafts) off a table scan.
CREATE INDEX IF NOT EXISTS "NavTask_userId_status_createdAt_idx"
  ON "NavTask"("userId", "status", "createdAt");
