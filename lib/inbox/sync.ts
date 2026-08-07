/**
 * Pull new mail from the sales@ mailbox, classify it, and stage a draft reply.
 *
 * Nothing in this file sends anything. Sending is always a separate, explicit
 * human action from the Inbox tab — so a bug here can at worst produce a bad
 * draft that someone reads and discards, never a bad email that a customer
 * receives.
 */

import { prisma } from "@/lib/prisma";
import { fetchNewMessages, imapConfigured } from "./imap";
import { analyseEmail } from "./assistant";

const MAILBOX = "INBOX";

export interface SyncResult {
  ok: boolean;
  fetched: number;
  stored: number;
  analysed: number;
  skippedAutomated: number;
  failures: { uid: number; error: string }[];
  lastUid: number;
  error?: string;
}

export async function syncInbox(limit = 25): Promise<SyncResult> {
  const base: SyncResult = {
    ok: false,
    fetched: 0,
    stored: 0,
    analysed: 0,
    skippedAutomated: 0,
    failures: [],
    lastUid: 0,
  };

  if (!imapConfigured()) {
    return { ...base, error: "INBOX_IMAP_PASSWORD is not set" };
  }

  const state = await prisma.inboxSyncState.findUnique({ where: { mailbox: MAILBOX } });
  const sinceUid = state?.lastUid ?? 0;
  base.lastUid = sinceUid;

  let messages;
  try {
    messages = await fetchNewMessages(sinceUid, limit);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await prisma.inboxSyncState.upsert({
      where: { mailbox: MAILBOX },
      create: { mailbox: MAILBOX, lastUid: sinceUid, lastSyncAt: new Date(), lastError: error },
      update: { lastSyncAt: new Date(), lastError: error },
    });
    return { ...base, error };
  }

  base.fetched = messages.length;
  let highestUid = sinceUid;

  for (const msg of messages) {
    highestUid = Math.max(highestUid, msg.uid);

    // The unique constraint on (mailbox, uid) is the real guard against a
    // double-fired cron or an overlapping manual sync creating two rows — and
    // therefore two drafts — for one message. Checking first keeps the common
    // case cheap; the constraint keeps it correct under a race.
    const existing = await prisma.inboundEmail.findUnique({
      where: { mailbox_imapUid: { mailbox: MAILBOX, imapUid: msg.uid } },
      select: { id: true },
    });
    if (existing) continue;

    let row;
    try {
      row = await prisma.inboundEmail.create({
        data: {
          imapUid: msg.uid,
          mailbox: MAILBOX,
          messageId: msg.messageId,
          inReplyTo: msg.inReplyTo,
          references: msg.references,
          fromEmail: msg.fromEmail,
          fromName: msg.fromName,
          toEmail: msg.toEmail,
          subject: msg.subject,
          bodyText: msg.bodyText,
          receivedAt: msg.receivedAt,
          isAutomated: msg.isAutomated,
          status: "new",
        },
      });
      base.stored++;
    } catch {
      // Lost the race with a concurrent sync; the other run owns this message.
      continue;
    }

    // Bounces and autoresponders are recorded for visibility but never drafted
    // for: answering a mail loop is how you end up in a mail loop.
    if (msg.isAutomated) {
      await prisma.inboundEmail.update({
        where: { id: row.id },
        data: { status: "ignored", category: "other", needsHuman: false },
      });
      base.skippedAutomated++;
      continue;
    }

    try {
      const lead = await prisma.outreachLead.findUnique({
        where: { email: msg.fromEmail },
        select: { id: true },
      });

      const analysis = await analyseEmail({
        fromEmail: msg.fromEmail,
        fromName: msg.fromName,
        subject: msg.subject,
        bodyText: msg.bodyText,
        isOutreachLead: Boolean(lead),
      });

      await prisma.inboundEmail.update({
        where: { id: row.id },
        data: {
          category: analysis.category,
          intent: analysis.intent,
          sentiment: analysis.sentiment,
          confidence: analysis.confidence,
          language: analysis.language,
          needsHuman: analysis.needsHuman,
          escalationReason: analysis.escalationReason,
          draftSubject: analysis.draftSubject,
          draftBody: analysis.draftBody,
          draftModel: analysis.model,
          draftedAt: new Date(),
          status: analysis.category === "spam" ? "ignored" : "drafted",
        },
      });
      base.analysed++;

      // Someone replying to a cold email has, by definition, stopped being a
      // cold prospect. Marking the lead terminal here stops the outreach
      // sequence from sending them a follow-up that ignores what they just said.
      if (lead) {
        await prisma.outreachLead.update({
          where: { id: lead.id },
          data: { status: "replied", repliedAt: new Date() },
        });
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      // A classification failure must leave the message visible and flagged,
      // never silently dropped — an unanswered real customer is the worst case.
      await prisma.inboundEmail.update({
        where: { id: row.id },
        data: { needsHuman: true, escalationReason: "AI analysis failed", error, status: "new" },
      });
      base.failures.push({ uid: msg.uid, error });
    }
  }

  await prisma.inboxSyncState.upsert({
    where: { mailbox: MAILBOX },
    create: { mailbox: MAILBOX, lastUid: highestUid, lastSyncAt: new Date(), lastError: null },
    update: { lastUid: highestUid, lastSyncAt: new Date(), lastError: null },
  });

  return { ...base, ok: true, lastUid: highestUid };
}

export async function inboxStats() {
  const [byStatus, byCategory, needsHuman, state, recentFailures] = await Promise.all([
    prisma.inboundEmail.groupBy({ by: ["status"], _count: true }),
    prisma.inboundEmail.groupBy({ by: ["category"], _count: true }),
    prisma.inboundEmail.count({ where: { needsHuman: true, status: { in: ["new", "drafted"] } } }),
    prisma.inboxSyncState.findUnique({ where: { mailbox: MAILBOX } }),
    prisma.inboundEmail.count({ where: { error: { not: null } } }),
  ]);

  return {
    byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count])),
    byCategory: Object.fromEntries(byCategory.map((c) => [c.category ?? "unclassified", c._count])),
    needsHuman,
    withErrors: recentFailures,
    lastSyncAt: state?.lastSyncAt ?? null,
    lastError: state?.lastError ?? null,
    imapConfigured: imapConfigured(),
  };
}
