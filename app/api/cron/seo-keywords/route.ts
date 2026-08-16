/**
 * Keyword pipeline refill. Weekly is plenty — autocomplete doesn't change daily,
 * and Search Console data is a 28-day window.
 *
 * GET  /api/cron/seo-keywords?secret=CRON_SECRET   (Vercel Cron)
 * POST /api/cron/seo-keywords                      (admin dashboard button)
 */

import { NextResponse } from "next/server";
import { harvestKeywords } from "@/lib/seo/autopilot";
import { canRunSeo } from "@/lib/seo/auth";
import { wrapCron } from "@/lib/cron-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // hundreds of polite autocomplete calls

async function run(req: Request) {
  if (!(await canRunSeo(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await harvestKeywords();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron/seo-keywords]", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

const __wrapped = wrapCron("seo-keywords", run as any);
export const GET = __wrapped;
export const POST = __wrapped;
