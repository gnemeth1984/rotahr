-- Persisted SMTP mailbox-verification result for outreach leads.
-- Additive and nullable: existing rows read as "never verified", which the
-- sender treats as sendable, so this cannot silently stop outreach.
ALTER TABLE "OutreachLead" ADD COLUMN IF NOT EXISTS "emailVerdict" TEXT;
ALTER TABLE "OutreachLead" ADD COLUMN IF NOT EXISTS "verifyDetail" TEXT;
ALTER TABLE "OutreachLead" ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "OutreachLead_emailVerdict_idx" ON "OutreachLead"("emailVerdict");
