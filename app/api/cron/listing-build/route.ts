export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { buildQueue, autopilotEnabled } from "@/lib/outreach/listing-autopilot";
import { wrapCron } from "@/lib/cron-run";

/**
 * Overnight build phase of the listing autopilot.
 *
 * Publishes prospect venue pages and emails nobody. Runs hours before
 * /api/cron/listing-invites so every page has been sitting in the admin
 * Listings tab long enough to be binned if the extraction came out wrong.
 *
 * Own cron rather than a phase of the send job because each build is a website
 * fetch plus a model call — fourteen of them will not fit in the same 300s
 * function as the sends.
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

  // Awaited: a serverless function is frozen the moment it responds, so
  // anything left running is silently dropped in production.
  const result = await buildQueue({ deadlineMs: 240_000 });

  return NextResponse.json({
    ok: true,
    built: result.built,
    failed: result.failed,
    attempted: result.attempted,
    poolRemaining: result.poolRemaining,
    indexnow: result.indexnow,
    stoppedEarly: result.stoppedEarly,
    outcomes: result.outcomes,
  });
}

export const GET = wrapCron("listing-build", __cronHandler as any);
