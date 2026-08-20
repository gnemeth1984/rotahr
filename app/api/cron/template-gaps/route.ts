/**
 * Weekly template-library review.
 *
 * GET  /api/cron/template-gaps?secret=CRON_SECRET   (Vercel Cron)
 * POST /api/cron/template-gaps                      (admin dashboard button)
 */

import { NextResponse } from "next/server";
import { reviewTemplateGaps } from "@/lib/templates/gaps";
import { canRunSeo } from "@/lib/seo/auth";
import { wrapCron } from "@/lib/cron-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function run(req: Request) {
  if (!(await canRunSeo(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const report = await reviewTemplateGaps({ notify: true });
    return NextResponse.json({ ok: true, ...report });
  } catch (err) {
    console.error("[cron/template-gaps]", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

const __wrapped = wrapCron("template-gaps", run as any);
export const GET = __wrapped;
export const POST = __wrapped;
