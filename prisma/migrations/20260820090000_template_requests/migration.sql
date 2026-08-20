-- CreateTable
CREATE TABLE "TemplateRequest" (
    "id" TEXT NOT NULL,
    "request" TEXT NOT NULL,
    "email" TEXT,
    "venueType" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "fulfilledBy" TEXT,
    "notifiedAt" TIMESTAMP(3),
    "adminNote" TEXT,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemplateRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TemplateRequest_status_idx" ON "TemplateRequest"("status");

-- CreateIndex
CREATE INDEX "TemplateRequest_createdAt_idx" ON "TemplateRequest"("createdAt");
