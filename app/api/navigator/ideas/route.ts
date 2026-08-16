import { NextResponse } from "next/server";
import { navigatorUserId, forbidden } from "@/lib/navigator/guard";
import { getOrCreateProfile } from "@/lib/navigator/context";
import { generateIdeas } from "@/lib/navigator/ideas";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST — generate ideas now, from the System tab.
 *
 * Same code path and the same inbox limit as the daily cron: a manual run is
 * not a way around the backpressure rule, only a way to skip the wait.
 */
export async function POST() {
  const userId = await navigatorUserId();
  if (!userId) return forbidden();

  const profile = await getOrCreateProfile(userId);
  if (!profile.systemAccess) return forbidden();

  const out = await generateIdeas(userId);
  return NextResponse.json(out);
}
