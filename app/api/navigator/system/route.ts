import { NextRequest, NextResponse } from "next/server";
import { navigatorUserId, forbidden } from "@/lib/navigator/guard";
import { getOrCreateProfile } from "@/lib/navigator/context";
import { readPulse, refreshPulse } from "@/lib/navigator/rotahr/pulse";

export const dynamic = "force-dynamic";

/** GET — the cached pulse. Never recomputes; that is the cron's job. */
export async function GET() {
  const userId = await navigatorUserId();
  if (!userId) return forbidden();

  const profile = await getOrCreateProfile(userId);
  if (!profile.systemAccess) {
    return NextResponse.json({ systemAccess: false, pulse: null });
  }

  const stored = await readPulse(userId);
  return NextResponse.json({ systemAccess: true, ...stored });
}

/** POST — force a refresh from the System tab. */
export async function POST(_req: NextRequest) {
  const userId = await navigatorUserId();
  if (!userId) return forbidden();

  const profile = await getOrCreateProfile(userId);
  if (!profile.systemAccess) return forbidden();

  const stored = await refreshPulse(userId);
  // A failed refresh is a 200 with `lastError` set, not a 500: the previous
  // pulse is still valid data and the UI should show it alongside the problem
  // rather than blanking the tab.
  return NextResponse.json({ systemAccess: true, ...stored });
}
