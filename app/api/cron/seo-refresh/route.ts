/**
 * Refresh pass: improve the one article with the most traffic sitting just out
 * of reach (Search Console position 4-20). One page per run, deliberately —
 * a slow, real improvement beats bulk-rewriting the whole blog.
 *
 * GET  /api/cron/seo-refresh?secret=CRON_SECRET
 * POST /api/cron/seo-refresh
 */

import { NextResponse } from "next/server";
import { refreshDecaying } from "@/lib/seo/autopilot";
import { canRunSeo } from "@/lib/seo/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function run(req: Request) {
  if (!(await canRunSeo(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await refreshDecaying();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron/seo-refresh]", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
