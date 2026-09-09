-- Tutorial: global library of short product how-to videos for /tutorials.
-- Not tenant scoped on purpose (see the model comment in schema.prisma).

CREATE TABLE "Tutorial" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "videoUrl" TEXT NOT NULL,
    "posterUrl" TEXT,
    "durationSeconds" INTEGER,
    "fileSizeBytes" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "views" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tutorial_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Tutorial_slug_key" ON "Tutorial"("slug");

CREATE INDEX "Tutorial_published_sortOrder_idx" ON "Tutorial"("published", "sortOrder");
