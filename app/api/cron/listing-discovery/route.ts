// Weekly free-visibility hunt.
//
// Two phases, deliberately in one cron:
//   1. discover — search for places Rotahr can be listed for free, vet each one
//      with a model that is instructed to reject by default, store the keepers
//      with paste-ready copy (and the rejections, so they are never re-vetted).
//   2. hand out — push the top two un-tasked prospects into the Navigator queue.
//
// One job rather than two because phase 2 is worthless without phase 1 having
// topped the pool up, and splitting them only adds a second thing that can
// silently stop running.
//
// Nothing here submits anything. Every directory worth appearing in gates on a
// captcha or an editor; the ones that accept an automated POST are link farms.
// See lib/seo/listing-discovery.ts for the full reasoning.
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

  const { discoverListings } = await import("@/lib/seo/listing-discovery");
  const { createListingTasks } = await import("@/lib/seo/listing-tasks");
  const { prisma } = await import("@/lib/db");

  // Awaited, not fire-and-forget: a serverless function is frozen the moment it
  // responds and anything still running is dropped.
  const discovery = await discoverListings();

  // Hand-out runs even when discovery found nothing — there is already a
  // backlog of seeded prospects that has never been touched.
  const profiles = await prisma.navProfile.findMany({
    where: { systemAccess: true },
    select: { userId: true },
  });

  const tasks: Record<string, unknown>[] = [];
  for (const { userId } of profiles) {
    try {
      const out = await createListingTasks(userId);
      tasks.push({ userId, created: out.created, skipped: out.skipped, titles: out.titles });
    } catch (err) {
      tasks.push({ userId, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return NextResponse.json({
    ok: discovery.ok,
    discovery: {
      queries: discovery.queries,
      seen: discovery.seen,
      plausible: discovery.plausible,
      vetted: discovery.vetted,
      added: discovery.added,
      names: discovery.names,
      rejected: discovery.rejected,
      skipped: discovery.skipped,
    },
    tasks,
  });
}

export const GET = wrapCron("listing-discovery", __cronHandler as any);
