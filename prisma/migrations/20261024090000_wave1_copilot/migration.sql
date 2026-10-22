-- Wave 1: Manager Copilot. Additive only (3 new tables), safe to apply before or after deploy.
-- Apply with prisma db execute + migrate resolve (NOT migrate deploy).

-- CreateTable
CREATE TABLE "StockPriceChange" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "stockItemId" TEXT NOT NULL,
    "oldPrice" DOUBLE PRECISION,
    "newPrice" DOUBLE PRECISION,
    "packSize" DOUBLE PRECISION,
    "source" TEXT NOT NULL,
    "changedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockPriceChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpsBrief" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "venueKey" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "summary" TEXT,
    "summarySource" TEXT NOT NULL DEFAULT 'rules',
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpsBrief_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CopilotSettings" (
    "businessId" TEXT NOT NULL,
    "targetGpPct" DOUBLE PRECISION NOT NULL DEFAULT 70,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CopilotSettings_pkey" PRIMARY KEY ("businessId")
);

-- CreateIndex
CREATE INDEX "StockPriceChange_businessId_createdAt_idx" ON "StockPriceChange"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "StockPriceChange_stockItemId_createdAt_idx" ON "StockPriceChange"("stockItemId", "createdAt");

-- CreateIndex
CREATE INDEX "OpsBrief_businessId_generatedAt_idx" ON "OpsBrief"("businessId", "generatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "OpsBrief_businessId_venueKey_date_key" ON "OpsBrief"("businessId", "venueKey", "date");

-- AddForeignKey
ALTER TABLE "StockPriceChange" ADD CONSTRAINT "StockPriceChange_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockPriceChange" ADD CONSTRAINT "StockPriceChange_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpsBrief" ADD CONSTRAINT "OpsBrief_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CopilotSettings" ADD CONSTRAINT "CopilotSettings_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

