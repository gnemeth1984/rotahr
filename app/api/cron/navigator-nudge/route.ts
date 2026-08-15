// Navigator nudge cron.
// Runs every 5 minutes between 06:00-21:59 UTC (see vercel.json) so that block
// reminders land close to the minute. The narrow hour range is deliberate: our
// Neon compute scales to zero and every invocation holds it awake for the
// 5-minute suspend delay, so an unrestricted */5 cron would keep the database
// billing 24/7 for nothing.
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { dublinNow } from "@/lib/cron/service-hours";
import {
  decideNudges,
  inQuietHours,
  toMins,
  type NudgeBlock,
  type NudgeTask,
} from "@/lib/navigator/nudges";

// Widest possible quiet window across all users — checked BEFORE Prisma so the
// DB compute can stay suspended. Per-user quiet hours are enforced properly
// inside decideNudges().
const HARD_QUIET_START = 23; // 23:00 Dublin
const HARD_QUIET_END = 6; //  06:00 Dublin

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const secret =
    req.headers.get("x-cron-secret") || new URL(req.url).searchParams.get("secret");
  const authed =
    authHeader === `Bearer ${process.env.CRON_SECRET}` || secret === process.env.CRON_SECRET;
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Dev-only clock override so the whole pipeline (engine -> ledger insert ->
  // notification) can be exercised at an arbitrary time of day. Double-gated:
  // never outside development, and the cron secret is already required above.
  const testNow =
    process.env.NODE_ENV !== "production"
      ? new URL(req.url).searchParams.get("testNow")
      : null;
  const now = testNow ? new Date(testNow) : new Date();
  if (Number.isNaN(now.getTime())) {
    return NextResponse.json({ error: "Bad testNow" }, { status: 400 });
  }
  const { hour, minute } = dublinNow(now);
  if (hour >= HARD_QUIET_START || hour < HARD_QUIET_END) {
    return NextResponse.json({ skipped: "hard quiet hours", hour });
  }

  // Imported lazily so the quiet-hours exit above never wakes the database.
  const { prisma } = await import("@/lib/db");
  const { createNotification } = await import("@/lib/services/appNotification.service");
  const { windowForDate } = await import("@/lib/navigator/context");
  const { todayKey, dayFromKey } = await import("@/lib/navigator/dates");

  const profiles = await prisma.navProfile.findMany({ where: { notifyEnabled: true } });
  if (!profiles.length) return NextResponse.json({ ok: true, profiles: 0 });

  const results: Record<string, unknown>[] = [];

  for (const profile of profiles) {
    const tz = profile.timezone || "Europe/Dublin";
    const dateKey = todayKey(tz);
    const nowMins = hour * 60 + minute;

    // No blanket quiet-hours skip here on purpose. decideNudges() allows exactly
    // one thing to speak during quiet hours -- the lead-time nudge for the block
    // that starts as quiet ends -- and skipping the reads here would drop it.
    // The DB is already awake from the profile query above, so the extra reads
    // cost nothing that matters.

    const { window: shift, source } = windowForDate(profile, dateKey);
    const onShift =
      shift && nowMins >= toMins(shift.start) && nowMins < toMins(shift.end);
    if (onShift && !profile.notifyDuringShift) {
      results.push({ userId: profile.userId, skipped: "on shift" });
      continue;
    }

    const day = dayFromKey(dateKey);
    const [plan, tasks, sentToday, lastEnergy, snoozes] = await Promise.all([
      prisma.navDayPlan.findFirst({ where: { userId: profile.userId, date: day } }),
      prisma.navTask.findMany({
        // archivedAt: null keeps nightly-archived history out of the nudge input.
        where: { userId: profile.userId, status: { in: ["todo", "doing"] }, archivedAt: null },
        orderBy: { createdAt: "asc" },
        take: 200,
      }),
      prisma.navNudge.findMany({
        where: { userId: profile.userId, date: day },
        select: { kind: true, refKey: true, sentAt: true },
      }),
      // Latest energy check-in. Only ever used to make a nudge ask for LESS,
      // never to suppress one, so a missing row is harmless.
      prisma.navCheckin.findFirst({
        where: { userId: profile.userId, kind: "energy" },
        orderBy: { at: "desc" },
        select: { value: true, at: true },
      }),
      // Only snoozes that are still in force. Expired rows are harmless and get
      // cleared by the nightly cron.
      prisma.navSnooze.findMany({
        where: { userId: profile.userId, until: { gt: now } },
        select: { kind: true, refKey: true, until: true, condition: true },
      }),
    ]);

    const lastSentMins = sentToday.length
      ? Math.max(
          ...sentToday.map((s) => {
            const d = dublinNow(s.sentAt);
            return d.hour * 60 + d.minute;
          })
        )
      : null;

    const nudges = decideNudges({
      now,
      nowMins,
      dateKey,
      // A shift buffer of 0 means the user turned buffering off, which also turns
      // off the silence — the two are the same feature.
      preShiftQuietMins: profile.bufferShifts ? Math.min(30, profile.preShiftMins) : 0,
      postShiftQuietMins: profile.bufferShifts ? Math.min(30, profile.postShiftMins) : 0,
      prefs: {
        notifyEnabled: profile.notifyEnabled,
        notifyLeadMins: profile.notifyLeadMins,
        notifyBlocks: profile.notifyBlocks,
        notifyDueToday: profile.notifyDueToday,
        notifyOverdue: profile.notifyOverdue,
        notifyErrands: profile.notifyErrands,
        notifyStuck: profile.notifyStuck,
        notifyIdle: profile.notifyIdle,
        notifyEvening: profile.notifyEvening,
        notifyDuringShift: profile.notifyDuringShift,
        quietStart: profile.quietStart,
        quietEnd: profile.quietEnd,
        wakeTime: profile.wakeTime,
      },
      shift,
      isDayOff: shift === null && source === "pattern",
      // "Has a plan" means has BLOCKS, not "a row exists". The nightly cron writes
      // a blocks-less stub for tomorrow (anchor only), and treating that as a plan
      // would suppress tomorrow's "no plan yet" nudge and fire "close the day"
      // against a day that was never planned.
      planExists: Array.isArray(plan?.blocks) && plan.blocks.length > 0,
      blocks: Array.isArray(plan?.blocks) ? (plan.blocks as unknown as NudgeBlock[]) : [],
      hasReflection: !!plan?.reflection || plan?.scoreOutOf5 != null,
      tasks: tasks as NudgeTask[],
      sentToday,
      lastSentMins,
      energy: lastEnergy
        ? {
            value: lastEnergy.value,
            ageMins: Math.max(0, Math.round((now.getTime() - lastEnergy.at.getTime()) / 60000)),
          }
        : null,
      snoozes,
    });

    const sent: string[] = [];
    for (const n of nudges) {
      // The unique index is the real guard: two overlapping cron runs cannot
      // both deliver the same nudge, because the insert loses the race.
      try {
        await prisma.navNudge.create({
          data: {
            userId: profile.userId,
            date: day,
            kind: n.kind,
            refKey: n.refKey,
            title: n.title,
            body: n.body,
            // Written from the app clock on purpose. The errand spacing rule
            // compares sentAt against this same `now`, and letting Postgres
            // fill it with CURRENT_TIMESTAMP would mix two clocks.
            sentAt: now,
          },
        });
      } catch {
        continue; // already sent — skip delivery entirely
      }

      await createNotification({
        userId: profile.userId,
        type: "navigator",
        title: n.title,
        body: n.body,
        link: n.link,
      });
      sent.push(`${n.kind}:${n.refKey}`);
    }

    results.push({
      userId: profile.userId,
      sent,
      quiet: inQuietHours(nowMins, profile.quietStart, profile.quietEnd) || undefined,
      onShift: onShift || undefined,
      considered: {
        tasks: tasks.length,
        blocks: Array.isArray(plan?.blocks) ? plan.blocks.length : 0,
        energy: lastEnergy?.value ?? null,
        snoozed: snoozes.length,
      },
    });
  }

  return NextResponse.json({ ok: true, at: `${hour}:${String(minute).padStart(2, "0")}`, results });
}
