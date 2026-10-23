export const dynamic = "force-dynamic";
// Belt and braces with noStore() in sendEmail: no fetch here is ever cached.
export const fetchCache = "force-no-store";
import { NextRequest, NextResponse } from "next/server";
import { purgeTemplateLeads, runTemplateSeries } from "@/lib/templates/leads";

/**
 * Follow-up series for free-template leads (lib/templates/leads.ts).
 *
 * Scheduled hourly in vercel.json, but it only ever plans unless
 * TEMPLATE_EMAILS_ENABLED=1 is set in the environment. That variable is not set
 * anywhere: switching the series on is a deliberate decision.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const secret = req.headers.get("x-cron-secret") || url.searchParams.get("secret");
  const ok =
    !!process.env.CRON_SECRET &&
    (req.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}` || secret === process.env.CRON_SECRET);
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const dry = url.searchParams.get("dry") === "1";
    const r = await runTemplateSeries({ dryRun: dry });
    // Retention runs whether or not sending is switched on (not on ?dry=1).
    const purged = dry ? null : await purgeTemplateLeads();
    return NextResponse.json({ ...r, due: r.due.length, dueSample: r.due.slice(0, 20), purged });
  } catch (e) {
    // P2021 = table missing: the TemplateLead migration isn't applied yet.
    // Nothing to do until it is; don't fail the cron every hour over it.
    if ((e as { code?: string })?.code === "P2021") {
      return NextResponse.json({ skipped: "TemplateLead table not migrated yet" });
    }
    console.error("[cron/template-emails]", e);
    return NextResponse.json({ error: "series failed", detail: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
