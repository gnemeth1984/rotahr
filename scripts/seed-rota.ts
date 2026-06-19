import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const BIZ = "christys-bar-seed-id";

// Week: Tue 24 Jun – Mon 30 Jun 2026
// Closed Sunday? No — open Tue–Mon per spec
// Tue–Thu: Kitchen 11:00–19:00, Bar 11:00–23:00
// Fri–Mon: Kitchen 08:30–19:00, Bar 08:30–23:00
// Target: 25–40h per person across the week

const staff = {
  padraig:  "emp-padraig",
  siobhan:  "emp-siobhan",
  michael:  "cmqh5yrt3000114i61qq3oj80",
  conor:    "emp-conor",
  roisin:   "emp-roisin",
  sean:     "emp-sean",
  aoife:    "emp-aoife",
  niamh:    "emp-niamh",
  nora:     "cmqh5y0xh0003wko6jw3ealre",
  declan:   "emp-declan",
  christy:  "emp-christy",
};

// dayOffset: 0=Tue 24, 1=Wed 25, 2=Thu 26, 3=Fri 27, 4=Sat 28, 5=Sun 29, 6=Mon 30
function d(dayOffset: number, hour: number, min = 0): Date {
  const base = new Date("2026-06-24T00:00:00.000Z");
  base.setUTCDate(base.getUTCDate() + dayOffset);
  base.setUTCHours(hour, min, 0, 0);
  return base;
}

type S = [string, number, number, number, number, number, string];

// Strategy for 25–40h target:
// Each person works 3–5 days. Heavy weekend (Fri/Sat/Sun), lighter Tue/Wed/Thu, Mon moderate.
// Kitchen staff rotate so not all on same days.
// Bar always needs 2 people on Fri/Sat/Sun, 1–2 on weekdays.

const shifts: S[] = [
  // ─── KITCHEN ────────────────────────────────────────────────────────────────
  // Pádraig (chef) — works Tue, Thu, Fri, Sat, Sun = 8+8+10.5+10.5+10.5 = 47.5 → trim to 4 days
  // Tue+Fri+Sat+Sun = 8+10.5+10.5+10.5 = 39.5h ✓
  [staff.padraig, 0, 11, 0, 19, 0, "chef"],          // Tue  8h
  [staff.padraig, 3, 8, 30, 19, 0, "chef"],           // Fri  10.5h
  [staff.padraig, 4, 8, 30, 19, 0, "chef"],           // Sat  10.5h
  [staff.padraig, 5, 8, 30, 19, 0, "chef"],           // Sun  10.5h  → total 39.5h ✓

  // Siobhán (sous chef) — Wed, Thu, Fri, Sat = 8+8+8+8 = 32h ✓
  [staff.siobhan, 1, 11, 0, 19, 0, "sous chef"],      // Wed  8h
  [staff.siobhan, 2, 11, 0, 19, 0, "sous chef"],      // Thu  8h
  [staff.siobhan, 3, 8, 30, 16, 30, "sous chef"],     // Fri  8h
  [staff.siobhan, 4, 8, 30, 16, 30, "sous chef"],     // Sat  8h  → total 32h ✓

  // Michael (kitchen) — Thu, Sat, Sun, Mon = 7+8+7+8.5 = 30.5h ✓
  [staff.michael, 2, 12, 0, 19, 0, "kitchen"],        // Thu  7h
  [staff.michael, 4, 10, 0, 18, 0, "kitchen"],        // Sat  8h
  [staff.michael, 5, 10, 0, 17, 0, "kitchen"],        // Sun  7h
  [staff.michael, 6, 8, 30, 17, 0, "kitchen"],        // Mon  8.5h → total 30.5h ✓

  // ─── BAR ────────────────────────────────────────────────────────────────────
  // Conor — Tue, Fri, Sat, Mon = 12+8.5+8+8.5 = 37h ✓
  [staff.conor,   0, 11, 0, 23, 0, "bartender"],      // Tue  12h
  [staff.conor,   3, 8, 30, 17, 0, "bartender"],      // Fri  8.5h
  [staff.conor,   4, 8, 30, 16, 30, "bartender"],     // Sat  8h
  [staff.conor,   6, 8, 30, 17, 0, "bartender"],      // Mon  8.5h → total 37h ✓

  // Róisín — Wed, Thu, Fri, Sat, Sun = 6+8+8+8+8 = 38h ✓
  [staff.roisin,  1, 17, 0, 23, 0, "bartender"],      // Wed  6h
  [staff.roisin,  2, 11, 0, 19, 0, "bartender"],      // Thu  8h
  [staff.roisin,  3, 14, 0, 22, 0, "bartender"],      // Fri  8h
  [staff.roisin,  4, 14, 0, 23, 0, "bartender"],      // Sat  9h
  [staff.roisin,  5, 14, 0, 22, 0, "bartender"],      // Sun  8h  → total 39h ✓

  // Seán — Wed, Thu, Fri, Sat, Sun, Mon = 6+8+7+8+7+9 = 45 → trim
  // Wed, Fri, Sat, Sun, Mon = 6+7+8+7+9 = 37h ✓
  [staff.sean,    1, 17, 0, 23, 0, "bartender"],      // Wed  6h
  [staff.sean,    3, 16, 0, 23, 0, "bartender"],      // Fri  7h
  [staff.sean,    4, 15, 0, 23, 0, "bartender"],      // Sat  8h
  [staff.sean,    5, 16, 0, 23, 0, "bartender"],      // Sun  7h
  [staff.sean,    6, 14, 0, 23, 0, "bartender"],      // Mon  9h  → total 37h ✓

  // ─── FLOOR ──────────────────────────────────────────────────────────────────
  // Aoife (waitress) — Tue, Thu, Fri, Sat = 8+8+8.5+9 = 33.5h ✓
  [staff.aoife,   0, 11, 0, 19, 0, "waitress"],       // Tue  8h
  [staff.aoife,   2, 11, 0, 19, 0, "waitress"],       // Thu  8h
  [staff.aoife,   3, 8, 30, 17, 0, "waitress"],       // Fri  8.5h
  [staff.aoife,   4, 8, 30, 17, 30, "waitress"],      // Sat  9h  → total 33.5h ✓

  // Niamh (waitress) — Wed, Fri, Sat, Sun, Mon = 8+9+9+9+8.5 = 43.5 → trim
  // Wed, Sat, Sun, Mon = 8+9+9+8.5 = 34.5h ✓
  [staff.niamh,   1, 11, 0, 19, 0, "waitress"],       // Wed  8h
  [staff.niamh,   4, 8, 30, 17, 30, "waitress"],      // Sat  9h
  [staff.niamh,   5, 12, 0, 21, 0, "waitress"],       // Sun  9h
  [staff.niamh,   6, 8, 30, 17, 0, "waitress"],       // Mon  8.5h → total 34.5h ✓

  // Nora (floor) — Thu, Fri, Sat, Sun = 8+8.5+9+9 = 34.5h ✓
  [staff.nora,    2, 15, 0, 23, 0, "floor"],          // Thu  8h
  [staff.nora,    3, 8, 30, 17, 0, "floor"],          // Fri  8.5h
  [staff.nora,    4, 14, 0, 23, 0, "floor"],          // Sat  9h
  [staff.nora,    5, 12, 0, 21, 0, "floor"],          // Sun  9h  → total 34.5h ✓

  // Declan (floor manager) — Tue, Wed, Fri, Sat, Sun = 8+8+9+10+9 = 44 → trim
  // Tue, Fri, Sat = 8+9+10 = 27h — add Thu = 27+8 = 35h ✓
  [staff.declan,  0, 11, 0, 19, 0, "floor manager"],  // Tue  8h
  [staff.declan,  2, 11, 0, 19, 0, "floor manager"],  // Thu  8h
  [staff.declan,  3, 12, 0, 21, 0, "floor manager"],  // Fri  9h
  [staff.declan,  4, 8, 30, 18, 30, "floor manager"], // Sat  10h → total 35h ✓

  // ─── MANAGER ────────────────────────────────────────────────────────────────
  // Christy — Thu, Fri, Sat, Sun = 8+9+9+9 = 35h ✓
  [staff.christy, 2, 11, 0, 19, 0, "manager"],        // Thu  8h
  [staff.christy, 3, 10, 0, 19, 0, "manager"],        // Fri  9h
  [staff.christy, 4, 9, 0, 18, 0, "manager"],         // Sat  9h
  [staff.christy, 5, 10, 0, 19, 0, "manager"],        // Sun  9h  → total 35h ✓
];

async function main() {
  // Clear this week
  const weekStart = new Date("2026-06-22T00:00:00.000Z");
  const weekEnd   = new Date("2026-06-30T23:59:59.999Z");
  const { count: cleared } = await prisma.shift.deleteMany({
    where: { date: { gte: weekStart, lte: weekEnd } },
  });
  console.log(`Cleared ${cleared} existing shifts`);

  let created = 0;
  for (const [empId, day, sh, sm, eh, em, role] of shifts) {
    const startTime = d(day, sh, sm);
    const endTime   = d(day, eh, em);
    const date      = d(day, 0, 0);
    const hours = (endTime.getTime() - startTime.getTime()) / (1000 * 3600);

    await prisma.shift.create({
      data: {
        employeeId: empId,
        date,
        startTime,
        endTime,
        role,
        published: true,
        overtimeHours: Math.max(0, hours - 8),
      },
    });
    created++;
  }

  console.log(`Created ${created} shifts\n`);

  // Hours summary
  const names: Record<string, string> = {
    [staff.padraig]: "Pádraig  (chef)",
    [staff.siobhan]: "Siobhán  (sous chef)",
    [staff.michael]: "Michael  (kitchen)",
    [staff.conor]:   "Conor    (bar)",
    [staff.roisin]:  "Róisín   (bar)",
    [staff.sean]:    "Seán     (bar)",
    [staff.aoife]:   "Aoife    (floor)",
    [staff.niamh]:   "Niamh    (floor)",
    [staff.nora]:    "Nora     (floor)",
    [staff.declan]:  "Declan   (floor mgr)",
    [staff.christy]: "Christy  (manager)",
  };

  const summary: Record<string, number> = {};
  for (const [empId, , sh, sm, eh, em] of shifts) {
    const hours = (eh * 60 + em - sh * 60 - sm) / 60;
    summary[empId] = (summary[empId] ?? 0) + hours;
  }

  console.log("Weekly hours:");
  for (const [id, total] of Object.entries(summary).sort((a, b) => b[1] - a[1])) {
    const bar = "█".repeat(Math.round(total / 2));
    const flag = total < 25 ? " ⚠ UNDER" : total > 40 ? " ⚠ OVER" : " ✓";
    console.log(`  ${(names[id] ?? id).padEnd(24)} ${total.toFixed(1).padStart(5)}h  ${bar}${flag}`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
