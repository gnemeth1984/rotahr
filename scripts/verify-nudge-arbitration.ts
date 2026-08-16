/**
 * Proves the B1 burst arbitration does what the comment in nudges.ts claims.
 *
 * Pure module, no DB: every case here is a hand-built NudgeCtx. Run with:
 *   bun run scripts/verify-nudge-arbitration.ts
 */
import { decideNudges, BURST_CAP, type NudgeCtx, type NudgePrefs } from "../lib/navigator/nudges";

const PREFS: NudgePrefs = {
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

const DAY = "2026-08-16";
const at = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return { mins: h * 60 + m, date: new Date(`${DAY}T${hhmm}:00.000Z`) };
};

const task = (o: Partial<NudgeCtx["tasks"][number]> = {}) => ({
  id: Math.random().toString(36).slice(2),
  title: "A task",
  status: "todo",
  priority: "important",
  effortMins: 15,
  startTrigger: null,
  dueDate: null,
  scheduledFor: null,
  createdAt: new Date("2026-08-10T09:00:00.000Z"),
  updatedAt: new Date("2026-08-10T09:00:00.000Z"),
  ...o,
});

function ctx(time: string, over: Partial<NudgeCtx> = {}): NudgeCtx {
  const t = at(time);
  return {
    now: t.date,
    nowMins: t.mins,
    preShiftQuietMins: 45,
    postShiftQuietMins: 30,
    dateKey: DAY,
    prefs: PREFS,
    shift: null,
    isDayOff: false,
    planExists: true,
    blocks: [],
    hasReflection: false,
    tasks: [],
    sentToday: [],
    lastSentMins: null,
    energy: null,
    snoozes: [],
    ...over,
  };
}

let failures = 0;
function check(name: string, got: string[], want: string[]) {
  const ok = got.length === want.length && got.every((k, i) => k === want[i]);
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) console.log(`        got  [${got.join(", ")}]\n        want [${want.join(", ")}]`);
}

const kinds = (c: NudgeCtx) => decideNudges(c).map((n) => n.kind);

// 1. The bug that started this: an evening reflection window with a block
//    running and tasks due. Old order put evening 6th, so it never fired.
check(
  "close-the-day survives a busy evening",
  kinds(
    ctx("21:20", {
      blocks: [{ start: "21:25", end: "22:00", label: "Wind down", kind: "rest" }],
      tasks: [
        task({ dueDate: new Date(`${DAY}T00:00:00.000Z`) }),
        task({ dueDate: new Date("2026-08-12T00:00:00.000Z") }),
      ],
    })
  ),
  ["block", "evening"]
);

// 2. Never two pieces of nagging in one burst.
check(
  "overdue + errand + stuck collapses to one nag",
  kinds(
    ctx("14:00", {
      planExists: false, // frees the day, enables errands, and adds idle
      blocks: [],
      tasks: [
        task({ dueDate: new Date("2026-08-11T00:00:00.000Z") }),
        task({ priority: "quickwin", effortMins: 10 }),
        task({ status: "doing", updatedAt: new Date("2026-08-12T09:00:00.000Z") }),
      ],
    })
  ),
  ["idle", "overdue"]
);

// 3. Starvation: same inputs, but overdue has already been heard twice today.
//    The errand should now take the slot instead of losing it again.
check(
  "a class already heard today yields to one that has not",
  kinds(
    ctx("16:00", {
      planExists: true,
      blocks: [{ start: "12:00", end: "23:00", label: "Free afternoon", kind: "free" }],
      tasks: [
        task({ dueDate: new Date("2026-08-11T00:00:00.000Z") }),
        task({ priority: "quickwin", effortMins: 10 }),
      ],
      sentToday: [
        { kind: "overdue", refKey: "x", sentAt: at("09:00").date },
        { kind: "overdue", refKey: "y", sentAt: at("11:00").date },
      ],
    })
  ),
  ["errand"] // overdue is at its 2/day cap, so it is not even a candidate
);

// 4. Same shape, overdue heard once (still eligible) -- errand should still win
//    in the afternoon because overdue has spent its starvation bonus.
check(
  "afternoon rotation puts the unheard class first",
  kinds(
    ctx("16:00", {
      planExists: true,
      blocks: [{ start: "12:00", end: "23:00", label: "Free afternoon", kind: "free" }],
      tasks: [
        task({ dueDate: new Date("2026-08-11T00:00:00.000Z") }),
        task({ priority: "quickwin", effortMins: 10 }),
      ],
      sentToday: [{ kind: "overdue", refKey: "x", sentAt: at("09:00").date }],
    })
  ),
  ["errand"]
);

// 5. The cap itself is not relaxed.
const flood = kinds(
  ctx("21:20", {
    planExists: true,
    blocks: [
      { start: "21:25", end: "21:40", label: "Reset", kind: "free" },
      { start: "21:25", end: "22:00", label: "Admin", kind: "work" },
    ],
    tasks: [
      task({ dueDate: new Date(`${DAY}T00:00:00.000Z`) }),
      task({ dueDate: new Date("2026-08-11T00:00:00.000Z") }),
      task({ status: "doing", updatedAt: new Date("2026-08-12T09:00:00.000Z") }),
    ],
  })
);
check("burst cap holds under flood", [String(flood.length <= BURST_CAP)], ["true"]);

// 6. Structure still wins outright when a block is about to start.
check(
  "block start beats everything",
  kinds(
    ctx("09:55", {
      blocks: [{ start: "10:00", end: "11:00", label: "Deep work", kind: "work" }],
      tasks: [task({ dueDate: new Date(`${DAY}T00:00:00.000Z`) })],
    })
  ),
  ["block", "due_today"]
);

console.log(failures === 0 ? "\nAll arbitration checks passed." : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
