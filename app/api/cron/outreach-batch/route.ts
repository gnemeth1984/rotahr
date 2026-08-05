export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { runBatch, DEFAULT_DAILY_LIMIT } from "@/lib/outreach/sender";
import { isBrevoConfigured } from "@/lib/outreach/brevo";

/**
 * Weekday cold-outreach batch.
 *
 * Off by default: `OUTREACH_CRON_ENABLED` must be `true`. The cron entry can
 * therefore ship without the first automated run going out to real strangers
 * before anyone has reviewed a batch.
 *
 * `runBatch()` is awaited — a serverless function is frozen when it responds,
 * so anything not awaited is silently dropped in production.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (process.env.OUTREACH_CRON_ENABLED !== "true") {
    return NextResponse.json({
      skipped: true,
      reason: "OUTREACH_CRON_ENABLED is not 'true'",
    });
  }

  if (!isBrevoConfigured()) {
    return NextResponse.json({ skipped: true, reason: "BREVO_API_KEY is not set" });
  }

  // The per-run size is capped well under the daily limit so one run can't
  // consume the whole day's allowance in a single burst.
  const perRun = Number(process.env.OUTREACH_BATCH_SIZE || 25);

  const result = await runBatch({ limit: Math.min(perRun, DEFAULT_DAILY_LIMIT) });

  return NextResponse.json({
    ok: true,
    sent: result.sent,
    skipped: result.skipped,
    attempted: result.attempted,
    sentToday: result.sentToday,
    dailyLimit: result.dailyLimit,
    reason: result.reason,
  });
}
