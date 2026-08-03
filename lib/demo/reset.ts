// @ts-nocheck
/**
 * lib/demo/reset.ts
 *
 * Resets all demo data so visitors start from a clean slate.
 *
 * Runs in-process (direct import) — no spawn/npx, works on Vercel serverless.
 *
 * Two things pull against each other here:
 *
 *  1. The seed is destructive — it deletes each section before recreating it and
 *     takes ~2 minutes end to end. While it runs the demo dashboard genuinely is
 *     half empty (0 shifts today, no bookings, no expenses), which reads as
 *     "this product has nothing in it".
 *  2. Visitors log in far more often than they dirty the data.
 *
 * So we reset sparingly, and while a reset is running we tell the visitor the demo
 * is being prepared instead of dropping them into a gutted dashboard.
 *
 * State lives in the database, not in memory: on Vercel consecutive requests can
 * land on different instances, so an in-process flag would let one request start
 * a reset that the status endpoint never sees.
 */

import { prisma } from "@/lib/db";
import { seedDemo } from "@/scripts/seed-demo";

const STATE_ID = "singleton";

/**
 * Minimum gap between resets. Must be comfortably longer than the seed itself
 * (~2 min) — with the old 30s cooldown a steady trickle of demo logins left the
 * data permanently mid-wipe, which is exactly what a visitor must never see.
 */
const COOLDOWN_MS = 20 * 60 * 1000;

/** Safety valve: a reset that never reported finishing stops blocking visitors. */
const STUCK_MS = 5 * 60 * 1000;

export function isDemoEmail(email: string): boolean {
  return email.endsWith("@rotahr.demo");
}

// Any business seeded by the demo scripts uses a "demo-" prefixed id (see
// scripts/seed-demo.ts) — use this alongside isDemoEmail to catch every case
// (session email OR business id) before sending anything to a real inbox.
export function isDemoBusinessId(businessId: string | null | undefined): boolean {
  return !!businessId && businessId.startsWith("demo-");
}

function isStale(startedAt: Date | null): boolean {
  return !startedAt || Date.now() - startedAt.getTime() > STUCK_MS;
}

export async function getDemoResetState() {
  let row = null;
  try {
    row = await prisma.demoResetState.findUnique({ where: { id: STATE_ID } });
  } catch (err) {
    // Never let a status check break the demo — assume ready.
    console.error("[demo-reset] state read failed:", err);
  }

  const running = !!row?.running && !isStale(row.startedAt);
  return {
    running,
    startedAt: running ? row.startedAt : null,
    lastResetAt: row?.finishedAt ?? null,
  };
}

/**
 * Claim the reset slot. Returns true only if this caller should actually run the
 * seed. The update is conditional on the current row, so two simultaneous logins
 * can't both start a reset.
 *
 * @param force bypass the cooldown (explicit "reset demo data" action)
 */
async function claim(force: boolean): Promise<boolean> {
  const now = new Date();
  const row = await prisma.demoResetState.findUnique({ where: { id: STATE_ID } });

  if (row?.running && !isStale(row.startedAt)) return false;
  if (!force && row?.finishedAt && now.getTime() - row.finishedAt.getTime() < COOLDOWN_MS) {
    return false;
  }

  if (!row) {
    try {
      await prisma.demoResetState.create({
        data: { id: STATE_ID, running: true, startedAt: now },
      });
      return true;
    } catch {
      // Lost the race to create the row — someone else owns the reset.
      return false;
    }
  }

  // Only win the claim if the row still looks the way we just read it.
  const res = await prisma.demoResetState.updateMany({
    where: { id: STATE_ID, updatedAt: row.updatedAt },
    data: { running: true, startedAt: now },
  });
  return res.count === 1;
}

async function release() {
  await prisma.demoResetState
    .update({
      where: { id: STATE_ID },
      data: { running: false, finishedAt: new Date() },
    })
    .catch((err) => console.error("[demo-reset] release failed:", err));
}

/**
 * Start a reset if one is warranted.
 *
 * Awaiting this resolves as soon as the slot is claimed (fast) — the seed itself
 * keeps running in the background. Callers should await it so that by the time a
 * login returns, /api/demo/status already reports the reset as running.
 */
export async function triggerDemoReset(force = false): Promise<boolean> {
  let claimed = false;
  try {
    claimed = await claim(force);
  } catch (err) {
    console.error("[demo-reset] claim failed:", err);
    return false;
  }

  if (!claimed) {
    console.log("[demo-reset] Skipped — already running or within cooldown");
    return false;
  }

  console.log("[demo-reset] In-process reset started");

  // Deliberately not awaited: the interstitial polls /api/demo/status instead.
  seedDemo()
    .then(() => console.log("[demo-reset] Reset complete"))
    .catch((err) => console.error("[demo-reset] Reset failed:", err))
    .finally(release);

  return true;
}
