-- Additive, platform-admin-only intelligence. No changes to sender/tenant tables.
CREATE TABLE "LeadIntelligenceLead" (
  "id" TEXT NOT NULL,
  "dedupeKey" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "website" TEXT,
  "category" TEXT NOT NULL DEFAULT 'hospitality',
  "country" TEXT NOT NULL DEFAULT 'ie',
  "county" TEXT NOT NULL DEFAULT '',
  "city" TEXT NOT NULL DEFAULT '',
  "address" TEXT NOT NULL DEFAULT '',
  "sourceUrl" TEXT NOT NULL,
  "sourceKind" TEXT NOT NULL DEFAULT 'manual',
  "discoveryEvidence" JSONB,
  "status" TEXT NOT NULL DEFAULT 'new',
  "contactedAt" TIMESTAMP(3),
  "notes" TEXT,
  "fitScore" INTEGER,
  "intentScore" INTEGER NOT NULL DEFAULT 0,
  "intentStatus" TEXT NOT NULL DEFAULT 'unknown',
  "complexityScore" INTEGER,
  "reachabilityScore" INTEGER NOT NULL DEFAULT 0,
  "priorityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "classification" TEXT NOT NULL DEFAULT 'UNQUALIFIED',
  "generalEmail" TEXT,
  "reservationsEmail" TEXT,
  "managerEmail" TEXT,
  "ownerName" TEXT,
  "phone" TEXT,
  "facebook" TEXT,
  "instagram" TEXT,
  "linkedin" TEXT,
  "contactForm" TEXT,
  "bestContactMethod" TEXT,
  "decisionMaker" TEXT,
  "contactReason" TEXT,
  "analysedAt" TIMESTAMP(3),
  "nextAnalysisAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LeadIntelligenceLead_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "LeadIntelligenceRun" (
  "id" TEXT NOT NULL,
  "runKey" TEXT NOT NULL,
  "activeLock" TEXT,
  "trigger" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'running',
  "discovered" INTEGER NOT NULL DEFAULT 0,
  "analysed" INTEGER NOT NULL DEFAULT 0,
  "drafts" INTEGER NOT NULL DEFAULT 0,
  "queries" INTEGER NOT NULL DEFAULT 0,
  "modelCalls" INTEGER NOT NULL DEFAULT 0,
  "errors" JSONB,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "LeadIntelligenceRun_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "LeadIntelligenceAnalysis" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "runId" TEXT,
  "modelVersion" TEXT NOT NULL,
  "facts" JSONB NOT NULL,
  "scores" JSONB NOT NULL,
  "sources" JSONB NOT NULL,
  "reasoning" JSONB NOT NULL,
  "emailSubject" TEXT,
  "emailBody" TEXT,
  "followupSubject" TEXT,
  "followupBody" TEXT,
  "phoneOpener" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeadIntelligenceAnalysis_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LeadIntelligenceLead_dedupeKey_key" ON "LeadIntelligenceLead"("dedupeKey");
CREATE INDEX "LeadIntelligenceLead_country_county_idx" ON "LeadIntelligenceLead"("country", "county");
CREATE INDEX "LeadIntelligenceLead_classification_priorityScore_idx" ON "LeadIntelligenceLead"("classification", "priorityScore");
CREATE INDEX "LeadIntelligenceLead_status_nextAnalysisAt_idx" ON "LeadIntelligenceLead"("status", "nextAnalysisAt");
CREATE UNIQUE INDEX "LeadIntelligenceRun_runKey_key" ON "LeadIntelligenceRun"("runKey");
CREATE UNIQUE INDEX "LeadIntelligenceRun_activeLock_key" ON "LeadIntelligenceRun"("activeLock");
CREATE INDEX "LeadIntelligenceRun_startedAt_idx" ON "LeadIntelligenceRun"("startedAt");
CREATE INDEX "LeadIntelligenceAnalysis_leadId_createdAt_idx" ON "LeadIntelligenceAnalysis"("leadId", "createdAt");
CREATE INDEX "LeadIntelligenceAnalysis_runId_idx" ON "LeadIntelligenceAnalysis"("runId");
ALTER TABLE "LeadIntelligenceAnalysis" ADD CONSTRAINT "LeadIntelligenceAnalysis_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "LeadIntelligenceLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadIntelligenceAnalysis" ADD CONSTRAINT "LeadIntelligenceAnalysis_runId_fkey" FOREIGN KEY ("runId") REFERENCES "LeadIntelligenceRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;