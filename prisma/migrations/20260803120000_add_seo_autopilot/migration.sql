-- SEO autopilot: keyword pipeline, Search Console snapshots, run log,
-- plus the per-article fields the autopilot writes.

ALTER TABLE "BlogPost"
  ADD COLUMN IF NOT EXISTS "keyword" TEXT,
  ADD COLUMN IF NOT EXISTS "faq" TEXT,
  ADD COLUMN IF NOT EXISTS "wordCount" INTEGER,
  ADD COLUMN IF NOT EXISTS "refreshedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "refreshCount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "SeoKeyword" (
  "id" TEXT NOT NULL,
  "keyword" TEXT NOT NULL,
  "cluster" TEXT NOT NULL DEFAULT 'general',
  "intent" TEXT NOT NULL DEFAULT 'informational',
  "region" TEXT NOT NULL DEFAULT 'general',
  "source" TEXT NOT NULL DEFAULT 'seed',
  "impressions" INTEGER NOT NULL DEFAULT 0,
  "clicks" INTEGER NOT NULL DEFAULT 0,
  "position" DOUBLE PRECISION,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'new',
  "postId" TEXT,
  "note" TEXT,
  "writtenAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SeoKeyword_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SeoKeyword_keyword_key" ON "SeoKeyword"("keyword");
CREATE INDEX IF NOT EXISTS "SeoKeyword_status_priority_idx" ON "SeoKeyword"("status", "priority");
CREATE INDEX IF NOT EXISTS "SeoKeyword_cluster_idx" ON "SeoKeyword"("cluster");

CREATE TABLE IF NOT EXISTS "SeoMetric" (
  "id" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "page" TEXT NOT NULL,
  "query" TEXT NOT NULL DEFAULT '',
  "clicks" INTEGER NOT NULL DEFAULT 0,
  "impressions" INTEGER NOT NULL DEFAULT 0,
  "ctr" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "position" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SeoMetric_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SeoMetric_date_page_query_key" ON "SeoMetric"("date", "page", "query");
CREATE INDEX IF NOT EXISTS "SeoMetric_page_date_idx" ON "SeoMetric"("page", "date");
CREATE INDEX IF NOT EXISTS "SeoMetric_date_idx" ON "SeoMetric"("date");

CREATE TABLE IF NOT EXISTS "SeoRun" (
  "id" TEXT NOT NULL,
  "task" TEXT NOT NULL,
  "ok" BOOLEAN NOT NULL DEFAULT true,
  "detail" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SeoRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SeoRun_task_createdAt_idx" ON "SeoRun"("task", "createdAt");
