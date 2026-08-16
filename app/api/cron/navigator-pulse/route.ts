// Navigator system-pulse refresh.
//
// Rebuilds the cached Rotahr telemetry that Navigator reads. Scheduled inside
// the same 06:00-22:00 Dublin envelope as the other Navigator crons so it never
// wakes Neon during the suspend window — the pulse is a convenience, not
// something worth paying to keep a database awake overnight for.
//
// Deliberately infrequent. These are trend numbers; refreshing them every few
// hours is plenty, and a stale pulse is labelled as stale rather than hidden.
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
  const { refreshPulse } = await import("@/lib/navigator/rotahr/pulse");
  const { recordCurrentDeploy } = await import("@/lib/navigator/rotahr/shiplog");

  // Only profiles that asked for it. systemAccess off means the telemetry is
  // not just hidden from the prompt — it is never assembled in the first place.
  const profiles = await prisma.navProfile.findMany({
    where: { systemAccess: true },
    select: { userId: true },
  });
  if (!profiles.length) return NextResponse.json({ ok: true, profiles: 0 });

  const results: Record<string, unknown>[] = [];
  for (const { userId } of profiles) {
    await recordCurrentDeploy(userId);
    const out = await refreshPulse(userId);
    results.push({
      userId,
      ok: out.lastError == null,
      durationMs: out.durationMs,
      error: out.lastError,
    });
  }

  const failed = results.filter((r) => !r.ok).length;
  return NextResponse.json({ ok: failed === 0, refreshed: results.length, failed, results }, {
    // A sealPulse throw is a real problem — surface it as a failed cron run so
    // it lands in CronRun and shows up in the health line of the next pulse.
    status: failed > 0 ? 500 : 200,
  });
}

export const GET = wrapCron("navigator-pulse", __cronHandler as any, {
  skipWhen: (status, body) => status === 200 && body.includes("hard quiet hours"),
});
