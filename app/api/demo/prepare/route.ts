// @ts-nocheck
/**
 * POST /api/demo/prepare
 *
 * Called by the demo interstitial (app/demo/preparing) right after a demo login.
 * Its only job is to sit there and hold a serverless invocation open while the
 * demo seed runs, then answer when it's done.
 *
 * Why it exists: the seed takes ~2 minutes. Vercel freezes a function as soon as
 * it sends its response, so the seed cannot be fired off in the background of the
 * login request — it gets killed part-way and the visitor lands on a half-wiped
 * venue. A request whose entire purpose is to await the seed is the only place it
 * can safely run.
 *
 * Only demo sessions may call it, and runDemoReset() still enforces the single-
 * runner claim and the cooldown, so a burst of demo logins triggers one seed.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { isDemoEmail, isDemoBusinessId, runDemoReset } from "@/lib/demo/reset";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // seed measured at ~127s; leave plenty of head-room

export async function POST() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email || "";

  if (!isDemoEmail(email) && !isDemoBusinessId(session?.user?.businessId)) {
    return NextResponse.json({ error: "Demo accounts only" }, { status: 403 });
  }

  const started = Date.now();
  const outcome = await runDemoReset();

  return NextResponse.json(
    { ok: true, outcome, tookMs: Date.now() - started },
    { headers: { "Cache-Control": "no-store" } }
  );
}
