-- AI search visibility tracking (GEO): are assistants naming Rotahr?

CREATE TABLE IF NOT EXISTS "AiPrompt" (
  "id" TEXT NOT NULL,
  "prompt" TEXT NOT NULL,
  "cluster" TEXT NOT NULL DEFAULT 'general',
  "intent" TEXT NOT NULL DEFAULT 'commercial',
  "region" TEXT NOT NULL DEFAULT 'general',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiPrompt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AiPrompt_prompt_key" ON "AiPrompt"("prompt");
CREATE INDEX IF NOT EXISTS "AiPrompt_active_idx" ON "AiPrompt"("active");

CREATE TABLE IF NOT EXISTS "AiVisibility" (
  "id" TEXT NOT NULL,
  "promptId" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "answer" TEXT NOT NULL,
  "mentioned" BOOLEAN NOT NULL DEFAULT false,
  "rank" INTEGER,
  "cited" BOOLEAN NOT NULL DEFAULT false,
  "competitors" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiVisibility_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AiVisibility_promptId_createdAt_idx" ON "AiVisibility"("promptId", "createdAt");
CREATE INDEX IF NOT EXISTS "AiVisibility_createdAt_idx" ON "AiVisibility"("createdAt");

DO $$ BEGIN
  ALTER TABLE "AiVisibility"
    ADD CONSTRAINT "AiVisibility_promptId_fkey"
    FOREIGN KEY ("promptId") REFERENCES "AiPrompt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
