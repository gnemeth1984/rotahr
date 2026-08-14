-- Per-weekday work windows + energy pattern for Navigator.
-- A single workStart/workEnd cannot express a split week (e.g. Mon-Thu 11:00-19:30,
-- Fri-Sat 08:30-13:00, Sun off), so the day planner was treating every day the same.
ALTER TABLE "NavProfile" ADD COLUMN IF NOT EXISTS "weekPattern" JSONB;
ALTER TABLE "NavProfile" ADD COLUMN IF NOT EXISTS "energyPattern" TEXT;
