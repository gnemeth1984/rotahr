-- Template download leads. Additive only (1 new table), safe to apply before or after deploy.
-- Apply with prisma db execute + migrate resolve (NOT migrate deploy).

-- CreateTable
CREATE TABLE "TemplateLead" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "marketingConsent" BOOLEAN NOT NULL DEFAULT false,
    "consentText" TEXT,
    "consentAt" TIMESTAMP(3),
    "firstSlug" TEXT NOT NULL,
    "lastSlug" TEXT NOT NULL,
    "slugs" TEXT[],
    "downloads" INTEGER NOT NULL DEFAULT 1,
    "venueType" TEXT,
    "country" TEXT,
    "step" INTEGER NOT NULL DEFAULT 0,
    "lastSentAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "ipHash" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemplateLead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TemplateLead_email_key" ON "TemplateLead"("email");

-- CreateIndex
CREATE INDEX "TemplateLead_status_step_idx" ON "TemplateLead"("status", "step");

-- CreateIndex
CREATE INDEX "TemplateLead_createdAt_idx" ON "TemplateLead"("createdAt");
