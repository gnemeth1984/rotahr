-- Trial deadline for read-only mode (lib/billing/access.ts).
--
-- Deliberately nullable with NO default and NO backfill. NULL means "no
-- deadline", which computeAccess() treats as unlimited access. That way every
-- business already trading keeps full access through this deploy, and only
-- businesses created after it get a trial clock.
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "trialEndsAt" TIMESTAMP(3);
