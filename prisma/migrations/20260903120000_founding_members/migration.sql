-- Founding member programme.
--
-- A founding member is granted Pro for 12 months at no cost in exchange for a
-- short monthly call and a testimonial if they end up liking the product.
--
-- Deliberately reuses the existing trial machinery rather than inventing a new
-- access tier: a grant sets lsPlan = 'pro' and trialEndsAt = now + 12 months,
-- which lib/billing/access.ts already understands. `foundingMember` exists only
-- so the programme can be counted, listed and revoked, not to gate anything.

ALTER TABLE "Business" ADD COLUMN "foundingMember" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Business" ADD COLUMN "foundingGrantedAt" TIMESTAMP(3);

CREATE INDEX "Business_foundingMember_idx" ON "Business"("foundingMember");

-- CreateTable
CREATE TABLE "FoundingApplication" (
    "id" TEXT NOT NULL,
    "venueName" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "venueType" TEXT,
    "staffCount" INTEGER,
    "currentTool" TEXT,
    "notes" TEXT,

    -- new | contacted | granted | declined | withdrawn
    "status" TEXT NOT NULL DEFAULT 'new',
    "adminNote" TEXT,
    -- set once a grant is made, so an application can be traced to a business
    "grantedBusinessId" TEXT,

    "ipHash" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FoundingApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FoundingApplication_status_idx" ON "FoundingApplication"("status");

-- CreateIndex
CREATE INDEX "FoundingApplication_createdAt_idx" ON "FoundingApplication"("createdAt");

-- CreateIndex
CREATE INDEX "FoundingApplication_email_idx" ON "FoundingApplication"("email");
