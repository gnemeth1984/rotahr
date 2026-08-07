-- CreateTable
CREATE TABLE "InboundEmail" (
    "id" TEXT NOT NULL,
    "imapUid" INTEGER NOT NULL,
    "mailbox" TEXT NOT NULL DEFAULT 'INBOX',
    "messageId" TEXT,
    "inReplyTo" TEXT,
    "references" TEXT,
    "fromEmail" TEXT NOT NULL,
    "fromName" TEXT,
    "toEmail" TEXT,
    "subject" TEXT NOT NULL,
    "bodyText" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "isAutomated" BOOLEAN NOT NULL DEFAULT false,
    "category" TEXT,
    "intent" TEXT,
    "sentiment" TEXT,
    "confidence" DOUBLE PRECISION,
    "language" TEXT,
    "needsHuman" BOOLEAN NOT NULL DEFAULT false,
    "escalationReason" TEXT,
    "draftSubject" TEXT,
    "draftBody" TEXT,
    "draftModel" TEXT,
    "draftedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'new',
    "sentAt" TIMESTAMP(3),
    "sentBody" TEXT,
    "sentById" TEXT,
    "editedByHuman" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboundEmail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboxSyncState" (
    "mailbox" TEXT NOT NULL,
    "lastUid" INTEGER NOT NULL DEFAULT 0,
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboxSyncState_pkey" PRIMARY KEY ("mailbox")
);

-- CreateIndex
CREATE UNIQUE INDEX "InboundEmail_mailbox_imapUid_key" ON "InboundEmail"("mailbox", "imapUid");

-- CreateIndex
CREATE INDEX "InboundEmail_status_receivedAt_idx" ON "InboundEmail"("status", "receivedAt");

-- CreateIndex
CREATE INDEX "InboundEmail_category_idx" ON "InboundEmail"("category");

-- CreateIndex
CREATE INDEX "InboundEmail_fromEmail_idx" ON "InboundEmail"("fromEmail");
