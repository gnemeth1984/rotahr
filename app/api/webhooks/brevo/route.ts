export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { suppress, normaliseEmail } from "@/lib/email/suppression";

/**
 * Brevo engagement webhook: opens, clicks, bounces, complaints, unsubscribes.
 *
 * Brevo does not sign its webhooks, so the URL itself carries the secret
 * (`?secret=...`). Without that, anyone could mark leads as bounced.
 *
 * Always responds 200 once authenticated. A non-2xx makes Brevo retry the whole
 * batch, and a single unrecognised event would then replay indefinitely.
 */

type BrevoEvent = {
  event?: string;
  email?: string;
  "message-id"?: string;
  messageId?: string;
  message_id?: string;
  reason?: string;
};

/** Brevo sometimes wraps the id in angle brackets, our stored copy never is. */
function cleanId(raw: string | undefined): string | null {
  const v = (raw || "").trim().replace(/^<|>$/g, "");
  return v || null;
}

async function findSendId(evt: BrevoEvent): Promise<string | null> {
  const messageId = cleanId(evt["message-id"] ?? evt.messageId ?? evt.message_id);

  if (messageId) {
    const byId = await prisma.outreachSend.findUnique({
      where: { messageId },
      select: { id: true },
    });
    if (byId) return byId.id;
  }

  // Fall back to the most recent send to that address. Brevo's id formatting
  // has changed before, and losing engagement data to a format change is worse
  // than attributing an event to the latest email we sent them.
  if (evt.email) {
    const byEmail = await prisma.outreachSend.findFirst({
      where: { email: normaliseEmail(evt.email) },
      orderBy: { sentAt: "desc" },
      select: { id: true },
    });
    if (byEmail) return byEmail.id;
  }

  return null;
}

export async function POST(req: NextRequest) {
  const expected = process.env.BREVO_WEBHOOK_SECRET || process.env.CRON_SECRET;
  const provided = req.nextUrl.searchParams.get("secret");
  if (!expected || provided !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: true, processed: 0 });

  const events: BrevoEvent[] = Array.isArray(body) ? body : [body];
  let processed = 0;
  let unmatched = 0;

  for (const evt of events) {
    const type = (evt.event || "").toLowerCase();
    const sendId = await findSendId(evt);
    if (!sendId) {
      unmatched++;
      continue;
    }

    try {
      if (type === "opened" || type === "unique_opened") {
        // COALESCE keeps the *first* open time rather than overwriting it with
        // each subsequent open of the same email.
        await prisma.$executeRaw`UPDATE "OutreachSend" SET opened = true, "openedAt" = COALESCE("openedAt", NOW()) WHERE id = ${sendId}`;
      } else if (type === "click" || type === "clicked") {
        // A click implies an open, even when the open pixel was blocked.
        await prisma.$executeRaw`UPDATE "OutreachSend" SET clicked = true, opened = true, "clickedAt" = COALESCE("clickedAt", NOW()), "openedAt" = COALESCE("openedAt", NOW()) WHERE id = ${sendId}`;
      } else if (
        type === "hard_bounce" ||
        type === "blocked" ||
        type === "invalid_email" ||
        type === "spam"
      ) {
        const send = await prisma.outreachSend.update({
          where: { id: sendId },
          data: { failedAt: new Date(), failedReason: evt.reason || type },
          select: { leadId: true },
        });
        await prisma.outreachLead.update({
          where: { id: send.leadId },
          data: {
            status: "bounced",
            bouncedAt: new Date(),
            // A hard bounce is the strongest possible evidence that the mailbox
            // does not exist — better than any probe, because a real message was
            // actually attempted. Writing the verdict here keeps the webhook and
            // scripts/verify-leads.ts from disagreeing, and means the send-time
            // gate blocks this address even if the lead is later revived.
            emailVerdict: "dead",
            verifyDetail: `hard bounce via webhook: ${(evt.reason || type).slice(0, 140)}`,
            verifiedAt: new Date(),
          },
        });
        // A spam complaint is an opt-out in every way that matters.
        if (type === "spam" && evt.email) {
          await suppress({ email: evt.email, source: "brevo_webhook", reason: "spam complaint" });
        }
      } else if (type === "unsubscribed" || type === "complaint") {
        const send = await prisma.outreachSend.findUnique({
          where: { id: sendId },
          select: { leadId: true, email: true },
        });
        if (send) {
          await prisma.outreachLead.update({
            where: { id: send.leadId },
            data: { status: "unsubscribed" },
          });
          // Suppression is platform-wide, so the opt-out also covers any other
          // list this address appears on later.
          await suppress({
            email: evt.email || send.email,
            source: "brevo_webhook",
            reason: type,
          });
        }
      } else {
        continue;
      }
      processed++;
    } catch {
      // One bad event must not fail the batch and trigger endless retries.
      unmatched++;
    }
  }

  return NextResponse.json({ ok: true, processed, unmatched, received: events.length });
}
