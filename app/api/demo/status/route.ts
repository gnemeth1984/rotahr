import { NextResponse } from "next/server";
import { getDemoResetState } from "@/lib/demo/reset";

export const dynamic = "force-dynamic";

/**
 * Polled by the demo interstitial. While a reset is running the demo data is
 * genuinely half-deleted, so the UI waits rather than showing an empty venue.
 */
export async function GET() {
  const state = await getDemoResetState();
  return NextResponse.json(
    { ready: !state.running, ...state },
    { headers: { "Cache-Control": "no-store" } }
  );
}
