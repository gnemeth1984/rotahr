/**
 * 6.3 Navigator Rituals.
 *
 * Three daily rituals plus a weekly review and a monthly reflection. Each is a
 * short, fixed, tickable list — not advice, not AI output.
 *
 * Why they're generated in code from the profile instead of by the model:
 * a ritual only works if it is IDENTICAL every single day. That's the whole
 * mechanism — no decisions, no reading, no surprises, so it can run on autopilot
 * on the days executive function is gone. An AI-written ritual that reworded
 * itself each morning would be a new thing to read and evaluate every day, which
 * is exactly the cost rituals exist to remove.
 *
 * Pure: takes a profile and a date, returns definitions. No DB, no clock.
 */

import { weekdayKey, dayFromKey } from "./dates";

export type RitualId = "morning" | "midday" | "shutdown" | "weekly" | "monthly";

export type RitualStep = {
  id: string;
  label: string;
  /** Why this step is here. Shown small, so the ritual survives scepticism. */
  hint?: string;
};

export type Ritual = {
  id: RitualId;
  title: string;
  /** HH:mm the ritual is anchored to, derived from the user's own day shape. */
  at: string;
  /** Rough time cost, so "I don't have time" isn't available as an excuse. */
  mins: number;
  cadence: "daily" | "weekly" | "monthly";
  steps: RitualStep[];
};

export type RitualProfile = {
  wakeTime: string;
  sleepTime: string;
  workStart: string;
  workEnd: string;
  focusMins: number;
  ritualsEnabled: boolean;
};

const toMins = (t: string): number => {
  const [h, m] = String(t).split(":").map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : 0;
};

const toTime = (m: number): string => {
  const c = Math.max(0, Math.min(1439, Math.round(m)));
  return `${String(Math.floor(c / 60)).padStart(2, "0")}:${String(c % 60).padStart(2, "0")}`;
};

/**
 * Rituals are anchored to the user's own day, not to clock hours. A chef whose
 * day starts at 11:00 does not have a "9am morning routine", and pretending
 * otherwise is how generic productivity advice gets abandoned in week one.
 *
 * @param shift today's actual shift, when there is one — the midday reset moves
 *              to just before it, since mid-shift is unreachable.
 */
export function ritualsForDay(
  profile: RitualProfile,
  dateKey: string,
  shift: { start: string; end: string } | null
): Ritual[] {
  const wake = toMins(profile.wakeTime || "07:00");
  const sleep = toMins(profile.sleepTime || "23:00");

  // Midday reset: normally halfway between waking and sleeping, but on a shift
  // day it lands 20 minutes before the shift, which is the last moment he can
  // actually do it.
  const midDefault = wake + Math.round((sleep - wake) / 2);
  const midday = shift ? Math.max(wake + 60, toMins(shift.start) - 20) : midDefault;

  const out: Ritual[] = [
    {
      id: "morning",
      title: "Morning warm-up",
      at: toTime(wake + 15),
      mins: 4,
      cadence: "daily",
      steps: [
        { id: "water", label: "Pint of water before anything else", hint: "Dehydration reads as brain fog." },
        { id: "energy", label: "Log today's energy honestly", hint: "The whole plan is built off this number." },
        { id: "anchor", label: "Name the one thing that makes today count", hint: "One. Not three." },
        { id: "first", label: "Read the start trigger of your first task", hint: "Read it — don't plan it." },
      ],
    },
    {
      id: "midday",
      title: shift ? "Pre-shift reset" : "Midday reset",
      at: toTime(midday),
      mins: 5,
      cadence: "daily",
      steps: [
        { id: "eat", label: "Eat something with protein in it", hint: "Skipping this is what wrecks the evening." },
        { id: "water2", label: "Water again" },
        { id: "checkin", label: "Check in: energy and overstim", hint: "Lets the nudges shrink instead of nagging." },
        {
          id: "reset",
          label: "Close every tab and app you're finished with",
          hint: "Open loops cost attention even when ignored.",
        },
        { id: "next", label: "Pick the ONE thing for the rest of the day" },
      ],
    },
    {
      id: "shutdown",
      title: "Evening shutdown",
      at: toTime(Math.max(midday + 60, sleep - 60)),
      mins: 6,
      cadence: "daily",
      steps: [
        { id: "brain", label: "Brain dump anything still rattling around", hint: "Capture tab. No triage, no tidying." },
        { id: "done", label: "Tick off what actually got done", hint: "Unticked work is invisible work." },
        { id: "reflect", label: "Close the day: wins, friction, out of 5" },
        { id: "tomorrow", label: "Look at tomorrow's first block only", hint: "Only the first. The rest is tomorrow's job." },
        { id: "phone", label: "Phone out of the bedroom" },
      ],
    },
  ];

  // Weekly review on Sunday, monthly reflection on the last day of the month —
  // both anchored to the evening, when there's nothing left to protect.
  const wd = weekdayKey(dateKey);
  const d = dayFromKey(dateKey);
  const lastOfMonth =
    new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate() === d.getUTCDate();

  if (wd === "sun") {
    out.push({
      id: "weekly",
      title: "Weekly review",
      at: toTime(Math.max(wake + 120, sleep - 150)),
      mins: 12,
      cadence: "weekly",
      steps: [
        { id: "momentum", label: "Read your momentum score and its parts" },
        { id: "debt", label: "Read your time debt — then bin or park half of it", hint: "Deleting counts as clearing." },
        { id: "ai", label: "Get the AI weekly review and argue with it", hint: "Coach tab." },
        { id: "week", label: "Name next week's one priority" },
        { id: "shifts", label: "Check next week's shifts are right in Setup" },
      ],
    });
  }

  if (lastOfMonth) {
    out.push({
      id: "monthly",
      title: "Monthly reflection",
      at: toTime(Math.max(wake + 120, sleep - 180)),
      mins: 15,
      cadence: "monthly",
      steps: [
        { id: "trend", label: "Momentum this month vs last — up or down?" },
        { id: "drop", label: "What did you carry all month and never do?", hint: "That's an answer. Delete it." },
        { id: "worked", label: "Name the one change that actually worked" },
        { id: "tune", label: "Adjust nudges, tone, or shift buffers to match reality" },
      ],
    });
  }

  return out;
}

/** Which ritual is live right now, so the UI can lead with it instead of listing five. */
export function currentRitual(rituals: Ritual[], nowMins: number): RitualId | null {
  // A ritual is "live" from 45 minutes before its anchor until 3 hours after.
  // Wide, because a ritual you're 90 minutes late for is still worth doing.
  const live = rituals
    .filter((r) => r.cadence === "daily")
    .map((r) => ({ id: r.id, at: toMins(r.at) }))
    .filter((r) => nowMins >= r.at - 45 && nowMins <= r.at + 180)
    .sort((a, b) => b.at - a.at)[0];
  return live?.id ?? null;
}
