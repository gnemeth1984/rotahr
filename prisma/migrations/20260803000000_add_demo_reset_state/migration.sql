CREATE TABLE IF NOT EXISTS "DemoResetState" (
  "id"         TEXT NOT NULL,
  "running"    BOOLEAN NOT NULL DEFAULT false,
  "startedAt"  TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DemoResetState_pkey" PRIMARY KEY ("id")
);
