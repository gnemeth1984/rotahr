/**
 * AI search visibility check — asks real buying questions and records whether
 * an AI assistant named Rotahr, where, and who it named instead.
 *
 * Runs twice a week. Each run covers the least-recently-checked prompts, so the
 * full set rotates through rather than re-asking the same handful.
 *
 * GET  /api/cron/ai-visibility?secret=CRON_SECRET&limit=8
 * POST /api/cron/ai-visibility
 */

import { NextResponse } from "next/server";
import { runVisibilityCheck } from "@/lib/seo/ai-visibility";
import { canRunSeo } from "@/lib/seo/auth";
import { wrapCron } from "@/lib/cron-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function run(req: Request) {
  if (!(await canRunSeo(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = Number(new URL(req.url).searchParams.get("limit"));
  const limit = Number.isFinite(raw) && raw > 0 ? Math.min(Math.floor(raw), 24) : 8;

  try {
    const result = await runVisibilityCheck(limit);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[cron/ai-visibility]", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

const __wrapped = wrapCron("ai-visibility", run as any);
export const GET = __wrapped;
export const POST = __wrapped;
