-- Navigator daily ideas engine.
--
-- One flag. Ideas reuse the existing NavTask draft inbox rather than getting
-- their own table: a draft is already "captured but undecided", which is what
-- an idea is, and reusing it means triage, archiving and the AI context all
-- keep working with no extra code.
ALTER TABLE "NavProfile" ADD COLUMN IF NOT EXISTS "ideasEnabled" BOOLEAN NOT NULL DEFAULT true;

-- The ideas engine counts undecided drafts per project on every run, and the
-- task list filters on the same shape.
CREATE INDEX IF NOT EXISTS "NavTask_userId_project_status_idx" ON "NavTask"("userId", "project", "status");
