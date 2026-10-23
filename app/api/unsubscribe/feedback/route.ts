import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isSuppressed, normaliseEmail } from "@/lib/email/suppression";
import {
  UNSUB_COMMENT_MAX,
  UNSUB_FEEDBACK_ACTION,
  isUnsubReason,
} from "@/lib/email/unsubscribe-feedback";

export const dynamic = "force-dynamic";

/**
 * POST /api/unsubscribe/feedback { email, reason, comment? }
 *
 * Optional "why did you leave" answer from the /unsubscribe page. Only accepted
 * for an address that is already unsubscribed, so it can't be used to write
 * arbitrary rows, and it changes nothing about the opt-out itself.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = typeof body?.email === "string" ? normaliseEmail(body.email) : "";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }
  if (!isUnsubReason(body?.reason)) {
    return NextResponse.json({ error: "Unknown reason" }, { status: 400 });
  }
  const comment =
    typeof body?.comment === "string"
      ? body.comment.replace(/\s+/g, " ").trim().slice(0, UNSUB_COMMENT_MAX)
      : "";

  if (!(await isSuppressed(email))) {
    return NextResponse.json({ error: "Not unsubscribed" }, { status: 409 });
  }

  // One answer per address: the latest replaces any earlier one.
  const existing = await prisma.activityLog.findMany({
    where: { action: UNSUB_FEEDBACK_ACTION, details: { path: ["email"], equals: email } },
    select: { id: true },
    take: 20,
  });
  const details = { email, reason: body.reason, comment: comment || null };
  if (existing.length > 0) {
    await prisma.activityLog.update({
      where: { id: existing[0].id },
      data: { details, createdAt: new Date() },
    });
    if (existing.length > 1) {
      await prisma.activityLog.deleteMany({ where: { id: { in: existing.slice(1).map((e) => e.id) } } });
    }
  } else {
    await prisma.activityLog.create({ data: { action: UNSUB_FEEDBACK_ACTION, details } });
  }
  return NextResponse.json({ ok: true });
}
