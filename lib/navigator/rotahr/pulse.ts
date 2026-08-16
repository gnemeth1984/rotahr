import { prisma } from "@/lib/db";
import { buildSystemPulse, renderPulse, type SystemPulse } from "./signals";
import { sealPulse } from "./redact";

/**
 * The pulse is CACHED, not computed per message.
 *
 * Building it costs ~20 aggregate queries. Doing that on every chat turn would
 * make Navigator feel slow and — worse — would hold Neon compute awake all day,
 * which is exactly the cost the nudge cron's narrow hour window exists to
 * avoid. So it refreshes on a schedule and every reader serves the stored row.
 *
 * Failure policy: a failed refresh KEEPS the previous data and records the
 * error. Stale-but-true beats empty, and `lastError` makes the staleness
 * visible instead of silently pretending all the numbers are zero.
 */

export type StoredPulse = {
  data: SystemPulse | null;
  refreshedAt: Date | null;
  lastError: string | null;
  durationMs: number | null;
  ageMinutes: number | null;
};

export async function readPulse(userId: string): Promise<StoredPulse> {
  const row = await prisma.navSystemPulse.findUnique({ where: { userId } });
  if (!row) {
    return { data: null, refreshedAt: null, lastError: null, durationMs: null, ageMinutes: null };
  }
  return {
    data: (row.data as SystemPulse | null) ?? null,
    refreshedAt: row.refreshedAt,
    lastError: row.lastError,
    durationMs: row.durationMs,
    ageMinutes: row.refreshedAt
      ? Math.floor((Date.now() - row.refreshedAt.getTime()) / 60000)
      : null,
  };
}

export async function refreshPulse(userId: string): Promise<StoredPulse> {
  const started = Date.now();
  try {
    // sealPulse throws rather than sanitising. If a future signal ever picks up
    // a customer email, this refresh fails loudly and the old pulse keeps
    // serving — no partially-redacted payload ever reaches the model.
    const pulse = sealPulse(await buildSystemPulse());
    const durationMs = Date.now() - started;

    await prisma.navSystemPulse.upsert({
      where: { userId },
      create: { userId, data: pulse as object, refreshedAt: new Date(), durationMs, lastError: null },
      update: { data: pulse as object, refreshedAt: new Date(), durationMs, lastError: null },
    });

    return { data: pulse, refreshedAt: new Date(), lastError: null, durationMs, ageMinutes: 0 };
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    console.error("[navigator/pulse] refresh failed:", msg);

    const existing = await prisma.navSystemPulse.findUnique({ where: { userId } });
    if (existing) {
      await prisma.navSystemPulse.update({ where: { userId }, data: { lastError: msg } });
    } else {
      await prisma.navSystemPulse.create({
        data: { userId, data: {}, refreshedAt: null, lastError: msg },
      });
    }

    const row = await readPulse(userId);
    return { ...row, lastError: msg };
  }
}

/**
 * Prompt block for the chat context. Returns "" when there is nothing worth
 * saying, so the caller can concatenate unconditionally.
 */
export async function pulseBlock(userId: string, maxChars = 2600): Promise<string> {
  const { data, ageMinutes } = await readPulse(userId);
  if (!data) return "";
  const block = renderPulse(data, maxChars);
  if (ageMinutes != null && ageMinutes > 180) {
    return `${block}\n(These figures are ${Math.floor(ageMinutes / 60)}h old.)`;
  }
  return block;
}
