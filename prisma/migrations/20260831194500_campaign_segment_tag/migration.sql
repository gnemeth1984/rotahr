-- Campaign: optional tag used only by the "tag" segment.
-- Additive and nullable, so deployed code is unaffected.
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "segmentTag" TEXT;
