export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { runLifecycle, lifecycleSendingEnabled } from "@/lib/email/lifecycle";

/**
 * Lifecycle (setup-nudge) emails for trial signups.
 *
 * NOT scheduled: there is deliberately no entry for this route in vercel.json.
 * Even when called, it only plans (dry run) unless LIFECYCLE_EMAILS_ENABLED=1
 * is set AND the caller passes ?send=1. Both are off today.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const secret = req.headers.get("x-cron-secret") || url.searchParams.get("secret");
  const ok =
    !!process.env.CRON_SECRET &&
    (req.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}` || secret === process.env.CRON_SECRET);
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const wantSend = url.searchParams.get("send") === "1";
  const result = await runLifecycle({ dryRun: !(wantSend && lifecycleSendingEnabled()) });
  return NextResponse.json({
    dryRun: result.dryRun,
    enabled: result.enabled,
    due: result.due,
    sent: result.sent,
    skipped: result.skipped,
    failures: result.failures,
    plan: result.items
      .filter((i) => i.key)
      .map((i) => ({ businessId: i.businessId, key: i.key, to: i.to, skip: i.skip, reason: i.reason })),
  });
}
