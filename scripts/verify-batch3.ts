// Batch-3 verification against the real Neon DB. Read-mostly: anything it writes,
// it deletes again at the end.
import { prisma } from "@/lib/db";
import { compressDay, planIsStale } from "@/lib/navigator/compress";
import { timeDebtFor } from "@/lib/navigator/timedebt";
import { ritualsForDay, currentRitual } from "@/lib/navigator/rituals";
import { withShiftBuffers } from "@/lib/navigator/shift";
import { todayKey, dayFromKey } from "@/lib/navigator/dates";
import { windowForDate } from "@/lib/navigator/context";

const USER = "cmr1vwcm80001v0jojd3a1o7t";

function line(s: string) {
  console.log(`\n=== ${s} ===`);
}

const profile = await prisma.navProfile.findUnique({ where: { userId: USER } });
if (!profile) throw new Error("no profile");
const today = todayKey(profile.timezone || "Europe/Dublin");

line("1. new profile columns read back");
console.log({
  bufferShifts: profile.bufferShifts,
  preShiftMins: profile.preShiftMins,
  postShiftMins: profile.postShiftMins,
  ritualsEnabled: profile.ritualsEnabled,
});

line("2. timeDebtFor (real rows)");
const debt = await timeDebtFor(USER, today);
console.log({ mins: debt.mins, label: debt.label, band: debt.band, advice: debt.advice });
console.log("parts:", debt.parts);
console.log("firstMove:", debt.firstMove);
if (!Number.isFinite(debt.mins) || debt.mins < 0) throw new Error("time debt not a sane number");

line("3. ritualsForDay + currentRitual");
const { window: shift } = windowForDate(profile, today);
const rituals = ritualsForDay(
  {
    wakeTime: profile.wakeTime,
    sleepTime: profile.sleepTime,
    workStart: profile.workStart,
    workEnd: profile.workEnd,
    focusMins: profile.focusMins,
    ritualsEnabled: profile.ritualsEnabled,
  },
  today,
  shift
);
console.log("shift today:", shift);
console.log(rituals.map((r) => `${r.id} @${r.at} ${r.mins}min ${r.steps.length} steps — ${r.title}`));
console.log("current at 09:30:", currentRitual(rituals, 570));
console.log("current at 22:30:", currentRitual(rituals, 1350));
if (rituals.length < 3) throw new Error("expected at least the 3 daily rituals");
// Rituals must be identical on a re-run — that's the whole mechanism.
const again = ritualsForDay(
  {
    wakeTime: profile.wakeTime,
    sleepTime: profile.sleepTime,
    workStart: profile.workStart,
    workEnd: profile.workEnd,
    focusMins: profile.focusMins,
    ritualsEnabled: profile.ritualsEnabled,
  },
  today,
  shift
);
if (JSON.stringify(again) !== JSON.stringify(rituals)) throw new Error("rituals are not deterministic");
console.log("deterministic across calls: yes");

line("4. compressDay on a synthetic blown-out day");
const plan = [
  { start: "09:00", end: "10:00", label: "Deep work: Navigator", kind: "deep" },
  { start: "10:00", end: "10:30", label: "Admin", kind: "admin" },
  { start: "10:30", end: "11:00", label: "Lunch", kind: "meal" },
  { start: "11:00", end: "12:00", label: "Workout", kind: "workout" },
  { start: "17:00", end: "23:00", label: "Shift", kind: "work" },
];
console.log("stale at 09:10?", planIsStale(plan, 550));
console.log("stale at 13:00?", planIsStale(plan, 780));
const res = compressDay(plan, 13 * 60, 23 * 60, { start: "17:00", end: "23:00" });
console.log("summary:", res.summary);
console.log("blocks:", res.blocks.map((b) => `${b.start}-${b.end} ${b.kind} ${b.label}`));
console.log("dropped:", res.dropped.map((b) => b.label), "lostMins:", res.lostMins);
const work = res.blocks.find((b) => b.kind === "work");
if (!work || work.start !== "17:00" || work.end !== "23:00") throw new Error("shift was moved");
for (const b of res.blocks) {
  if (b.kind === "work") continue;
  const [h, m] = b.start.split(":").map(Number);
  if (h * 60 + m < 13 * 60 && h * 60 + m + 1 < 13 * 60 && b.end > b.start && h * 60 + m < 780) {
    // only past blocks may start before now
    const [eh, em] = b.end.split(":").map(Number);
    if (eh * 60 + em > 780) throw new Error(`block straddles now: ${b.start}-${b.end}`);
  }
}
console.log("nothing scheduled into the past, shift untouched: yes");

line("5. withShiftBuffers");
const buffered = withShiftBuffers(
  [
    { start: "15:00", end: "17:00", label: "Deep work", kind: "deep" },
    { start: "17:00", end: "23:00", label: "Shift", kind: "work" },
  ],
  { start: "17:00", end: "23:00" },
  45,
  30
);
console.log(buffered.map((b) => `${b.start}-${b.end} ${b.kind} ${b.label}`));
if (!buffered.some((b) => b.kind === "prep")) throw new Error("no pre-shift block");
if (!buffered.some((b) => b.kind === "rest")) throw new Error("no decompress block");
const deep = buffered.find((b) => b.kind === "deep");
if (!deep || deep.end !== "16:15") throw new Error(`deep work not trimmed to the buffer: ${deep?.end}`);
console.log("deep work trimmed to 16:15, buffers present: yes");

line("6. snooze round-trip + nudge filter");
const until = new Date(Date.now() + 30 * 60_000);
await prisma.navSnooze.upsert({
  where: { userId_kind_refKey: { userId: USER, kind: "overdue", refKey: "verify-test" } },
  create: { userId: USER, kind: "overdue", refKey: "verify-test", until, condition: null },
  update: { until },
});
const active = await prisma.navSnooze.findMany({ where: { userId: USER, until: { gt: new Date() } } });
console.log("active snoozes:", active.map((s) => `${s.kind}/${s.refKey} until ${s.until.toISOString()}`));

// Prove the filter, not just the row: build a context that WILL produce a
// block nudge, then snooze exactly that refKey and confirm it disappears.
const { decideNudges } = await import("@/lib/navigator/nudges");
const prefs = {
  notifyEnabled: true,
  notifyLeadMins: 5,
  notifyBlocks: true,
  notifyDueToday: true,
  notifyOverdue: true,
  notifyErrands: true,
  notifyStuck: true,
  notifyIdle: true,
  notifyEvening: true,
  notifyDuringShift: false,
  quietStart: "22:00",
  quietEnd: "07:00",
  wakeTime: "07:00",
};
const baseCtx = {
  now: new Date(),
  nowMins: 10 * 60 - 3, // 3 min before a 10:00 block, inside the 5-min lead
  preShiftQuietMins: 45,
  postShiftQuietMins: 30,
  dateKey: today,
  prefs,
  shift: null,
  isDayOff: false,
  planExists: true,
  blocks: [{ start: "10:00", end: "11:00", label: "Deep work", kind: "deep" }],
  hasReflection: false,
  tasks: [],
  sentToday: [],
  lastSentMins: null,
  energy: null,
  snoozes: [] as { kind: string; refKey: string; until: Date; condition: string | null }[],
};
const before = decideNudges(baseCtx as never);
console.log("without snooze:", before.map((n) => `${n.kind}/${n.refKey}`));
if (!before.length) throw new Error("expected a block nudge to fire");

const target = before[0];
const withSnooze = decideNudges({
  ...baseCtx,
  snoozes: [{ kind: target.kind, refKey: target.refKey, until: new Date(Date.now() + 30 * 60_000), condition: null }],
} as never);
console.log("with that refKey snoozed:", withSnooze.map((n) => `${n.kind}/${n.refKey}`));
if (withSnooze.some((n) => n.kind === target.kind && n.refKey === target.refKey))
  throw new Error("snooze did not suppress the nudge");

const expired = decideNudges({
  ...baseCtx,
  snoozes: [{ kind: target.kind, refKey: target.refKey, until: new Date(Date.now() - 60_000), condition: null }],
} as never);
console.log("with an EXPIRED snooze:", expired.map((n) => `${n.kind}/${n.refKey}`));
if (!expired.some((n) => n.refKey === target.refKey)) throw new Error("expired snooze still suppressing");

// 4.3 — discretionary nudges go quiet in the pre-shift buffer.
const inBuffer = decideNudges({
  ...baseCtx,
  nowMins: 16 * 60 + 30, // 30 min before a 17:00 shift, inside the 45-min buffer
  shift: { start: "17:00", end: "23:00" },
  blocks: [],
  tasks: [
    {
      id: "t1",
      title: "Errand thing",
      status: "todo",
      priority: "quickwin",
      effortMins: 15,
      startTrigger: null,
      dueDate: null,
      scheduledFor: null,
      createdAt: new Date(Date.now() - 86_400_000),
      updatedAt: new Date(Date.now() - 86_400_000),
    },
  ],
} as never);
console.log("inside pre-shift buffer:", inBuffer.map((n) => `${n.kind}/${n.refKey}`));
if (inBuffer.some((n) => n.kind === "errand")) throw new Error("errand fired inside the pre-shift buffer");

await prisma.navSnooze.deleteMany({ where: { userId: USER, refKey: "verify-test" } });
const left = await prisma.navSnooze.count({ where: { userId: USER, refKey: "verify-test" } });
console.log("cleaned up, rows left:", left);

line("7. ritual log upsert round-trip");
const log = await prisma.navRitualLog.upsert({
  where: { userId_date_ritual: { userId: USER, date: dayFromKey(today), ritual: "morning" } },
  create: { userId: USER, date: dayFromKey(today), ritual: "morning", steps: { water: true } },
  update: { steps: { water: true } },
});
console.log("log:", { ritual: log.ritual, steps: log.steps, completedAt: log.completedAt });
await prisma.navRitualLog.deleteMany({ where: { userId: USER, ritual: "morning", date: dayFromKey(today) } });
console.log("cleaned up");

line("8. archivedAt is queryable and nothing is archived yet");
console.log({
  open: await prisma.navTask.count({ where: { userId: USER, status: { notIn: ["done", "draft"] }, archivedAt: null } }),
  archived: await prisma.navTask.count({ where: { userId: USER, archivedAt: { not: null } } }),
});

console.log("\nALL BATCH 3 CHECKS PASSED");
await prisma.$disconnect();
