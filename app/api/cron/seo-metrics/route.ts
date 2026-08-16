/**
 * Daily Search Console snapshot — stores day-by-day clicks, impressions, CTR
 * and average position so the dashboard can show a real trend line.
 *
 * Runs every morning. Also safe to call by hand with a bigger window to
 * backfill history (Search Console keeps 16 months):
 *
 * GET  /api/cron/seo-metrics?secret=CRON_SECRET&days=480
 * POST /api/cron/seo-metrics
 */

import { NextResponse } from "next/server";
import { snapshotMetrics } from "@/lib/seo/autopilot";
import { canRunSeo } from "@/lib/seo/auth";
import { wrapCron } from "@/lib/cron-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function run(req: Request) {
  if (!(await canRunSeo(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Default 90 days: enough to draw a trend on the very first run, small
  // enough to stay well inside maxDuration. Capped at Search Console's own
  // 16-month retention limit.
  const raw = Number(new URL(req.url).searchParams.get("days"));
  const days = Number.isFinite(raw) && raw > 0 ? Math.min(Math.floor(raw), 480) : 90;

  try {
    const result = await snapshotMetrics(days);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[cron/seo-metrics]", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

const __wrapped = wrapCron("seo-metrics", run as any);
export const GET = __wrapped;
export const POST = __wrapped;
