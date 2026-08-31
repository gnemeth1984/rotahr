-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "loyaltyTier" TEXT NOT NULL DEFAULT 'bronze',
ADD COLUMN     "loyaltyPoints" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "tierUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "vipSince" TIMESTAMP(3),
ADD COLUMN     "visitCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalSpend" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "averageSpend" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "lastVisitAt" TIMESTAMP(3),
ADD COLUMN     "favouriteDishes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "statsUpdatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "GuestTransaction" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "totalSpend" DOUBLE PRECISION NOT NULL,
    "covers" INTEGER,
    "items" JSONB,
    "itemsText" TEXT,
    "notes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "posRef" TEXT,
    "reservationId" TEXT,
    "recordedById" TEXT,
    "recordedBy" TEXT,
    "pointsAwarded" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuestTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyTier" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minVisits" INTEGER NOT NULL DEFAULT 0,
    "minSpend" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "perks" TEXT,
    "colour" TEXT NOT NULL DEFAULT 'slate',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoyaltyTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltySettings" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "pointsPerCurrency" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "pointValue" DOUBLE PRECISION NOT NULL DEFAULT 0.05,
    "vipSpendThreshold" DOUBLE PRECISION NOT NULL DEFAULT 500,
    "autoUpgrade" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoyaltySettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyRedemption" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "reward" TEXT NOT NULL,
    "valueAmount" DOUBLE PRECISION,
    "notes" TEXT,
    "recordedById" TEXT,
    "recordedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "segment" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'email',
    "subject" TEXT,
    "message" TEXT NOT NULL,
    "scheduleAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'draft',
    "automationRule" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignSend" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "toAddress" TEXT,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "skipReason" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "providerId" TEXT,
    "dedupeKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignSend_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GuestTransaction_businessId_date_idx" ON "GuestTransaction"("businessId", "date");

-- CreateIndex
CREATE INDEX "GuestTransaction_customerId_date_idx" ON "GuestTransaction"("customerId", "date");

-- CreateIndex
CREATE INDEX "GuestTransaction_businessId_posRef_idx" ON "GuestTransaction"("businessId", "posRef");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyTier_businessId_key_key" ON "LoyaltyTier"("businessId", "key");

-- CreateIndex
CREATE INDEX "LoyaltyTier_businessId_idx" ON "LoyaltyTier"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltySettings_businessId_key" ON "LoyaltySettings"("businessId");

-- CreateIndex
CREATE INDEX "LoyaltyRedemption_businessId_createdAt_idx" ON "LoyaltyRedemption"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "LoyaltyRedemption_customerId_idx" ON "LoyaltyRedemption"("customerId");

-- CreateIndex
CREATE INDEX "Campaign_businessId_status_idx" ON "Campaign"("businessId", "status");

-- CreateIndex
CREATE INDEX "Campaign_businessId_automationRule_idx" ON "Campaign"("businessId", "automationRule");

-- CreateIndex
CREATE INDEX "CampaignSend_campaignId_status_idx" ON "CampaignSend"("campaignId", "status");

-- CreateIndex
CREATE INDEX "CampaignSend_businessId_status_idx" ON "CampaignSend"("businessId", "status");

-- CreateIndex
CREATE INDEX "CampaignSend_customerId_idx" ON "CampaignSend"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignSend_campaignId_dedupeKey_key" ON "CampaignSend"("campaignId", "dedupeKey");

-- AddForeignKey
ALTER TABLE "GuestTransaction" ADD CONSTRAINT "GuestTransaction_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestTransaction" ADD CONSTRAINT "GuestTransaction_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyTier" ADD CONSTRAINT "LoyaltyTier_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltySettings" ADD CONSTRAINT "LoyaltySettings_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyRedemption" ADD CONSTRAINT "LoyaltyRedemption_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyRedemption" ADD CONSTRAINT "LoyaltyRedemption_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignSend" ADD CONSTRAINT "CampaignSend_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignSend" ADD CONSTRAINT "CampaignSend_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignSend" ADD CONSTRAINT "CampaignSend_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
