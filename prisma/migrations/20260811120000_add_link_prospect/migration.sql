-- LinkProspect: off-site visibility pipeline (directories, press, guest posts,
-- podcasts, associations). See schema.prisma for why this is deliberately not
-- an automated sender.
CREATE TABLE "LinkProspect" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'directory',
    "region" TEXT NOT NULL DEFAULT 'general',
    "contactEmail" TEXT,
    "contactName" TEXT,
    "contactNote" TEXT,
    "weight" INTEGER NOT NULL DEFAULT 5,
    "angle" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "liveUrl" TEXT,
    "sentAt" TIMESTAMP(3),
    "liveAt" TIMESTAMP(3),
    "followUpAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LinkProspect_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LinkProspect_url_key" ON "LinkProspect"("url");
CREATE INDEX "LinkProspect_status_weight_idx" ON "LinkProspect"("status", "weight");
CREATE INDEX "LinkProspect_kind_idx" ON "LinkProspect"("kind");
