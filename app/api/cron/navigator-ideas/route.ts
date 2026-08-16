// Navigator daily ideas.
//
// Runs once a day, shortly after the morning pulse refresh so it is always
// reasoning about fresh numbers rather than yesterday's. Deliberately AFTER
// 06:10 UTC (the pulse cron) and before the warm-up is likely to be read.
//
// This job never notifies. Ideas land silently in the triage inbox; the nudge
// channel is reserved for things that are time-critical.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { dublinNow } from "@/lib/cron/service-hours";
import { wrapCron } from "@/lib/cron-run";

async function __cronHandler(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const secret =
    req.headers.get("x-cron-secret") || new URL(req.url).searchParams.get("secret");
  const authed =
    authHeader === `Bearer ${process.env.CRON_SECRET}` || secret === process.env.CRON_SECRET;
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { hour } = dublinNow(new Date());
  if (hour >= 23 || hour < 6) return NextResponse.json({ skipped: "hard quiet hours", hour });

  const { prisma } = await import("@/lib/db");
  const { generateIdeas } = await import("@/lib/navigator/ideas");

  const profiles = await prisma.navProfile.findMany({
    where: { ideasEnabled: true, systemAccess: true },
    select: { userId: true },
  });
  if (!profiles.length) return NextResponse.json({ ok: true, profiles: 0 });

  const results: Record<string, unknown>[] = [];
  let failed = 0;

  for (const { userId } of profiles) {
    try {
      const out = await generateIdeas(userId);
      results.push({ userId, created: out.created, skipped: out.skipped, titles: out.titles });
    } catch (err) {
      failed += 1;
      // One user's failure must not stop the loop; the error still surfaces via
      // the non-200 status below, which is what CronRun records.
      results.push({ userId, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return NextResponse.json(
    { ok: failed === 0, profiles: profiles.length, failed, results },
    { status: failed > 0 ? 500 : 200 }
  );
}

export const GET = wrapCron("navigator-ideas", __cronHandler as any, {
  skipWhen: (status, body) => status === 200 && body.includes("hard quiet hours"),
});
