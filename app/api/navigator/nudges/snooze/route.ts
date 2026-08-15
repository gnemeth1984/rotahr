import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { navigatorUserId, forbidden } from "@/lib/navigator/guard";
import { getOrCreateProfile, DEFAULT_TZ, windowForDate } from "@/lib/navigator/context";
import { todayKey, dayFromKey } from "@/lib/navigator/dates";

export const dynamic = "force-dynamic";

/**
 * 5.2 Smart Snooze.
 *
 * Snoozing is not the same as dismissing, and the difference matters: dismissing
 * teaches the system nothing and the nudge comes back tomorrow anyway, so people
 * stop reading nudges at all. A snooze is the user saying "yes, but not now",
 * which is almost always the truth.
 *
 * Every option resolves to a hard absolute time. The conditional option carries a
 * condition as well, but the condition can only release it EARLY — nothing can be
 * silenced indefinitely by a state that never arrives.
 */
const OPTIONS = ["10min", "1hour", "after_shift", "energy"] as const;
type Option = (typeof OPTIONS)[number];

const schema = z.object({
  kind: z.string().min(1).max(40),
  refKey: z.string().min(1).max(200),
  option: z.enum(OPTIONS),
});

// Not exported: Next.js only allows route handlers and a fixed set of config
// fields to be exported from a route file.
const SNOOZE_LABELS: Record<Option, string> = {
  "10min": "10 minutes",
  "1hour": "1 hour",
  after_shift: "after your shift",
  energy: "until you've got energy back",
};

export async function POST(req: NextRequest) {
  const userId = await navigatorUserId();
  if (!userId) return forbidden();

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const { kind, refKey, option } = parsed.data;

  const profile = await getOrCreateProfile(userId);
  const tz = profile.timezone || DEFAULT_TZ;
  const now = new Date();

  let until: Date;
  let condition: string | null = null;

  if (option === "10min") {
    until = new Date(now.getTime() + 10 * 60_000);
  } else if (option === "1hour") {
    until = new Date(now.getTime() + 60 * 60_000);
  } else if (option === "after_shift") {
    // Resolve against today's real shift. With no shift there is nothing to wait
    // for, so it degrades to two hours rather than failing — a snooze button that
    // errors is worse than one that's approximately right.
    const today = todayKey(tz);
    const { window: shift } = windowForDate(profile, today);
    if (shift) {
      const [h, m] = shift.end.split(":").map(Number);
      const end = new Date(dayFromKey(today));
      end.setUTCHours(h, m, 0, 0);
      // Add the decompression buffer: the moment a shift ends is not the moment
      // he can act on a reminder.
      const buffered = new Date(
        end.getTime() + (profile.bufferShifts ? profile.postShiftMins : 0) * 60_000
      );
      until = buffered > now ? buffered : new Date(now.getTime() + 2 * 60 * 60_000);
    } else {
      until = new Date(now.getTime() + 2 * 60 * 60_000);
    }
  } else {
    // Conditional: released as soon as a fresh check-in reports energy >= 3, and
    // in any case after 4 hours.
    until = new Date(now.getTime() + 4 * 60 * 60_000);
    condition = "energy3";
  }

  const snooze = await prisma.navSnooze.upsert({
    where: { userId_kind_refKey: { userId, kind, refKey } },
    create: { userId, kind, refKey, until, condition },
    update: { until, condition },
  });

  return NextResponse.json({ ...snooze, label: SNOOZE_LABELS[option] });
}

// GET — what's currently snoozed, so the UI can say so instead of going silent
// for no visible reason.
export async function GET() {
  const userId = await navigatorUserId();
  if (!userId) return forbidden();

  const snoozes = await prisma.navSnooze.findMany({
    where: { userId, until: { gt: new Date() } },
    orderBy: { until: "asc" },
  });
  return NextResponse.json(snoozes);
}

// DELETE ?kind=&refKey= — un-snooze. Cheap to offer and it keeps the mechanism
// honest: anything the app hides, the user must be able to unhide.
export async function DELETE(req: NextRequest) {
  const userId = await navigatorUserId();
  if (!userId) return forbidden();

  const url = new URL(req.url);
  const kind = url.searchParams.get("kind");
  const refKey = url.searchParams.get("refKey");
  if (!kind || !refKey) return NextResponse.json({ error: "kind and refKey required" }, { status: 400 });

  await prisma.navSnooze.deleteMany({ where: { userId, kind, refKey } });
  return NextResponse.json({ ok: true });
}
