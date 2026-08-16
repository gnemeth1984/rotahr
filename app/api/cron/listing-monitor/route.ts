// Weekly liveness check on listings Rotahr has already earned.
//
// A directory profile is not permanent: sites get redesigned, free tiers get
// pruned, profiles get archived for inactivity, roundups get re-cut. None of
// that sends a notification, and with traffic near zero a link that quietly
// vanished looks identical to one that is still working.
//
// A page counts as alive only if it loads AND still mentions Rotahr — a bare
// 200 would miss the most common failure. Three consecutive weekly failures
// before demotion, because one bad fetch is usually downtime or bot-blocking.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { wrapCron } from "@/lib/cron-run";

async function __cronHandler(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const secret =
    req.headers.get("x-cron-secret") || new URL(req.url).searchParams.get("secret");
  const authed =
    (!!process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`) ||
    (!!process.env.CRON_SECRET && secret === process.env.CRON_SECRET);
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { monitorListings } = await import("@/lib/seo/listing-monitor");

  const result = await monitorListings(60);

  return NextResponse.json({
    ok: result.ok,
    checked: result.checked,
    alive: result.alive,
    failed: result.failed,
    blocked: result.blocked,
    demoted: result.demoted,
    recovered: result.recovered,
    outcomes: result.outcomes,
  });
}

export const GET = wrapCron("listing-monitor", __cronHandler as any);
