-- AlterTable
ALTER TABLE "LeadIntelligenceLead" ADD COLUMN     "grade" TEXT NOT NULL DEFAULT 'D',
ADD COLUMN     "leadScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "signalSummary" JSONB;

-- CreateTable
CREATE TABLE "LeadIntelligenceSignal" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "detail" TEXT NOT NULL DEFAULT '',
    "eventDate" TIMESTAMP(3),
    "data" JSONB,
    "fingerprint" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadIntelligenceSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadIntelligenceFhrs" (
    "id" TEXT NOT NULL,
    "fhrsId" INTEGER NOT NULL,
    "businessName" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "address" TEXT NOT NULL DEFAULT '',
    "postcode" TEXT NOT NULL DEFAULT '',
    "town" TEXT NOT NULL,
    "localAuthority" TEXT NOT NULL DEFAULT '',
    "rating" TEXT NOT NULL,
    "ratingDate" TIMESTAMP(3),
    "businessType" TEXT NOT NULL DEFAULT '',
    "businessTypeId" INTEGER,
    "phone" TEXT,
    "leadId" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadIntelligenceFhrs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadIntelligenceFsaiOrder" (
    "id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "orderType" TEXT NOT NULL,
    "premises" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "address" TEXT NOT NULL DEFAULT '',
    "county" TEXT NOT NULL DEFAULT '',
    "businessType" TEXT NOT NULL DEFAULT '',
    "dateServed" TIMESTAMP(3) NOT NULL,
    "dateLifted" TIMESTAMP(3),
    "orderUrl" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "hospitality" BOOLEAN NOT NULL DEFAULT false,
    "leadId" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadIntelligenceFsaiOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadIntelligenceSourceSync" (
    "source" TEXT NOT NULL,
    "cursor" INTEGER NOT NULL DEFAULT 0,
    "lastRunAt" TIMESTAMP(3),
    "lastStatus" TEXT NOT NULL DEFAULT 'never',
    "details" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadIntelligenceSourceSync_pkey" PRIMARY KEY ("source")
);

-- CreateIndex
CREATE UNIQUE INDEX "LeadIntelligenceSignal_fingerprint_key" ON "LeadIntelligenceSignal"("fingerprint");

-- CreateIndex
CREATE INDEX "LeadIntelligenceSignal_leadId_type_idx" ON "LeadIntelligenceSignal"("leadId", "type");

-- CreateIndex
CREATE INDEX "LeadIntelligenceSignal_type_eventDate_idx" ON "LeadIntelligenceSignal"("type", "eventDate");

-- CreateIndex
CREATE UNIQUE INDEX "LeadIntelligenceFhrs_fhrsId_key" ON "LeadIntelligenceFhrs"("fhrsId");

-- CreateIndex
CREATE INDEX "LeadIntelligenceFhrs_nameKey_town_idx" ON "LeadIntelligenceFhrs"("nameKey", "town");

-- CreateIndex
CREATE INDEX "LeadIntelligenceFhrs_leadId_idx" ON "LeadIntelligenceFhrs"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "LeadIntelligenceFsaiOrder_fingerprint_key" ON "LeadIntelligenceFsaiOrder"("fingerprint");

-- CreateIndex
CREATE INDEX "LeadIntelligenceFsaiOrder_nameKey_idx" ON "LeadIntelligenceFsaiOrder"("nameKey");

-- CreateIndex
CREATE INDEX "LeadIntelligenceFsaiOrder_orderType_dateServed_idx" ON "LeadIntelligenceFsaiOrder"("orderType", "dateServed");

-- CreateIndex
CREATE INDEX "LeadIntelligenceLead_grade_leadScore_idx" ON "LeadIntelligenceLead"("grade", "leadScore");

-- CreateIndex
CREATE INDEX "LeadIntelligenceLead_leadScore_idx" ON "LeadIntelligenceLead"("leadScore");

-- AddForeignKey
ALTER TABLE "LeadIntelligenceSignal" ADD CONSTRAINT "LeadIntelligenceSignal_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "LeadIntelligenceLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

