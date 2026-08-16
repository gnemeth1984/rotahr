export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { sendQueue, autopilotEnabled } from "@/lib/outreach/listing-autopilot";
import { isBrevoConfigured } from "@/lib/outreach/brevo";
import { wrapCron } from "@/lib/cron-run";

/**
 * Morning send phase: up to LISTING_INVITE_DAILY_LIMIT listing invites, oldest
 * page first, only for pages that have been live past the review window.
 *
 * Weekdays only. A cold email that lands on a Sunday to a venue in the middle
 * of service is read late or not at all.
 */
async function __cronHandler(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!autopilotEnabled()) {
    return NextResponse.json({
      skipped: true,
      reason: "LISTING_AUTOPILOT_ENABLED is not 'true'",
    });
  }

  if (!isBrevoConfigured()) {
    return NextResponse.json({ skipped: true, reason: "BREVO_API_KEY is not set" });
  }

  const result = await sendQueue({ via: "cron" });

  return NextResponse.json({
    ok: true,
    sent: result.sent,
    skipped: result.skipped,
    attempted: result.attempted,
    sentToday: result.sentToday,
    dailyLimit: result.dailyLimit,
    queueDepth: result.queueDepth,
    reason: result.reason,
    outcomes: result.outcomes,
  });
}

export const GET = wrapCron("listing-invites", __cronHandler as any);
