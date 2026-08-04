-- Site audit history, keyed by hostname so any domain can be audited.
CREATE TABLE IF NOT EXISTS "SiteAudit" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "pagesCrawled" INTEGER NOT NULL,
    "issueCount" INTEGER NOT NULL,
    "criticalCount" INTEGER NOT NULL,
    "warningCount" INTEGER NOT NULL,
    "performance" INTEGER,
    "lcp" DOUBLE PRECISION,
    "cls" DOUBLE PRECISION,
    "report" JSONB NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "runById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SiteAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SiteAudit_domain_createdAt_idx" ON "SiteAudit"("domain", "createdAt");
CREATE INDEX IF NOT EXISTS "SiteAudit_createdAt_idx" ON "SiteAudit"("createdAt");
