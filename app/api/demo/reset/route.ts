// @ts-nocheck
/**
 * GET /api/demo/reset — invoked automatically by Vercel Cron daily (see vercel.json).
 * POST /api/demo/reset — manual trigger, same auth.
 *
 * Regenerates all demo business data (rota, floor plan, HACCP checks, bookkeeping, etc.)
 * with dates relative to "today" so the demo never looks stale.
 *
 * Usage:
 *   curl -X POST https://rotahr.com/api/demo/reset \
 *     -H "Authorization: Bearer <CRON_SECRET>"
 */

import { NextRequest, NextResponse } from "next/server";
import { seedAll } from "@/scripts/seed-demo";

export const runtime = "nodejs";
export const maxDuration = 180; // Pro plan allows up to 300s; measured ~124s for a full reset, buffered

function isAuthed(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const secret =
    req.headers.get("x-cron-secret") || new URL(req.url).searchParams.get("secret");
  return (
    authHeader === `Bearer ${process.env.CRON_SECRET}` ||
    secret === process.env.CRON_SECRET
  );
}

async function runReset() {
  console.log("[api/demo/reset] Reset triggered");
  await seedAll();
  console.log("[api/demo/reset] Reset complete");
}

export async function GET(req: NextRequest) {
  if (!isAuthed(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await runReset();
    return NextResponse.json({ ok: true, message: "Demo data reset successfully" });
  } catch (err) {
    console.error("[api/demo/reset] Reset failed:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isAuthed(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await runReset();
    return NextResponse.json({ ok: true, message: "Demo data reset successfully" });
  } catch (err) {
    console.error("[api/demo/reset] Reset failed:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
