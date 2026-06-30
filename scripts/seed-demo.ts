// @ts-nocheck
/**
 * seed-demo.ts
 * Full demo seed for "The Anchor & Tap" — a fictional Dublin bar/restaurant.
 *
 * Demo accounts:
 *  MANAGER  — sarah.connolly@rotahr.demo  / Demo1234!
 *  MANAGER  — tony.brennan@rotahr.demo    / Demo1234!
 *  EMPLOYEE (Head Chef / Kitchen Manager) — marco.deluca@rotahr.demo   / Demo1234!
 *  EMPLOYEE (Bar Manager)                 — fiona.mccarthy@rotahr.demo / Demo1234!
 *  EMPLOYEE (Staff - bartender)           — tommy.ryan@rotahr.demo     / Demo1234!
 *
 * Run: npx tsx scripts/seed-demo.ts
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

// NOTE: No top-level PrismaClient instantiation here — each caller creates its own instance.
// This prevents Next.js from running DB connections at build time when this file is imported.

// ─── IDs ──────────────────────────────────────────────────────────────────────
const BIZ   = "demo-anchor-tap-biz";
const VENUE = "demo-anchor-venue";

const DEPTS = {
  kitchen: "demo-dept-kitchen",
  bar:     "demo-dept-bar",
  floor:   "demo-dept-floor",
  mgmt:    "demo-dept-mgmt",
};

const USERS = {
  sarah:  "demo-user-sarah",
  tony:   "demo-user-tony",
  marco:  "demo-user-marco",
  fiona:  "demo-user-fiona",
  tommy:  "demo-user-tommy",
  caitlin:"demo-user-caitlin",
  declan: "demo-user-declan",
  aoife:  "demo-user-aoife",
  liam:   "demo-user-liam",
  roisin: "demo-user-roisin",
};

const EMPS = {
  sarah:  "demo-emp-sarah",
  tony:   "demo-emp-tony",
  marco:  "demo-emp-marco",
  fiona:  "demo-emp-fiona",
  tommy:  "demo-emp-tommy",
  caitlin:"demo-emp-caitlin",
  declan: "demo-emp-declan",
  aoife:  "demo-emp-aoife",
  liam:   "demo-emp-liam",
  roisin: "demo-emp-roisin",
};

const TABLES = {
  t1: "demo-table-1", t2: "demo-table-2", t3: "demo-table-3",
  t4: "demo-table-4", t5: "demo-table-5", t6: "demo-table-6",
  t7: "demo-table-7", t8: "demo-table-8",
};

const PW = "Demo1234!";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function days(offsetFromToday: number, h = 12, m = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + offsetFromToday);
  d.setHours(h, m, 0, 0);
  return d;
}

function monday(weekOffset = 0): Date {
  const d = new Date();
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day; // get to Monday
  d.setDate(d.getDate() + diff + weekOffset * 7);
  d.setHours(0, 0, 0, 0);
  return d;
}

function shiftDate(weekOffset: number, dayOfWeek: number, hour: number, minute = 0): Date {
  // dayOfWeek: 1=Mon … 7=Sun
  const mon = monday(weekOffset);
  mon.setDate(mon.getDate() + (dayOfWeek - 1));
  mon.setHours(hour, minute, 0, 0);
  return mon;
}

async function hash(pw: string) {
  return bcrypt.hash(pw, 12);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main(prisma: PrismaClient = new PrismaClient()) {
  console.log("🌱 Seeding demo: The Anchor & Tap...");

  const pw = await hash(PW);

  // ── 1. Business ─────────────────────────────────────────────────────────────
  await prisma.business.upsert({
    where: { id: BIZ },
    create: {
      id: BIZ,
      name: "The Anchor & Tap",
      onboardingComplete: true,
      geoLat: 53.3498,
      geoLng: -6.2603,
      geoRadius: 200,
      weeklyRevenueTarget: 28000,
    },
    update: {
      name: "The Anchor & Tap",
      onboardingComplete: true,
      weeklyRevenueTarget: 28000,
    },
  });

  // ── 2. Venue ────────────────────────────────────────────────────────────────
  await prisma.venue.upsert({
    where: { id: VENUE },
    create: {
      id: VENUE,
      businessId: BIZ,
      name: "The Anchor & Tap — Main Venue",
      address: "14 Harbour Street, Dublin 2, D02 XY01",
      geoLat: 53.3498,
      geoLng: -6.2603,
      geoRadius: 200,
      timezone: "Europe/Dublin",
      isDefault: true,
      active: true,
    },
    update: {},
  });

  // ── 3. Departments ──────────────────────────────────────────────────────────
  for (const [key, id] of Object.entries(DEPTS)) {
    const names: Record<string, string> = {
      kitchen: "Kitchen",
      bar:     "Bar",
      floor:   "Floor",
      mgmt:    "Management",
    };
    await prisma.department.upsert({
      where: { id },
      create: { id, businessId: BIZ, name: names[key] },
      update: { name: names[key] },
    });
  }

  // ── 4. Users ─────────────────────────────────────────────────────────────────
  const userDefs = [
    { id: USERS.sarah,   email: "sarah.connolly@rotahr.demo",  name: "Sarah Connolly",  role: "MANAGER"  },
    { id: USERS.tony,    email: "tony.brennan@rotahr.demo",    name: "Tony Brennan",    role: "MANAGER"  },
    { id: USERS.marco,   email: "marco.deluca@rotahr.demo",    name: "Marco De Luca",   role: "EMPLOYEE" },
    { id: USERS.fiona,   email: "fiona.mccarthy@rotahr.demo",  name: "Fiona McCarthy",  role: "EMPLOYEE" },
    { id: USERS.tommy,   email: "tommy.ryan@rotahr.demo",      name: "Tommy Ryan",      role: "EMPLOYEE" },
    { id: USERS.caitlin, email: "caitlin.kelly@rotahr.demo",   name: "Caitlín Kelly",   role: "EMPLOYEE" },
    { id: USERS.declan,  email: "declan.walsh@rotahr.demo",    name: "Declan Walsh",    role: "EMPLOYEE" },
    { id: USERS.aoife,   email: "aoife.byrne@rotahr.demo",     name: "Aoife Byrne",     role: "EMPLOYEE" },
    { id: USERS.liam,    email: "liam.murphy@rotahr.demo",     name: "Liam Murphy",     role: "EMPLOYEE" },
    { id: USERS.roisin,  email: "roisin.malone@rotahr.demo",   name: "Róisín Malone",   role: "EMPLOYEE" },
  ];

  for (const u of userDefs) {
    await prisma.user.upsert({
      where: { id: u.id },
      create: { id: u.id, email: u.email, name: u.name, role: u.role, businessId: BIZ, password: pw },
      update: { name: u.name, role: u.role, businessId: BIZ, password: pw },
    });
  }

  // ── 5. Employees ─────────────────────────────────────────────────────────────
  const empDefs = [
    { id: EMPS.sarah,   userId: USERS.sarah,   first: "Sarah",    last: "Connolly", role: "general manager",    dept: DEPTS.mgmt,    rate: 28.0 },
    { id: EMPS.tony,    userId: USERS.tony,    first: "Tony",     last: "Brennan",  role: "operations manager", dept: DEPTS.mgmt,    rate: 26.0 },
    { id: EMPS.marco,   userId: USERS.marco,   first: "Marco",    last: "De Luca",  role: "head chef",          dept: DEPTS.kitchen, rate: 22.5 },
    { id: EMPS.fiona,   userId: USERS.fiona,   first: "Fiona",    last: "McCarthy", role: "bar manager",        dept: DEPTS.bar,     rate: 20.0 },
    { id: EMPS.tommy,   userId: USERS.tommy,   first: "Tommy",    last: "Ryan",     role: "bartender",          dept: DEPTS.bar,     rate: 15.5 },
    { id: EMPS.caitlin, userId: USERS.caitlin, first: "Caitlín",  last: "Kelly",    role: "sous chef",          dept: DEPTS.kitchen, rate: 18.0 },
    { id: EMPS.declan,  userId: USERS.declan,  first: "Declan",   last: "Walsh",    role: "kitchen porter",     dept: DEPTS.kitchen, rate: 13.5 },
    { id: EMPS.aoife,   userId: USERS.aoife,   first: "Aoife",    last: "Byrne",    role: "waitress",           dept: DEPTS.floor,   rate: 14.0 },
    { id: EMPS.liam,    userId: USERS.liam,    first: "Liam",     last: "Murphy",   role: "bartender",          dept: DEPTS.bar,     rate: 15.0 },
    { id: EMPS.roisin,  userId: USERS.roisin,  first: "Róisín",   last: "Malone",   role: "floor staff",        dept: DEPTS.floor,   rate: 13.5 },
  ];

  for (const e of empDefs) {
    await prisma.employee.upsert({
      where: { id: e.id },
      create: {
        id: e.id,
        businessId: BIZ,
        venueId: VENUE,
        userId: e.userId,
        firstName: e.first,
        lastName: e.last,
        email: `${e.first.toLowerCase().replace("ó","o").replace("í","i").replace("á","a")}.${e.last.toLowerCase().replace(" ",".")}@rotahr.demo`,
        phone: `+353 8${Math.floor(10000000 + Math.random() * 89999999)}`,
        role: e.role,
        departmentId: e.dept,
        hourlyRate: e.rate,
        active: true,
        permissions: e.id === EMPS.marco ? ["bookkeeping", "stocktaking"] : [],
      },
      update: {
        role: e.role,
        hourlyRate: e.rate,
        departmentId: e.dept,
        venueId: VENUE,
        // Grant bookkeeping + stocktaking to Marco so demo shows permissions feature
        ...(e.id === EMPS.marco ? { permissions: ["bookkeeping", "stocktaking"] } : { permissions: [] }),
      },
    });
  }

  // ── 6. Tables ────────────────────────────────────────────────────────────────
  const tableDefs = [
    { id: TABLES.t1, name: "Table 1", capacity: 2, location: "Window" },
    { id: TABLES.t2, name: "Table 2", capacity: 4, location: "Main Floor" },
    { id: TABLES.t3, name: "Table 3", capacity: 4, location: "Main Floor" },
    { id: TABLES.t4, name: "Table 4", capacity: 6, location: "Booth" },
    { id: TABLES.t5, name: "Table 5", capacity: 6, location: "Booth" },
    { id: TABLES.t6, name: "Table 6", capacity: 8, location: "Private Area" },
    { id: TABLES.t7, name: "Bar Seating A", capacity: 3, location: "Bar" },
    { id: TABLES.t8, name: "Bar Seating B", capacity: 3, location: "Bar" },
  ];

  for (const t of tableDefs) {
    await prisma.table.upsert({
      where: { id: t.id },
      create: { ...t, businessId: BIZ },
      update: { name: t.name, capacity: t.capacity, location: t.location },
    });
  }

  // ── 7. Shifts — 3 weeks (prev, current, next) ─────────────────────────────
  // Clear existing demo shifts first
  await prisma.shift.deleteMany({
    where: { venueId: VENUE },
  });

  type ShiftDef = [string, number, number, number, number, number, string, boolean];
  // [empId, weekOffset, dayOfWeek(1=Mon), startH, startM, endH, endM, role, published]
  // Simplified: [empId, weekOffset, dow, startH, endH, role, published]

  const shiftRows: Array<[string, number, number, number, number, string, boolean]> = [
    // ── PREVIOUS WEEK (weekOffset=-1) — all published, history ──────────────
    [EMPS.marco,   -1, 1, 8,  19, "Head Chef",        true],
    [EMPS.marco,   -1, 2, 8,  19, "Head Chef",        true],
    [EMPS.marco,   -1, 4, 8,  19, "Head Chef",        true],
    [EMPS.marco,   -1, 5, 8,  19, "Head Chef",        true],
    [EMPS.caitlin, -1, 1, 9,  17, "Sous Chef",        true],
    [EMPS.caitlin, -1, 3, 9,  17, "Sous Chef",        true],
    [EMPS.caitlin, -1, 5, 9,  17, "Sous Chef",        true],
    [EMPS.caitlin, -1, 6, 9,  17, "Sous Chef",        true],
    [EMPS.declan,  -1, 1, 10, 18, "Kitchen Porter",   true],
    [EMPS.declan,  -1, 3, 10, 18, "Kitchen Porter",   true],
    [EMPS.declan,  -1, 5, 10, 18, "Kitchen Porter",   true],
    [EMPS.declan,  -1, 7, 10, 18, "Kitchen Porter",   true],
    [EMPS.fiona,   -1, 1, 12, 22, "Bar Manager",      true],
    [EMPS.fiona,   -1, 3, 12, 22, "Bar Manager",      true],
    [EMPS.fiona,   -1, 5, 15, 23, "Bar Manager",      true],
    [EMPS.fiona,   -1, 6, 15, 23, "Bar Manager",      true],
    [EMPS.tommy,   -1, 2, 15, 23, "Bartender",        true],
    [EMPS.tommy,   -1, 4, 15, 23, "Bartender",        true],
    [EMPS.tommy,   -1, 5, 12, 22, "Bartender",        true],
    [EMPS.tommy,   -1, 6, 12, 22, "Bartender",        true],
    [EMPS.tommy,   -1, 7, 12, 22, "Bartender",        true],
    [EMPS.liam,    -1, 1, 17, 23, "Bartender",        true],
    [EMPS.liam,    -1, 3, 17, 23, "Bartender",        true],
    [EMPS.liam,    -1, 5, 17, 23, "Bartender",        true],
    [EMPS.liam,    -1, 6, 15, 23, "Bartender",        true],
    [EMPS.aoife,   -1, 1, 12, 20, "Waitress",         true],
    [EMPS.aoife,   -1, 2, 12, 20, "Waitress",         true],
    [EMPS.aoife,   -1, 5, 17, 23, "Waitress",         true],
    [EMPS.aoife,   -1, 6, 12, 22, "Waitress",         true],
    [EMPS.roisin,  -1, 2, 17, 23, "Floor Staff",      true],
    [EMPS.roisin,  -1, 4, 12, 20, "Floor Staff",      true],
    [EMPS.roisin,  -1, 6, 12, 22, "Floor Staff",      true],
    [EMPS.roisin,  -1, 7, 12, 20, "Floor Staff",      true],
    [EMPS.sarah,   -1, 1, 9,  17, "General Manager",  true],
    [EMPS.sarah,   -1, 2, 9,  17, "General Manager",  true],
    [EMPS.sarah,   -1, 3, 9,  17, "General Manager",  true],
    [EMPS.tony,    -1, 3, 11, 19, "Operations Mgr",   true],
    [EMPS.tony,    -1, 4, 11, 19, "Operations Mgr",   true],
    [EMPS.tony,    -1, 5, 11, 21, "Operations Mgr",   true],

    // ── CURRENT WEEK (weekOffset=0) — published ──────────────────────────────
    [EMPS.marco,   0, 1, 8,  19, "Head Chef",        true],
    [EMPS.marco,   0, 2, 8,  19, "Head Chef",        true],
    [EMPS.marco,   0, 5, 8,  19, "Head Chef",        true],
    [EMPS.marco,   0, 6, 8,  19, "Head Chef",        true],
    [EMPS.caitlin, 0, 1, 9,  17, "Sous Chef",        true],
    [EMPS.caitlin, 0, 3, 9,  17, "Sous Chef",        true],
    [EMPS.caitlin, 0, 5, 9,  19, "Sous Chef",        true],
    [EMPS.caitlin, 0, 6, 9,  19, "Sous Chef",        true],
    [EMPS.declan,  0, 2, 10, 18, "Kitchen Porter",   true],
    [EMPS.declan,  0, 4, 10, 18, "Kitchen Porter",   true],
    [EMPS.declan,  0, 5, 10, 18, "Kitchen Porter",   true],
    [EMPS.declan,  0, 7, 10, 18, "Kitchen Porter",   true],
    [EMPS.fiona,   0, 1, 14, 23, "Bar Manager",      true],
    [EMPS.fiona,   0, 3, 12, 22, "Bar Manager",      true],
    [EMPS.fiona,   0, 5, 15, 23, "Bar Manager",      true],
    [EMPS.fiona,   0, 6, 12, 23, "Bar Manager",      true],
    [EMPS.tommy,   0, 2, 15, 23, "Bartender",        true],
    [EMPS.tommy,   0, 4, 15, 23, "Bartender",        true],
    [EMPS.tommy,   0, 5, 12, 22, "Bartender",        true],
    [EMPS.tommy,   0, 6, 12, 22, "Bartender",        true],
    [EMPS.tommy,   0, 7, 12, 20, "Bartender",        true],
    [EMPS.liam,    0, 1, 17, 23, "Bartender",        true],
    [EMPS.liam,    0, 3, 17, 23, "Bartender",        true],
    [EMPS.liam,    0, 5, 17, 23, "Bartender",        true],
    [EMPS.liam,    0, 6, 15, 23, "Bartender",        true],
    [EMPS.aoife,   0, 1, 12, 20, "Waitress",         true],
    [EMPS.aoife,   0, 3, 12, 20, "Waitress",         true],
    [EMPS.aoife,   0, 5, 17, 23, "Waitress",         true],
    [EMPS.aoife,   0, 6, 12, 22, "Waitress",         true],
    [EMPS.roisin,  0, 2, 17, 23, "Floor Staff",      true],
    [EMPS.roisin,  0, 4, 12, 20, "Floor Staff",      true],
    [EMPS.roisin,  0, 6, 12, 22, "Floor Staff",      true],
    [EMPS.roisin,  0, 7, 12, 20, "Floor Staff",      true],
    [EMPS.sarah,   0, 1, 9,  17, "General Manager",  true],
    [EMPS.sarah,   0, 2, 9,  17, "General Manager",  true],
    [EMPS.sarah,   0, 3, 9,  17, "General Manager",  true],
    [EMPS.tony,    0, 3, 11, 19, "Operations Mgr",   true],
    [EMPS.tony,    0, 4, 11, 19, "Operations Mgr",   true],
    [EMPS.tony,    0, 5, 11, 21, "Operations Mgr",   true],

    // ── NEXT WEEK (weekOffset=1) — draft (unpublished), ready to review ──────
    [EMPS.marco,   1, 1, 8,  19, "Head Chef",        false],
    [EMPS.marco,   1, 3, 8,  19, "Head Chef",        false],
    [EMPS.marco,   1, 5, 8,  19, "Head Chef",        false],
    [EMPS.marco,   1, 6, 8,  19, "Head Chef",        false],
    [EMPS.caitlin, 1, 2, 9,  17, "Sous Chef",        false],
    [EMPS.caitlin, 1, 4, 9,  17, "Sous Chef",        false],
    [EMPS.caitlin, 1, 5, 9,  19, "Sous Chef",        false],
    [EMPS.caitlin, 1, 7, 9,  17, "Sous Chef",        false],
    [EMPS.declan,  1, 1, 10, 18, "Kitchen Porter",   false],
    [EMPS.declan,  1, 3, 10, 18, "Kitchen Porter",   false],
    [EMPS.declan,  1, 5, 10, 18, "Kitchen Porter",   false],
    [EMPS.declan,  1, 6, 10, 18, "Kitchen Porter",   false],
    [EMPS.fiona,   1, 2, 14, 23, "Bar Manager",      false],
    [EMPS.fiona,   1, 4, 12, 22, "Bar Manager",      false],
    [EMPS.fiona,   1, 5, 15, 23, "Bar Manager",      false],
    [EMPS.fiona,   1, 6, 12, 23, "Bar Manager",      false],
    [EMPS.tommy,   1, 1, 15, 23, "Bartender",        false],
    [EMPS.tommy,   1, 3, 15, 23, "Bartender",        false],
    [EMPS.tommy,   1, 5, 12, 22, "Bartender",        false],
    [EMPS.tommy,   1, 6, 12, 22, "Bartender",        false],
    [EMPS.liam,    1, 2, 17, 23, "Bartender",        false],
    [EMPS.liam,    1, 4, 17, 23, "Bartender",        false],
    [EMPS.liam,    1, 5, 17, 23, "Bartender",        false],
    [EMPS.liam,    1, 7, 15, 23, "Bartender",        false],
    [EMPS.aoife,   1, 2, 12, 20, "Waitress",         false],
    [EMPS.aoife,   1, 4, 12, 20, "Waitress",         false],
    [EMPS.aoife,   1, 6, 17, 23, "Waitress",         false],
    [EMPS.aoife,   1, 7, 12, 22, "Waitress",         false],
    [EMPS.roisin,  1, 1, 17, 23, "Floor Staff",      false],
    [EMPS.roisin,  1, 3, 12, 20, "Floor Staff",      false],
    [EMPS.roisin,  1, 5, 12, 22, "Floor Staff",      false],
    [EMPS.roisin,  1, 6, 12, 20, "Floor Staff",      false],
    [EMPS.sarah,   1, 1, 9,  17, "General Manager",  false],
    [EMPS.sarah,   1, 2, 9,  17, "General Manager",  false],
    [EMPS.sarah,   1, 4, 9,  17, "General Manager",  false],
    [EMPS.tony,    1, 2, 11, 19, "Operations Mgr",   false],
    [EMPS.tony,    1, 4, 11, 19, "Operations Mgr",   false],
    [EMPS.tony,    1, 6, 11, 21, "Operations Mgr",   false],
  ];

  for (const [empId, wo, dow, sh, eh, role, pub] of shiftRows) {
    const start = shiftDate(wo, dow, sh);
    const end   = shiftDate(wo, dow, eh);
    if (end <= start) end.setDate(end.getDate() + 1); // past-midnight fix
    await prisma.shift.create({
      data: {
        employeeId: empId,
        venueId: VENUE,
        date: new Date(start.getFullYear(), start.getMonth(), start.getDate()),
        startTime: start,
        endTime: end,
        role,
        published: pub,
      },
    });
  }
  console.log("✅ Shifts created");

  // ── 8. Reservations ─────────────────────────────────────────────────────────
  await prisma.reservation.deleteMany({ where: { businessId: BIZ } });

  const resDefs = [
    // Today & tomorrow
    { name: "O'Sullivan Family",   email: "osullivan@example.ie",  phone: "0871234561", size: 6, dayOff: 0,  time: "13:00", tableId: TABLES.t4, status: "confirmed", notes: "Anniversary dinner", occasion: "anniversary", dietary: "1 vegetarian" },
    { name: "Murphy, James",       email: "jmurphy@example.ie",    phone: "0872345672", size: 2, dayOff: 0,  time: "19:30", tableId: TABLES.t1, status: "confirmed", notes: null, occasion: null, dietary: null },
    { name: "Byrne Party x4",      email: "byrne4@example.ie",     phone: "0873456783", size: 4, dayOff: 0,  time: "20:00", tableId: TABLES.t2, status: "confirmed", notes: "Birthday cake ordered", occasion: "birthday", dietary: null },
    { name: "Keane, Siobhán",      email: "skeane@example.ie",     phone: "0874567894", size: 2, dayOff: 1,  time: "12:30", tableId: TABLES.t1, status: "confirmed", notes: "Business lunch", occasion: null, dietary: "gluten free" },
    { name: "Corporate — Accenture",email: "events@accenture.com", phone: "0875678905", size: 8, dayOff: 1,  time: "19:00", tableId: TABLES.t6, status: "confirmed", notes: "Team dinner. Pre-order: 4 beef, 3 chicken, 1 vegan", occasion: null, dietary: "1 vegan" },
    { name: "Walsh, Padraig",      email: null,                    phone: "0876789016", size: 3, dayOff: 2,  time: "13:00", tableId: TABLES.t8, status: "confirmed", notes: null, occasion: null, dietary: null },
    { name: "Fitzgerald Group",    email: "fitzgerald@example.ie", phone: "0877890127", size: 5, dayOff: 2,  time: "18:30", tableId: TABLES.t5, status: "confirmed", notes: "Pre-theatre. Must be finished by 20:30", occasion: null, dietary: null },
    { name: "Brennan, Claire",     email: "claire.b@example.ie",   phone: "0878901238", size: 2, dayOff: 3,  time: "20:00", tableId: TABLES.t2, status: "confirmed", notes: "Proposal dinner — flowers arranged", occasion: "proposal", dietary: null },
    { name: "O'Brien x3",          email: null,                    phone: "0879012349", size: 3, dayOff: 3,  time: "12:00", tableId: TABLES.t3, status: "confirmed", notes: null, occasion: null, dietary: null },
    { name: "McCarthy, David",     email: "dmccarthy@example.ie",  phone: "0870123450", size: 4, dayOff: 4,  time: "19:00", tableId: TABLES.t3, status: "confirmed", notes: null, occasion: null, dietary: "2 dairy free" },
    { name: "Connolly Reunion",    email: "reunion@example.ie",    phone: "0871234562", size: 8, dayOff: 5,  time: "14:00", tableId: TABLES.t6, status: "confirmed", notes: "Family reunion — kids menu needed", occasion: null, dietary: "3 kids" },
    { name: "Ryan, Aoife",         email: "aoife.r@example.ie",    phone: "0872345673", size: 2, dayOff: 5,  time: "20:30", tableId: TABLES.t1, status: "confirmed", notes: null, occasion: "birthday", dietary: null },
    { name: "Hennessy Party",      email: "hennessy@example.ie",   phone: "0873456784", size: 6, dayOff: 6,  time: "13:00", tableId: TABLES.t5, status: "confirmed", notes: null, occasion: null, dietary: "1 nut allergy" },
    { name: "Gallagher, Eoin",     email: null,                    phone: "0874567895", size: 2, dayOff: 6,  time: "19:00", tableId: TABLES.t7, status: "confirmed", notes: null, occasion: null, dietary: null },
    { name: "Power, Sinéad",       email: "spower@example.ie",     phone: "0875678906", size: 4, dayOff: 7,  time: "12:00", tableId: TABLES.t4, status: "confirmed", notes: null, occasion: null, dietary: null },
    // Cancelled & no-show for realism
    { name: "Doyle x2",            email: null,                    phone: "0876789017", size: 2, dayOff: -1, time: "19:00", tableId: TABLES.t2, status: "no_show",   notes: "No show — called after", occasion: null, dietary: null },
    { name: "King, Patrick",       email: "pking@example.ie",      phone: "0877890128", size: 3, dayOff: -2, time: "20:00", tableId: TABLES.t3, status: "cancelled", notes: "Cancelled day-of", occasion: null, dietary: null },
    // Far future — pipeline
    { name: "Dunne Wedding Party", email: "dunne@example.ie",      phone: "0878901239", size: 8, dayOff: 14, time: "18:00", tableId: TABLES.t6, status: "confirmed", notes: "Wedding party — private area. Champagne on arrival", occasion: "wedding", dietary: "2 vegan, 1 halal" },
    { name: "Tech Startup Dinner", email: "ceo@startupco.ie",      phone: "0879012341", size: 5, dayOff: 10, time: "19:30", tableId: TABLES.t5, status: "confirmed", notes: "Investor dinner", occasion: null, dietary: null },
  ];

  for (const r of resDefs) {
    const dt = days(r.dayOff, 12);
    await prisma.reservation.create({
      data: {
        businessId: BIZ,
        customerName: r.name,
        customerEmail: r.email,
        customerPhone: r.phone,
        partySize: r.size,
        date: dt,
        time: r.time,
        duration: 90,
        status: r.status,
        notes: r.notes,
        occasion: r.occasion,
        dietary: r.dietary,
        tableId: r.tableId,
        createdById: USERS.sarah,
      },
    });
  }
  console.log("✅ Reservations created");

  // ── 9. Expenses / Bookkeeping ───────────────────────────────────────────────
  await prisma.expense.deleteMany({ where: { businessId: BIZ } });

  const expDefs = [
    { amt: 1240.50, vat: 233.40, vendor: "Musgrave MarketPlace", cat: "food_supplies",  date: days(-1),  desc: "Weekly food delivery — meat, veg, dairy", method: "invoice" },
    { amt: 876.00,  vat: 164.83, vendor: "Diageo Ireland",       cat: "beverages",      date: days(-2),  desc: "Keg order — Guinness x6, Heineken x4, Hop House x4", method: "invoice" },
    { amt: 320.00,  vat: 60.16,  vendor: "BWG Wines",            cat: "beverages",      date: days(-3),  desc: "Wine order — house red x12, white x12, rosé x6", method: "invoice" },
    { amt: 145.99,  vat: 27.46,  vendor: "Bunzl Ireland",        cat: "cleaning",       date: days(-4),  desc: "Cleaning & hygiene supplies", method: "card" },
    { amt: 2100.00, vat: 0,      vendor: "ESB Energy",           cat: "utilities",      date: days(-5),  desc: "Monthly electricity bill — June", method: "direct_debit" },
    { amt: 580.00,  vat: 0,      vendor: "Bord Gáis Networks",   cat: "utilities",      date: days(-6),  desc: "Monthly gas — June", method: "direct_debit" },
    { amt: 189.00,  vat: 35.54,  vendor: "Sysco Ireland",        cat: "food_supplies",  date: days(-7),  desc: "Dry goods & condiments top-up", method: "invoice" },
    { amt: 450.00,  vat: 84.62,  vendor: "Ashtree Linen",        cat: "laundry",        date: days(-8),  desc: "Linen rental & laundry service", method: "invoice" },
    { amt: 99.00,   vat: 18.62,  vendor: "Eir Business",         cat: "telecoms",       date: days(-9),  desc: "Broadband & phone — monthly", method: "direct_debit" },
    { amt: 340.00,  vat: 63.93,  vendor: "Musgrave MarketPlace", cat: "food_supplies",  date: days(-10), desc: "Midweek top-up — fresh produce", method: "card" },
    { amt: 1560.00, vat: 293.30, vendor: "Diageo Ireland",       cat: "beverages",      date: days(-11), desc: "Monthly spirits & RTD delivery", method: "invoice" },
    { amt: 75.00,   vat: 14.10,  vendor: "Gas Direct",           cat: "maintenance",    date: days(-12), desc: "Gas canister replacement — kitchen", method: "cash" },
    { amt: 220.00,  vat: 41.36,  vendor: "JP Maintenance",       cat: "maintenance",    date: days(-13), desc: "Emergency call-out — walk-in fridge repair", method: "card" },
    { amt: 512.00,  vat: 96.26,  vendor: "Tesco B2B",            cat: "food_supplies",  date: days(-14), desc: "Weekend food top-up order", method: "card" },
    { amt: 180.00,  vat: 0,      vendor: "Revenue Commissioners",cat: "tax",            date: days(-15), desc: "VAT return payment Q2", method: "bank_transfer" },
    { amt: 95.00,   vat: 17.86,  vendor: "CHUBB Security",       cat: "security",       date: days(-16), desc: "Monthly alarm monitoring", method: "direct_debit" },
    { amt: 430.00,  vat: 80.84,  vendor: "Coca-Cola HBC Ireland",cat: "beverages",      date: days(-17), desc: "Soft drink & mixer delivery", method: "invoice" },
    { amt: 2800.00, vat: 0,      vendor: "AIB Business Rent",    cat: "rent",           date: days(-20), desc: "June rent — premises", method: "bank_transfer" },
    { amt: 145.00,  vat: 27.27,  vendor: "Pallas Foods",         cat: "food_supplies",  date: days(-21), desc: "Fish & seafood order", method: "invoice" },
    { amt: 60.00,   vat: 11.28,  vendor: "Centra Wholesale",     cat: "food_supplies",  date: days(-22), desc: "Emergency stock run", method: "cash" },
  ];

  for (const ex of expDefs) {
    await prisma.expense.create({
      data: {
        businessId: BIZ,
        amount: ex.amt,
        vatAmount: ex.vat,
        currency: "EUR",
        vendor: ex.vendor,
        category: ex.cat,
        date: ex.date,
        description: ex.desc,
        paymentMethod: ex.method,
        status: "confirmed",
        createdById: USERS.sarah,
      },
    });
  }

  // One expense with full AI line items so the "Push to Stock" flow is demoable
  await prisma.expense.create({
    data: {
      businessId: BIZ,
      amount: 876.00,
      vatAmount: 164.83,
      currency: "EUR",
      vendor: "Diageo Ireland",
      category: "beverages",
      date: days(-2),
      description: "Keg & spirits delivery — see line items",
      paymentMethod: "invoice",
      status: "confirmed",
      createdById: USERS.tony,
      aiRawText: "DIAGEO IRELAND LTD\nInvoice DIA-INV-2925\nDate: " + days(-2).toLocaleDateString("en-IE") + "\n\nGuinness Draught Keg 50L x2 @ €165.00 = €330.00\nHeineken Keg 50L x1 @ €145.00 = €145.00\nJameson Irish Whiskey 70cl x12 @ €22.00 = €264.00\nTanqueray Gin 70cl x6 @ €19.50 = €117.00\n\nSubtotal: €856.00\nVAT 23%: €164.83\nTotal: €876.00",
      aiLineItems: [
        { name: "Guinness Draught Keg 50L", quantity: 2,  unit: "keg",    unitPrice: 165.00 },
        { name: "Heineken Keg 50L",         quantity: 1,  unit: "keg",    unitPrice: 145.00 },
        { name: "Jameson Irish Whiskey 70cl", quantity: 12, unit: "bottle", unitPrice: 22.00 },
        { name: "Tanqueray Gin 70cl",        quantity: 6,  unit: "bottle", unitPrice: 19.50 },
      ],
    },
  });
  console.log("✅ Expenses created");

  // ── 10. Menu Specials ───────────────────────────────────────────────────────
  await prisma.menuSpecial.deleteMany({ where: { businessId: BIZ } });

  const menuDefs = [
    { title: "🐟 Fresh Catch of the Day",  desc: "Pan-seared sea bass with lemon butter, samphire & new potatoes. Market price. Ask your server for today's catch.", cat: "special",      dayOff: 0,  pinned: true },
    { title: "🥩 Weekend Carvery Special", desc: "Traditional roast beef or pork with all the trimmings. €14.95 per person. Served 12–4pm Sat & Sun only.", cat: "special",      dayOff: 0,  pinned: true },
    { title: "⚠️ 86'd — Chicken Tikka",   desc: "Chicken tikka masala is OFF the menu today. Supply issue — substitute with lamb rogan josh available.", cat: "86'd",         dayOff: 0,  pinned: false },
    { title: "🍺 New on Tap — Whiplash",   desc: "Whiplash Body & Soul Pale Ale now on draught. €7 a pint. Supporting Irish craft. Try before it runs out!", cat: "announcement", dayOff: -1, pinned: true },
    { title: "🌿 New Vegan Menu Launch",   desc: "Our updated vegan menu is now live — 6 mains, 4 starters. All dishes marked on menu with a leaf icon.", cat: "change",       dayOff: -2, pinned: false },
    { title: "💰 Happy Hour Extended",     desc: "Happy hour now runs 5–7pm Monday to Thursday. 2-for-1 on house cocktails and €1 off all pints.", cat: "announcement", dayOff: -3, pinned: false },
    { title: "🥗 Lunch Deal This Week",    desc: "Any main + soft drink + dessert for €15. Mon–Fri 12–3pm only. Chef's soup changes daily.", cat: "special",      dayOff: -4, pinned: false },
    { title: "🍷 New Wine List",           desc: "Updated wine list from September — 8 new labels from France, Italy & New Zealand. Ask Fiona for recommendations.", cat: "change",       dayOff: -5, pinned: false },
    { title: "📋 Allergy Menu Update",     desc: "IMPORTANT: All staff must read updated allergen sheet before Saturday service. See Marco for briefing.", cat: "announcement", dayOff: 1,  pinned: true },
    { title: "🎉 Bank Holiday Sunday",     desc: "We're OPEN on the bank holiday Sunday. Full menu, full bar. Doors open 12pm. Additional staff rostered.", cat: "announcement", dayOff: 2,  pinned: false },
  ];

  for (const m of menuDefs) {
    const d_ = days(m.dayOff, 8);
    await prisma.menuSpecial.create({
      data: {
        businessId: BIZ,
        createdById: USERS.marco,
        title: m.title,
        description: m.desc,
        category: m.cat,
        date: d_,
        pinned: m.pinned,
        archived: false,
      },
    });
  }
  console.log("✅ Menu specials created");

  // ── 11. Time-Off Requests ───────────────────────────────────────────────────
  await prisma.timeOffRequest.deleteMany({ where: { employee: { businessId: BIZ } } });

  await prisma.timeOffRequest.createMany({
    data: [
      { employeeId: EMPS.tommy,   startDate: days(7),  endDate: days(9),  status: "pending",  reason: "Family holiday to Lanzarote" },
      { employeeId: EMPS.caitlin, startDate: days(14), endDate: days(14), status: "pending",  reason: "Doctor appointment - dental" },
      { employeeId: EMPS.roisin,  startDate: days(5),  endDate: days(6),  status: "approved", reason: "Family event", managedById: USERS.sarah },
      { employeeId: EMPS.declan,  startDate: days(12), endDate: days(16), status: "approved", reason: "Booked holiday — France", managedById: USERS.tony },
      { employeeId: EMPS.aoife,   startDate: days(-5), endDate: days(-3), status: "approved", reason: "Sick leave — flu",         managedById: USERS.sarah },
      { employeeId: EMPS.liam,    startDate: days(21), endDate: days(25), status: "pending",  reason: "Summer holiday — Spain" },
      { employeeId: EMPS.marco,   startDate: days(-7), endDate: days(-7), status: "approved", reason: "HACCP recertification course", managedById: USERS.sarah },
      { employeeId: EMPS.fiona,   startDate: days(3),  endDate: days(3),  status: "rejected", reason: "Weekend off request (short notice)", managedById: USERS.tony },
    ],
  });
  console.log("✅ Time-off requests created");

  // ── 12. Clock Events ────────────────────────────────────────────────────────
  await prisma.clockEvent.deleteMany({ where: { businessId: BIZ } });

  // Realistic clock in/out events for the past 2 days
  const clockDefs = [
    // Yesterday
    { empId: EMPS.marco,   type: "in",  h: 8,  m: 3,  offset: -1 },
    { empId: EMPS.marco,   type: "out", h: 19, m: 5,  offset: -1 },
    { empId: EMPS.caitlin, type: "in",  h: 9,  m: 1,  offset: -1 },
    { empId: EMPS.caitlin, type: "out", h: 17, m: 2,  offset: -1 },
    { empId: EMPS.fiona,   type: "in",  h: 14, m: 8,  offset: -1 },
    { empId: EMPS.fiona,   type: "out", h: 23, m: 0,  offset: -1 },
    { empId: EMPS.tommy,   type: "in",  h: 15, m: 2,  offset: -1 },
    { empId: EMPS.tommy,   type: "out", h: 23, m: 7,  offset: -1 },
    { empId: EMPS.aoife,   type: "in",  h: 12, m: 4,  offset: -1 },
    { empId: EMPS.aoife,   type: "out", h: 20, m: 1,  offset: -1 },
    { empId: EMPS.liam,    type: "in",  h: 17, m: 15, offset: -1 }, // 15 min late
    { empId: EMPS.liam,    type: "out", h: 23, m: 2,  offset: -1 },
    // Today (morning only — still in service)
    { empId: EMPS.marco,   type: "in",  h: 8,  m: 2,  offset: 0 },
    { empId: EMPS.sarah,   type: "in",  h: 9,  m: 5,  offset: 0 },
    { empId: EMPS.caitlin, type: "in",  h: 9,  m: 10, offset: 0 },
    { empId: EMPS.aoife,   type: "in",  h: 12, m: 0,  offset: 0 },
  ];

  for (const c of clockDefs) {
    const ts = days(c.offset, c.h, c.m);
    await prisma.clockEvent.create({
      data: {
        employeeId: c.empId,
        businessId: BIZ,
        type: c.type,
        timestamp: ts,
        latitude: 53.3498 + (Math.random() - 0.5) * 0.0005,
        longitude: -6.2603 + (Math.random() - 0.5) * 0.0005,
      },
    });
  }
  console.log("✅ Clock events created");

  // ── 13. Messages ────────────────────────────────────────────────────────────
  await prisma.message.deleteMany({ where: { businessId: BIZ } });

  const msgDefs = [
    { from: EMPS.marco,  to: EMPS.sarah,  body: "Sarah, the walk-in fridge temp alarm went off this morning. JP Maintenance sorted it. Invoice to follow.", dayOff: -1, h: 8 },
    { from: EMPS.sarah,  to: EMPS.marco,  body: "Thanks Marco. Expensed it already. Make sure all produce was still in safe temp range before service.", dayOff: -1, h: 9 },
    { from: EMPS.fiona,  to: EMPS.tony,   body: "Tony — Tommy is requesting next weekend off. We're already short on the bar Saturday. Can you advise?", dayOff: -1, h: 14 },
    { from: EMPS.tony,   to: EMPS.fiona,  body: "I'll have a look at the rota. May need to bring in Liam for the double. Leave it with me.", dayOff: -1, h: 15 },
    { from: EMPS.marco,  to: EMPS.caitlin,body: "Caitlín — please prep 20 portions of the fish dish for Friday. Big party booked in.", dayOff: 0, h: 8 },
    { from: EMPS.caitlin,to: EMPS.marco,  body: "On it chef. Any dietary requirements for the Friday group?", dayOff: 0, h: 9 },
    { from: EMPS.marco,  to: EMPS.caitlin,body: "2 vegan, 1 nut allergy. I've flagged it on the reservation too.", dayOff: 0, h: 9 },
    { from: EMPS.aoife,  to: EMPS.sarah,  body: "Hi Sarah, just a heads up — one of the bar stools near table 4 has a wobbly leg. Should be fixed before the weekend rush.", dayOff: 0, h: 12 },
    { from: EMPS.sarah,  to: EMPS.tony,   body: "Tony can you get JP Maintenance to look at the bar stool near T4 before Saturday? Aoife flagged it.", dayOff: 0, h: 12 },
    { from: EMPS.tommy,  to: EMPS.fiona,  body: "Fiona — we're running low on Whiplash. Only 2 kegs left. Should we reorder?", dayOff: 0, h: 16 },
    { from: EMPS.fiona,  to: EMPS.tommy,  body: "Good spot. I'll raise a supplier order now. Order extra for the bank holiday weekend.", dayOff: 0, h: 16 },
    { from: EMPS.roisin, to: EMPS.sarah,  body: "Sarah — can I swap my Friday shift with Aoife? She said she's okay with it.", dayOff: -2, h: 18 },
    { from: EMPS.sarah,  to: EMPS.roisin, body: "I'll check the rota and confirm. Make sure Aoife submits a swap request through the app.", dayOff: -2, h: 19 },
  ];

  for (const m of msgDefs) {
    await prisma.message.create({
      data: {
        businessId: BIZ,
        senderId: m.from,
        recipientId: m.to,
        body: m.body,
        read: m.dayOff < 0,
        createdAt: days(m.dayOff, m.h),
      },
    });
  }
  console.log("✅ Messages created");

  // ── 14. Availability Preferences ───────────────────────────────────────────
  await prisma.availabilityPreference.deleteMany({ where: { businessId: BIZ } });

  const availDefs: Array<[string, number, boolean, string?, string?]> = [
    // Tommy — not available Sundays & Mondays
    [EMPS.tommy, 0, false, undefined, undefined], // Sun
    [EMPS.tommy, 1, true,  "15:00", "23:30"],     // Mon
    [EMPS.tommy, 2, true,  "14:00", "23:30"],     // Tue
    [EMPS.tommy, 3, true,  "14:00", "23:30"],     // Wed
    [EMPS.tommy, 4, true,  "14:00", "23:30"],     // Thu
    [EMPS.tommy, 5, true,  "12:00", "23:30"],     // Fri
    [EMPS.tommy, 6, true,  "12:00", "23:30"],     // Sat
    // Roisin — part time, Mon–Fri only
    [EMPS.roisin, 0, false], [EMPS.roisin, 1, true, "12:00","20:00"],
    [EMPS.roisin, 2, true,  "12:00","20:00"], [EMPS.roisin, 3, true, "12:00","20:00"],
    [EMPS.roisin, 4, true,  "12:00","20:00"], [EMPS.roisin, 5, true, "17:00","23:00"],
    [EMPS.roisin, 6, false],
    // Caitlin — not Mon
    [EMPS.caitlin, 1, false],
    [EMPS.caitlin, 2, true, "09:00","17:00"], [EMPS.caitlin, 3, true, "09:00","17:00"],
    [EMPS.caitlin, 4, true, "09:00","17:00"], [EMPS.caitlin, 5, true, "09:00","19:00"],
    [EMPS.caitlin, 6, true, "09:00","19:00"], [EMPS.caitlin, 0, true, "09:00","17:00"],
  ];

  for (const [empId, dow, avail, from, to] of availDefs) {
    await prisma.availabilityPreference.upsert({
      where: { employeeId_dayOfWeek: { employeeId: empId, dayOfWeek: dow } },
      create: { employeeId: empId, businessId: BIZ, dayOfWeek: dow, available: avail, fromTime: from ?? null, toTime: to ?? null },
      update: { available: avail, fromTime: from ?? null, toTime: to ?? null },
    });
  }
  console.log("✅ Availability preferences created");

  // ── 15. Training & Certifications ──────────────────────────────────────────
  await prisma.trainingCertification.deleteMany({ where: { businessId: BIZ } });

  const certDefs = [
    // Marco — Head Chef, fully certified
    { emp: EMPS.marco,   title: "HACCP Level 2 — Food Safety Management",  issuer: "QQI",             cat: "HACCP",            issued: days(-365), expiry: days(365),    notes: "Annual renewal required" },
    { emp: EMPS.marco,   title: "RSA Responsible Serving of Alcohol",       issuer: "Fáilte Ireland",  cat: "ALCOHOL",          issued: days(-730), expiry: days(180),    notes: "Renewals every 3 years" },
    { emp: EMPS.marco,   title: "Manual Handling Certificate",              issuer: "HSA Ireland",     cat: "MANUAL_HANDLING",  issued: days(-200), expiry: days(1095),   notes: null },
    // Caitlín — Sous Chef
    { emp: EMPS.caitlin, title: "HACCP Level 1 — Food Hygiene Awareness",   issuer: "QQI",             cat: "HACCP",            issued: days(-180), expiry: days(185),    notes: "Due for Level 2 next" },
    { emp: EMPS.caitlin, title: "First Aid Responder",                      issuer: "Irish Red Cross", cat: "FIRST_AID",        issued: days(-400), expiry: days(25),     notes: "⚠️ Expiring soon — book renewal" },
    // Fiona — Bar Manager
    { emp: EMPS.fiona,   title: "RSA Responsible Serving of Alcohol",       issuer: "Fáilte Ireland",  cat: "ALCOHOL",          issued: days(-100), expiry: days(800),    notes: null },
    { emp: EMPS.fiona,   title: "HACCP Level 1",                            issuer: "QQI",             cat: "HACCP",            issued: days(-90),  expiry: days(275),    notes: null },
    // Tommy — Bartender
    { emp: EMPS.tommy,   title: "RSA Responsible Serving of Alcohol",       issuer: "Fáilte Ireland",  cat: "ALCOHOL",          issued: days(-500), expiry: days(-20),    notes: "⚠️ EXPIRED — must renew before next shift" },
    { emp: EMPS.tommy,   title: "Manual Handling Certificate",              issuer: "HSA Ireland",     cat: "MANUAL_HANDLING",  issued: days(-300), expiry: days(795),    notes: null },
    // Declan — Kitchen Porter
    { emp: EMPS.declan,  title: "HACCP Level 1 — Food Hygiene Awareness",   issuer: "QQI",             cat: "HACCP",            issued: days(-60),  expiry: days(305),    notes: null },
    // Aoife — Waitress
    { emp: EMPS.aoife,   title: "RSA Responsible Serving of Alcohol",       issuer: "Fáilte Ireland",  cat: "ALCOHOL",          issued: days(-250), expiry: days(115),    notes: null },
    { emp: EMPS.aoife,   title: "Food Safety Awareness",                    issuer: "QQI",             cat: "FOOD_SAFETY",      issued: days(-250), expiry: null,         notes: "No expiry — awareness level" },
    // Liam
    { emp: EMPS.liam,    title: "RSA Responsible Serving of Alcohol",       issuer: "Fáilte Ireland",  cat: "ALCOHOL",          issued: days(-150), expiry: days(900),    notes: null },
    // Sarah — GM
    { emp: EMPS.sarah,   title: "HACCP Level 3 — Management",              issuer: "QQI",             cat: "HACCP",            issued: days(-400), expiry: days(600),    notes: "Management level cert" },
    { emp: EMPS.sarah,   title: "First Aid Responder",                      issuer: "Irish Red Cross", cat: "FIRST_AID",        issued: days(-100), expiry: days(1000),   notes: null },
  ];

  for (const c of certDefs) {
    await prisma.trainingCertification.create({
      data: {
        businessId: BIZ,
        employeeId: c.emp,
        title: c.title,
        issuer: c.issuer,
        category: c.cat,
        issuedDate: c.issued,
        expiryDate: c.expiry,
        notes: c.notes,
      },
    });
  }
  console.log("✅ Training certifications created");

  // ── 16. Tip Pools ───────────────────────────────────────────────────────────
  await prisma.tipDistribution.deleteMany({ where: { pool: { businessId: BIZ } } });
  await prisma.tipPool.deleteMany({ where: { businessId: BIZ } });

  const poolId1 = "demo-tip-pool-1";
  const poolId2 = "demo-tip-pool-2";

  await prisma.tipPool.upsert({
    where: { id: poolId1 },
    create: {
      id: poolId1,
      businessId: BIZ,
      periodStart: days(-14, 0, 0),
      periodEnd: days(-8, 23, 59),
      totalAmount: 1240.00,
      method: "hours",
      status: "distributed",
      distributedAt: days(-7),
      notes: "Week of June 2–8. Strong weekend tips.",
    },
    update: {},
  });

  await prisma.tipDistribution.createMany({
    data: [
      { poolId: poolId1, employeeId: EMPS.fiona,   hoursWorked: 32, shareAmount: 221.78 },
      { poolId: poolId1, employeeId: EMPS.tommy,   hoursWorked: 40, shareAmount: 277.23 },
      { poolId: poolId1, employeeId: EMPS.liam,    hoursWorked: 36, shareAmount: 249.50 },
      { poolId: poolId1, employeeId: EMPS.aoife,   hoursWorked: 28, shareAmount: 193.98 },
      { poolId: poolId1, employeeId: EMPS.roisin,  hoursWorked: 24, shareAmount: 166.27 },
      { poolId: poolId1, employeeId: EMPS.declan,  hoursWorked: 19, shareAmount: 131.24 },
    ],
  });

  // Current week — draft pool
  await prisma.tipPool.upsert({
    where: { id: poolId2 },
    create: {
      id: poolId2,
      businessId: BIZ,
      periodStart: monday(0),
      periodEnd: days(6, 23, 59),
      totalAmount: 680.00,
      method: "hours",
      status: "draft",
      notes: "Current week — in progress. Update total at end of week.",
    },
    update: {},
  });

  await prisma.tipDistribution.createMany({
    data: [
      { poolId: poolId2, employeeId: EMPS.fiona,  hoursWorked: 20, shareAmount: 146.67 },
      { poolId: poolId2, employeeId: EMPS.tommy,  hoursWorked: 22, shareAmount: 161.33 },
      { poolId: poolId2, employeeId: EMPS.liam,   hoursWorked: 18, shareAmount: 132.00 },
      { poolId: poolId2, employeeId: EMPS.aoife,  hoursWorked: 16, shareAmount: 117.33 },
      { poolId: poolId2, employeeId: EMPS.roisin, hoursWorked: 16, shareAmount: 117.33 },
      { poolId: poolId2, employeeId: EMPS.declan, hoursWorked: 7,  shareAmount: 51.33  },
    ],
  });
  console.log("✅ Tip pools created");

  // ── 17. AI Settings ─────────────────────────────────────────────────────────
  await prisma.aISettings.upsert({
    where: { businessId: BIZ },
    create: {
      businessId: BIZ,
      bookingThresholdForStaffIncrease: 20,
      kitchenRatio: 20,
      floorRatio: 15,
      minBarStaff: 2,
      rotaWarningDaysAhead: 3,
      autoFlagShortStaffedShifts: true,
      minStaffPerShift: 2,
      priceChangeNotifyScope: "all_staff",
      priceChangeMessage: "Please note menu price/item updates. See the specials board for details.",
    },
    update: {},
  });
  console.log("✅ AI settings created");

  // ── 18. Shift Templates ─────────────────────────────────────────────────────
  await prisma.shiftTemplate.deleteMany({ where: { businessId: BIZ } });

  const templateDefs = [
    // "Standard Week" template
    { emp: EMPS.marco,   dow: 1, sh: 8,  eh: 19, role: "Head Chef",      name: "Standard Week" },
    { emp: EMPS.marco,   dow: 2, sh: 8,  eh: 19, role: "Head Chef",      name: "Standard Week" },
    { emp: EMPS.marco,   dow: 5, sh: 8,  eh: 19, role: "Head Chef",      name: "Standard Week" },
    { emp: EMPS.marco,   dow: 6, sh: 8,  eh: 19, role: "Head Chef",      name: "Standard Week" },
    { emp: EMPS.fiona,   dow: 1, sh: 14, eh: 23, role: "Bar Manager",    name: "Standard Week" },
    { emp: EMPS.fiona,   dow: 3, sh: 12, eh: 22, role: "Bar Manager",    name: "Standard Week" },
    { emp: EMPS.fiona,   dow: 5, sh: 15, eh: 23, role: "Bar Manager",    name: "Standard Week" },
    { emp: EMPS.fiona,   dow: 6, sh: 12, eh: 23, role: "Bar Manager",    name: "Standard Week" },
    { emp: EMPS.tommy,   dow: 2, sh: 15, eh: 23, role: "Bartender",      name: "Standard Week" },
    { emp: EMPS.tommy,   dow: 4, sh: 15, eh: 23, role: "Bartender",      name: "Standard Week" },
    { emp: EMPS.tommy,   dow: 5, sh: 12, eh: 22, role: "Bartender",      name: "Standard Week" },
    { emp: EMPS.tommy,   dow: 6, sh: 12, eh: 22, role: "Bartender",      name: "Standard Week" },
    { emp: EMPS.caitlin, dow: 1, sh: 9,  eh: 17, role: "Sous Chef",      name: "Standard Week" },
    { emp: EMPS.caitlin, dow: 3, sh: 9,  eh: 17, role: "Sous Chef",      name: "Standard Week" },
    { emp: EMPS.caitlin, dow: 5, sh: 9,  eh: 19, role: "Sous Chef",      name: "Standard Week" },
    { emp: EMPS.caitlin, dow: 6, sh: 9,  eh: 19, role: "Sous Chef",      name: "Standard Week" },
    { emp: EMPS.aoife,   dow: 1, sh: 12, eh: 20, role: "Waitress",       name: "Standard Week" },
    { emp: EMPS.aoife,   dow: 3, sh: 12, eh: 20, role: "Waitress",       name: "Standard Week" },
    { emp: EMPS.aoife,   dow: 5, sh: 17, eh: 23, role: "Waitress",       name: "Standard Week" },
    { emp: EMPS.aoife,   dow: 6, sh: 12, eh: 22, role: "Waitress",       name: "Standard Week" },
  ];

  for (const t of templateDefs) {
    await prisma.shiftTemplate.create({
      data: {
        businessId: BIZ,
        venueId: VENUE,
        employeeId: t.emp,
        dayOfWeek: t.dow,
        startHour: t.sh,
        startMinute: 0,
        endHour: t.eh,
        endMinute: 0,
        role: t.role,
        templateName: t.name,
        active: true,
      },
    });
  }
  console.log("✅ Shift templates created");

  // ── 19. Suppliers & Stock ────────────────────────────────────────────────────
  await prisma.orderItem.deleteMany({ where: { order: { businessId: BIZ } } });
  await prisma.supplierOrder.deleteMany({ where: { businessId: BIZ } });
  await prisma.stockItem.deleteMany({ where: { businessId: BIZ } });
  await prisma.supplier.deleteMany({ where: { businessId: BIZ } });

  const sup1 = "demo-sup-musgrave";
  const sup2 = "demo-sup-diageo";
  const sup3 = "demo-sup-pallas";

  await prisma.supplier.createMany({
    data: [
      { id: sup1, businessId: BIZ, name: "Musgrave MarketPlace", contactName: "Declan Foley",  email: "dcfoley@musgrave.ie",    phone: "01 456 7890", active: true },
      { id: sup2, businessId: BIZ, name: "Diageo Ireland",       contactName: "Karen Nolan",   email: "k.nolan@diageo.com",     phone: "01 234 5678", active: true },
      { id: sup3, businessId: BIZ, name: "Pallas Foods",         contactName: "Brian Treacy",  email: "btreacy@pallasfoods.ie", phone: "052 612 3456", active: true },
    ],
  });

  const si1 = "demo-stock-guinness";
  const si2 = "demo-stock-heineken";
  const si3 = "demo-stock-beef";
  const si4 = "demo-stock-chicken";
  const si5 = "demo-stock-salmon";
  const si6 = "demo-stock-chips";

  await prisma.stockItem.createMany({
    data: [
      { id: si1, businessId: BIZ, supplierId: sup2, name: "Guinness Keg 50L",  sku: "DIA-GNS-50", unit: "keg",    category: "beverage",  lastPrice: 165.00, reorderLevel: 3, currentStock: 4 },
      { id: si2, businessId: BIZ, supplierId: sup2, name: "Heineken Keg 50L",  sku: "DIA-HNK-50", unit: "keg",    category: "beverage",  lastPrice: 145.00, reorderLevel: 2, currentStock: 2 },
      { id: si3, businessId: BIZ, supplierId: sup1, name: "Ribeye Beef (5kg)", sku: "MUS-BEEF-5", unit: "pack",   category: "food",      lastPrice: 98.00,  reorderLevel: 2, currentStock: 3 },
      { id: si4, businessId: BIZ, supplierId: sup1, name: "Chicken Breast (5kg)", sku: "MUS-CHK-5", unit: "pack", category: "food",      lastPrice: 42.00,  reorderLevel: 2, currentStock: 5 },
      { id: si5, businessId: BIZ, supplierId: sup3, name: "Atlantic Salmon (whole, 3kg)", sku: "PAL-SALM-3", unit: "unit", category: "food", lastPrice: 35.00, reorderLevel: 3, currentStock: 1 },
      { id: si6, businessId: BIZ, supplierId: sup1, name: "Frozen Chips 10kg", sku: "MUS-CHIP-10", unit: "bag",  category: "food",      lastPrice: 22.00,  reorderLevel: 4, currentStock: 6 },
    ],
  });
  console.log("✅ Suppliers & stock created");

  // ── 20. Dishes / Recipes ────────────────────────────────────────────────────
  await prisma.dishIngredient.deleteMany({ where: { dish: { businessId: BIZ } } });
  await prisma.dish.deleteMany({ where: { businessId: BIZ } });

  const dish1 = "demo-dish-ribeye";
  const dish2 = "demo-dish-salmon";
  const dish3 = "demo-dish-chicken";
  const dish4 = "demo-dish-chips";
  const dish5 = "demo-dish-guinness-stew";
  const dish6 = "demo-dish-house-burger";

  await prisma.dish.createMany({
    data: [
      { id: dish1, businessId: BIZ, name: "Ribeye Steak (10oz)", description: "Aged ribeye served with chips, seasonal veg & peppercorn sauce", category: "main", sellPrice: 28.50, active: true },
      { id: dish2, businessId: BIZ, name: "Pan-Fried Atlantic Salmon", description: "Fresh Atlantic salmon, crushed new potatoes, dill cream sauce", category: "main", sellPrice: 24.00, active: true },
      { id: dish3, businessId: BIZ, name: "Buttermilk Chicken & Chips", description: "Marinated buttermilk chicken breast, chunky chips, house slaw", category: "main", sellPrice: 18.50, active: true },
      { id: dish4, businessId: BIZ, name: "Chunky Chips", description: "Hand-cut chunky chips with sea salt & house aioli", category: "sides", sellPrice: 5.00, active: true },
      { id: dish5, businessId: BIZ, name: "Guinness & Beef Stew", description: "Slow-braised beef in Guinness, champ mash, soda bread", category: "main", sellPrice: 21.00, active: true },
      { id: dish6, businessId: BIZ, name: "Anchor House Burger", description: "6oz beef patty, smoked cheddar, bacon jam, brioche bun, fries", category: "main", sellPrice: 17.50, active: true },
    ],
  });

  await prisma.dishIngredient.createMany({
    data: [
      // Ribeye
      { dishId: dish1, stockItemId: si3, name: "Ribeye Beef",   qty: 0.3,  unit: "kg" },
      { dishId: dish1, stockItemId: si6, name: "Frozen Chips",  qty: 0.2,  unit: "kg" },
      { dishId: dish1, stockItemId: null, name: "Peppercorn Sauce", qty: 1, unit: "portion" },
      // Salmon
      { dishId: dish2, stockItemId: si5, name: "Atlantic Salmon", qty: 0.2, unit: "kg" },
      { dishId: dish2, stockItemId: null, name: "New Potatoes", qty: 0.15, unit: "kg" },
      { dishId: dish2, stockItemId: null, name: "Dill Cream",   qty: 1,    unit: "portion" },
      // Chicken
      { dishId: dish3, stockItemId: si4, name: "Chicken Breast", qty: 0.2, unit: "kg" },
      { dishId: dish3, stockItemId: si6, name: "Frozen Chips",  qty: 0.2,  unit: "kg" },
      // Chips side
      { dishId: dish4, stockItemId: si6, name: "Frozen Chips",  qty: 0.2,  unit: "kg" },
      // Guinness Stew
      { dishId: dish5, stockItemId: si3, name: "Ribeye Beef",   qty: 0.2,  unit: "kg" },
      { dishId: dish5, stockItemId: si1, name: "Guinness",      qty: 0.5,  unit: "litre" },
      // Burger
      { dishId: dish6, stockItemId: si3, name: "Beef Mince",    qty: 0.18, unit: "kg" },
      { dishId: dish6, stockItemId: si6, name: "Frozen Chips",  qty: 0.15, unit: "kg" },
    ],
  });
  console.log("✅ Dishes / recipes created");

  // ── 21. Wastage Records ─────────────────────────────────────────────────────
  await prisma.wastageRecord.deleteMany({ where: { businessId: BIZ } });

  await prisma.wastageRecord.createMany({
    data: [
      { businessId: BIZ, stockItemId: si5, itemName: "Atlantic Salmon (whole, 3kg)", quantity: 1,    unit: "unit",   unitCost: 35.00, totalCost: 35.00, reason: "expiry",    notes: "Missed Friday order window — past use-by",    recordedBy: USERS.marco, date: days(-2)  },
      { businessId: BIZ, stockItemId: si3, itemName: "Ribeye Beef (5kg)",            quantity: 0.5,  unit: "kg",     unitCost: 19.60, totalCost: 9.80,  reason: "spoilage",  notes: "Freezer door left open overnight",            recordedBy: USERS.marco, date: days(-4)  },
      { businessId: BIZ, stockItemId: si6, itemName: "Frozen Chips 10kg",            quantity: 2,    unit: "kg",     unitCost: 2.20,  totalCost: 4.40,  reason: "over-prep", notes: "Overcooked batch during Saturday rush",       recordedBy: USERS.caitlin, date: days(-6) },
      { businessId: BIZ, stockItemId: si2, itemName: "Heineken Keg 50L",             quantity: 0.25, unit: "keg",    unitCost: 145.00,totalCost: 36.25, reason: "spill",     notes: "Keg connector failure — partial loss",        recordedBy: USERS.fiona, date: days(-7)  },
      { businessId: BIZ, stockItemId: si4, itemName: "Chicken Breast (5kg)",         quantity: 0.3,  unit: "kg",     unitCost: 8.40,  totalCost: 2.52,  reason: "expiry",    notes: "Small batch past use-by",                     recordedBy: USERS.marco, date: days(-10) },
      { businessId: BIZ, stockItemId: si5, itemName: "Atlantic Salmon (whole, 3kg)", quantity: 0.5,  unit: "unit",   unitCost: 35.00, totalCost: 17.50, reason: "over-prep", notes: "Special removed from menu mid-service",       recordedBy: USERS.marco, date: days(-14) },
      { businessId: BIZ, stockItemId: null, itemName: "House Red Wine",              quantity: 1,    unit: "bottle", unitCost: 9.50,  totalCost: 9.50,  reason: "spill",     notes: "Dropped by floor staff — floor incident",     recordedBy: USERS.sarah, date: days(-15) },
    ],
  });
  console.log("✅ Wastage records created");

  // ── 22. CRM — Customers ─────────────────────────────────────────────────────
  await prisma.crmEmail.deleteMany({ where: { customer: { businessId: BIZ } } });
  await prisma.crmNote.deleteMany({ where: { customer: { businessId: BIZ } } });
  await prisma.customer.deleteMany({ where: { businessId: BIZ } });

  const cust1 = "demo-cust-niamh";
  const cust2 = "demo-cust-patrick";
  const cust3 = "demo-cust-siobhan";
  const cust4 = "demo-cust-colm";
  const cust5 = "demo-cust-helen";

  await prisma.customer.createMany({
    data: [
      { id: cust1, businessId: BIZ, name: "Niamh Gallagher", email: "niamh.gallagher@email.ie", phone: "087 123 4567", tags: ["regular", "vip"], internalNotes: "Always books window table. Wine lover — prefers French reds.", gdprConsent: true, gdprConsentAt: days(-90) },
      { id: cust2, businessId: BIZ, name: "Patrick Doyle",   email: "pdoyle@gmail.com",          phone: "086 234 5678", tags: ["regular"],        internalNotes: "Comes every Friday evening. Large group bookings.", gdprConsent: true, gdprConsentAt: days(-120) },
      { id: cust3, businessId: BIZ, name: "Siobhán Ó'Brien", email: "siobhan.ob@outlook.com",    phone: "085 345 6789", tags: ["allergy"],         internalNotes: "Nut allergy — SEVERE. Always confirm with kitchen.", allergies: "Tree nuts, peanuts", gdprConsent: true, gdprConsentAt: days(-60) },
      { id: cust4, businessId: BIZ, name: "Colm Farrell",    email: "cfarrell@live.ie",           phone: "083 456 7890", tags: ["corporate"],      internalNotes: "Books for business dinners. Needs VAT receipts.", gdprConsent: true, gdprConsentAt: days(-45) },
      { id: cust5, businessId: BIZ, name: "Helen Murphy",    email: "hmurphy@gmail.com",          phone: "087 567 8901", tags: ["birthday-club"],  internalNotes: "Birthday in March. Champagne on arrival — past arrangement.", gdprConsent: true, gdprConsentAt: days(-180), birthday: new Date("1985-03-14") },
    ],
  });

  await prisma.crmNote.createMany({
    data: [
      { customerId: cust1, authorId: USERS.sarah, note: "Called ahead for anniversary dinner on Sat. Requested candles and dessert with message. Confirmed.",               createdAt: days(-3) },
      { customerId: cust1, authorId: USERS.tony,  note: "Left great Google review after last visit. Mentioned Marco's salmon. Follow up with loyalty card offer.",         createdAt: days(-14) },
      { customerId: cust2, authorId: USERS.sarah, note: "Group of 14 confirmed for Friday. Needs pre-set menu. Chase deposit by Wed.",                                    createdAt: days(-1) },
      { customerId: cust3, authorId: USERS.tony,  note: "Allergy flagged again on last visit. Staff handled correctly. Reminded kitchen to double-check cross-contamination.", createdAt: days(-7) },
      { customerId: cust4, authorId: USERS.sarah, note: "Corp booking for 8 on Tuesday. Needs a VAT invoice sent after. Remind Fiona to print.",                         createdAt: days(-2) },
      { customerId: cust5, authorId: USERS.tony,  note: "Birthday dinner in March was a hit. She posted on Instagram. Consider reaching out in Feb for this year.",       createdAt: days(-90) },
    ],
  });
  console.log("✅ CRM customers + notes created");

  // ── 23. Shift Swap Requests ─────────────────────────────────────────────────
  await prisma.shiftSwapRequest.deleteMany({ where: { businessId: BIZ } });

  // Get some current-week shift IDs to reference
  const weekStart = monday(0);
  const weekEnd   = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 7);
  const currentShifts = await prisma.shift.findMany({
    where: { venueId: VENUE, startTime: { gte: weekStart, lt: weekEnd } },
    select: { id: true, employeeId: true },
    take: 10,
  });

  if (currentShifts.length >= 4) {
    const tommyShift  = currentShifts.find(s => s.employeeId === EMPS.tommy);
    const liamShift   = currentShifts.find(s => s.employeeId === EMPS.liam);
    const aoifeShift  = currentShifts.find(s => s.employeeId === EMPS.aoife);
    const roisinShift = currentShifts.find(s => s.employeeId === EMPS.roisin);

    if (tommyShift && liamShift) {
      // Open swap — Tommy looking for cover
      await prisma.shiftSwapRequest.create({
        data: {
          businessId: BIZ,
          offererId: EMPS.tommy,
          offeredShiftId: tommyShift.id,
          status: "open",
        },
      });
    }

    if (aoifeShift && roisinShift) {
      // Pending — Aoife & Róisín agreed, waiting manager sign-off
      await prisma.shiftSwapRequest.create({
        data: {
          businessId: BIZ,
          offererId: EMPS.aoife,
          offeredShiftId: aoifeShift.id,
          receiverId: EMPS.roisin,
          receiverShiftId: roisinShift.id,
          status: "pending",
        },
      });
    }
  }
  console.log("✅ Shift swap requests created");

  // ── 24. Employee Documents & Onboarding Tasks ───────────────────────────────
  await prisma.onboardingTask.deleteMany({ where: { businessId: BIZ } });

  // Declan is newest — has onboarding tasks in progress
  await prisma.onboardingTask.createMany({
    data: [
      { businessId: BIZ, employeeId: EMPS.declan, title: "Sign employment contract",            description: "Wet signature required — HR file copy.",          completed: true,  completedAt: days(-25), sortOrder: 1, dueDate: days(-28) },
      { businessId: BIZ, employeeId: EMPS.declan, title: "Submit P45 / Tax credits cert",       description: "Revenue myAccount or HR to request direct.",       completed: true,  completedAt: days(-22), sortOrder: 2, dueDate: days(-25) },
      { businessId: BIZ, employeeId: EMPS.declan, title: "HACCP Level 1 training",              description: "Book QQI Level 1 course — mandatory before solo kitchen shift.", completed: false, dueDate: days(7), sortOrder: 3 },
      { businessId: BIZ, employeeId: EMPS.declan, title: "Manual handling induction",           description: "Complete in-house manual handling session with Marco.", completed: false, dueDate: days(3), sortOrder: 4 },
      { businessId: BIZ, employeeId: EMPS.declan, title: "Staff handbook acknowledgement",      description: "Sign and return acknowledgement page to management.", completed: true, completedAt: days(-20), sortOrder: 5, dueDate: days(-21) },
      // Liam — recent hire
      { businessId: BIZ, employeeId: EMPS.liam, title: "Sign employment contract",              description: null,                                                completed: true,  completedAt: days(-40), sortOrder: 1, dueDate: days(-42) },
      { businessId: BIZ, employeeId: EMPS.liam, title: "RSA Responsible Serving of Alcohol",    description: "Book next available course if not already certified.", completed: true, completedAt: days(-38), sortOrder: 2, dueDate: days(-40) },
      { businessId: BIZ, employeeId: EMPS.liam, title: "ID verification (Right to Work)",       description: "Passport / GNIB card photocopied + HR file.",         completed: true, completedAt: days(-39), sortOrder: 3, dueDate: days(-41) },
      { businessId: BIZ, employeeId: EMPS.liam, title: "Bar induction with Fiona",              description: "Shadow Fiona for first 2 shifts.",                  completed: false, dueDate: days(-5), sortOrder: 4 },
    ],
  });
  console.log("✅ Onboarding tasks created");

  // ── 25. Supplier Statements ─────────────────────────────────────────────────
  await prisma.supplierStatement.deleteMany({ where: { businessId: BIZ } });

  await prisma.supplierStatement.createMany({
    data: [
      {
        businessId: BIZ,
        supplierId: sup1,
        fileUrl: "https://placehold.co/600x800/f8f9fa/6c757d?text=Musgrave+Statement",
        fileName: "musgrave-statement-june-2025.pdf",
        totalAmount: 3240.50,
        invoiceRef: "MUS-STMT-2025-06",
        status: "accepted",
      },
      {
        businessId: BIZ,
        supplierId: sup2,
        fileUrl: "https://placehold.co/600x800/f8f9fa/6c757d?text=Diageo+Statement",
        fileName: "diageo-statement-june-2025.pdf",
        totalAmount: 2436.00,
        invoiceRef: "DIA-STMT-2025-06",
        status: "pending",
      },
    ],
  });
  console.log("✅ Supplier statements created");

  console.log("\n✅ Demo seed complete!");
  console.log("\n📋 Demo Login Accounts:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("MANAGER (General Manager)   sarah.connolly@rotahr.demo  / Demo1234!");
  console.log("MANAGER (Operations)         tony.brennan@rotahr.demo    / Demo1234!");
  console.log("EMPLOYEE (Head Chef)         marco.deluca@rotahr.demo    / Demo1234!");
  console.log("EMPLOYEE (Bar Manager)       fiona.mccarthy@rotahr.demo  / Demo1234!");
  console.log("EMPLOYEE (Bartender)         tommy.ryan@rotahr.demo      / Demo1234!");
  console.log("EMPLOYEE (Sous Chef)         caitlin.kelly@rotahr.demo   / Demo1234!");
  console.log("EMPLOYEE (Kitchen Porter)    declan.walsh@rotahr.demo    / Demo1234!");
  console.log("EMPLOYEE (Waitress)          aoife.byrne@rotahr.demo     / Demo1234!");
  console.log("EMPLOYEE (Bartender)         liam.murphy@rotahr.demo     / Demo1234!");
  console.log("EMPLOYEE (Floor Staff)       roisin.malone@rotahr.demo   / Demo1234!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Password for all: Demo1234!");
}

// ─── Owner Demo Accounts — Starter / Pro / Enterprise ─────────────────────────
/**
 * Seeds 3 separate owner-perspective businesses so prospects can feel the difference
 * between plan tiers from a business owner's point of view.
 *
 * Accounts:
 *  STARTER   — owner.starter@rotahr.demo   / Demo1234!  (The Corner Café, 4 staff)
 *  PRO       — owner.pro@rotahr.demo       / Demo1234!  (Bloom Bistro, 18 staff)
 *  ENTERPRISE — owner.enterprise@rotahr.demo / Demo1234! (Harrington Group, 3 venues)
 */
async function seedOwnerDemos(prisma: PrismaClient) {
  console.log("🌱 Seeding owner demo businesses...");
  const pw = await hash(PW);

  // ── STARTER ─────────────────────────────────────────────────────────────────
  const S_BIZ   = "demo-owner-starter-biz";
  const S_VENUE = "demo-owner-starter-venue";
  const S_USER  = "demo-owner-starter-user";

  await prisma.business.upsert({
    where: { id: S_BIZ },
    create: {
      id: S_BIZ,
      name: "The Corner Café",
      onboardingComplete: true,
      geoLat: 53.3401,
      geoLng: -6.2611,
      geoRadius: 100,
      weeklyRevenueTarget: 6000,
      lsPlan: "starter",
      lsStatus: "active",
    },
    update: { lsPlan: "starter", lsStatus: "active" },
  });

  await prisma.venue.upsert({
    where: { id: S_VENUE },
    create: {
      id: S_VENUE,
      businessId: S_BIZ,
      name: "The Corner Café — Main",
      address: "2 Camden Row, Dublin 2, D02 HW91",
      geoLat: 53.3401, geoLng: -6.2611, geoRadius: 100,
      timezone: "Europe/Dublin",
      isDefault: true, active: true,
    },
    update: {},
  });

  await prisma.user.upsert({
    where: { id: S_USER },
    create: { id: S_USER, email: "owner.starter@rotahr.demo", name: "Ciara Doyle", role: "ADMIN", businessId: S_BIZ, password: pw },
    update: { name: "Ciara Doyle", role: "ADMIN", businessId: S_BIZ, password: pw },
  });

  // 3 staff employees for Starter demo
  const starterStaff = [
    { id: "demo-s-emp-1", email: "kate.ryan@cornercafe.demo",   first: "Kate",  last: "Ryan",    role: "barista",  rate: 14.5 },
    { id: "demo-s-emp-2", email: "dan.kearns@cornercafe.demo",  first: "Dan",   last: "Kearns",  role: "barista",  rate: 14.0 },
    { id: "demo-s-emp-3", email: "emma.ward@cornercafe.demo",   first: "Emma",  last: "Ward",    role: "floor staff", rate: 13.5 },
  ];
  for (const e of starterStaff) {
    // ensure user exists
    await prisma.user.upsert({
      where: { id: `${e.id}-user` },
      create: { id: `${e.id}-user`, email: e.email, name: `${e.first} ${e.last}`, role: "EMPLOYEE", businessId: S_BIZ, password: pw },
      update: { businessId: S_BIZ, password: pw },
    });
    await prisma.employee.upsert({
      where: { id: e.id },
      create: {
        id: e.id, businessId: S_BIZ, venueId: S_VENUE, userId: `${e.id}-user`,
        firstName: e.first, lastName: e.last, email: e.email,
        role: e.role, hourlyRate: e.rate, active: true, permissions: [],
        phone: `+353 87${Math.floor(1000000 + Math.random() * 8999999)}`,
      },
      update: { role: e.role, hourlyRate: e.rate },
    });
  }

  // A few shifts for current week
  await prisma.shift.deleteMany({ where: { venueId: S_VENUE } });
  const sShifts: Array<[string, number, number, number, string, boolean]> = [
    ["demo-s-emp-1", 1, 7, 15, "Barista", true],
    ["demo-s-emp-1", 3, 7, 15, "Barista", true],
    ["demo-s-emp-1", 5, 7, 15, "Barista", true],
    ["demo-s-emp-2", 2, 7, 15, "Barista", true],
    ["demo-s-emp-2", 4, 7, 15, "Barista", true],
    ["demo-s-emp-2", 6, 8, 14, "Barista", true],
    ["demo-s-emp-3", 1, 9, 17, "Floor", true],
    ["demo-s-emp-3", 2, 9, 17, "Floor", true],
    ["demo-s-emp-3", 4, 9, 17, "Floor", true],
    ["demo-s-emp-3", 6, 9, 15, "Floor", true],
  ];
  for (const [empId, dow, sh, eh, role, pub] of sShifts) {
    const start = shiftDate(0, dow, sh);
    const end   = shiftDate(0, dow, eh);
    await prisma.shift.create({ data: { employeeId: empId, venueId: S_VENUE, date: new Date(start.getFullYear(), start.getMonth(), start.getDate()), startTime: start, endTime: end, role, published: pub } });
  }

  // A handful of expenses
  await prisma.expense.deleteMany({ where: { businessId: S_BIZ } });
  const sExpenses = [
    { amt: 340.00, vat: 63.93, vendor: "Henderson Foodservice", cat: "food_supplies", desc: "Weekly coffee & bakery supplies", method: "invoice" },
    { amt: 180.00, vat: 33.83, vendor: "Bewley's Wholesale",    cat: "beverages",     desc: "Coffee beans & syrups",          method: "card"    },
    { amt: 95.00,  vat: 0,     vendor: "Electric Ireland",      cat: "utilities",     desc: "Monthly electricity",            method: "direct_debit" },
    { amt: 650.00, vat: 0,     vendor: "Landlord",              cat: "rent",          desc: "Monthly rent",                   method: "bank_transfer" },
  ];
  for (let i = 0; i < sExpenses.length; i++) {
    const ex = sExpenses[i];
    await prisma.expense.create({ data: { businessId: S_BIZ, amount: ex.amt, vatAmount: ex.vat, currency: "EUR", vendor: ex.vendor, category: ex.cat, date: days(-i - 1), description: ex.desc, paymentMethod: ex.method, status: "confirmed", createdById: S_USER } });
  }

  // A few upcoming reservations
  await prisma.reservation.deleteMany({ where: { businessId: S_BIZ } });
  const sRes = [
    { name: "Brennan x2", size: 2, dayOff: 1, time: "10:00", status: "confirmed" },
    { name: "Walsh Party x4", size: 4, dayOff: 2, time: "12:00", status: "confirmed" },
    { name: "O'Brien x3", size: 3, dayOff: 3, time: "11:00", status: "confirmed" },
  ];
  for (const r of sRes) {
    await prisma.reservation.create({ data: { businessId: S_BIZ, customerName: r.name, partySize: r.size, date: days(r.dayOff, 12), time: r.time, status: r.status, duration: 60, createdById: S_USER } });
  }

  // AI Settings
  await prisma.aISettings.upsert({
    where: { businessId: S_BIZ },
    create: { businessId: S_BIZ, bookingThresholdForStaffIncrease: 10, kitchenRatio: 0, floorRatio: 10, minBarStaff: 1, rotaWarningDaysAhead: 2, autoFlagShortStaffedShifts: true, minStaffPerShift: 1, priceChangeNotifyScope: "managers_only", priceChangeMessage: "Menu update — check the board." },
    update: {},
  });

  console.log("✅ Starter owner demo created");

  // ── PRO ──────────────────────────────────────────────────────────────────────
  const P_BIZ   = "demo-owner-pro-biz";
  const P_VENUE = "demo-owner-pro-venue";
  const P_USER  = "demo-owner-pro-user";

  await prisma.business.upsert({
    where: { id: P_BIZ },
    create: {
      id: P_BIZ,
      name: "Bloom Bistro",
      onboardingComplete: true,
      geoLat: 53.3352,
      geoLng: -6.2641,
      geoRadius: 150,
      weeklyRevenueTarget: 22000,
      lsPlan: "pro",
      lsStatus: "active",
    },
    update: { lsPlan: "pro", lsStatus: "active" },
  });

  await prisma.venue.upsert({
    where: { id: P_VENUE },
    create: {
      id: P_VENUE,
      businessId: P_BIZ,
      name: "Bloom Bistro — Ranelagh",
      address: "47 Ranelagh Road, Dublin 6, D06 TK93",
      geoLat: 53.3352, geoLng: -6.2641, geoRadius: 150,
      timezone: "Europe/Dublin",
      isDefault: true, active: true,
    },
    update: {},
  });

  await prisma.user.upsert({
    where: { id: P_USER },
    create: { id: P_USER, email: "owner.pro@rotahr.demo", name: "James Harrington", role: "ADMIN", businessId: P_BIZ, password: pw },
    update: { name: "James Harrington", role: "ADMIN", businessId: P_BIZ, password: pw },
  });

  // Departments
  for (const dept of [
    { id: "demo-p-dept-kit", name: "Kitchen" },
    { id: "demo-p-dept-bar", name: "Bar" },
    { id: "demo-p-dept-flr", name: "Floor" },
    { id: "demo-p-dept-mgmt", name: "Management" },
  ]) {
    await prisma.department.upsert({ where: { id: dept.id }, create: { id: dept.id, businessId: P_BIZ, name: dept.name }, update: { name: dept.name } });
  }

  // 12 staff for Pro demo
  const proStaff = [
    { id: "demo-p-emp-1",  first: "Niamh",   last: "Kelly",     role: "head chef",       dept: "demo-p-dept-kit",  rate: 23.0, userRole: "MANAGER" as const },
    { id: "demo-p-emp-2",  first: "Cian",     last: "O'Connor",  role: "sous chef",       dept: "demo-p-dept-kit",  rate: 18.5, userRole: "EMPLOYEE" as const },
    { id: "demo-p-emp-3",  first: "Sophie",   last: "Burke",     role: "pastry chef",     dept: "demo-p-dept-kit",  rate: 17.0, userRole: "EMPLOYEE" as const },
    { id: "demo-p-emp-4",  first: "Luke",     last: "Flanagan",  role: "kitchen porter",  dept: "demo-p-dept-kit",  rate: 13.5, userRole: "EMPLOYEE" as const },
    { id: "demo-p-emp-5",  first: "Rachel",   last: "Moore",     role: "bar manager",     dept: "demo-p-dept-bar",  rate: 20.0, userRole: "MANAGER" as const },
    { id: "demo-p-emp-6",  first: "Darragh",  last: "Quinn",     role: "bartender",       dept: "demo-p-dept-bar",  rate: 15.5, userRole: "EMPLOYEE" as const },
    { id: "demo-p-emp-7",  first: "Orla",     last: "Nolan",     role: "bartender",       dept: "demo-p-dept-bar",  rate: 15.0, userRole: "EMPLOYEE" as const },
    { id: "demo-p-emp-8",  first: "Conor",    last: "Daly",      role: "floor manager",   dept: "demo-p-dept-flr",  rate: 19.0, userRole: "MANAGER" as const },
    { id: "demo-p-emp-9",  first: "Maeve",    last: "Lynch",     role: "waitress",        dept: "demo-p-dept-flr",  rate: 14.0, userRole: "EMPLOYEE" as const },
    { id: "demo-p-emp-10", first: "Patrick",  last: "Sheridan",  role: "waiter",          dept: "demo-p-dept-flr",  rate: 14.0, userRole: "EMPLOYEE" as const },
    { id: "demo-p-emp-11", first: "Aisling",  last: "Curran",    role: "waitress",        dept: "demo-p-dept-flr",  rate: 13.5, userRole: "EMPLOYEE" as const },
    { id: "demo-p-emp-12", first: "Brian",    last: "McGrath",   role: "operations manager", dept: "demo-p-dept-mgmt", rate: 26.0, userRole: "MANAGER" as const },
  ];
  for (const e of proStaff) {
    const email = `${e.first.toLowerCase()}.${e.last.toLowerCase().replace("'","").replace(" ",".")}@bloombistro.demo`;
    await prisma.user.upsert({
      where: { id: `${e.id}-user` },
      create: { id: `${e.id}-user`, email, name: `${e.first} ${e.last}`, role: e.userRole, businessId: P_BIZ, password: pw },
      update: { businessId: P_BIZ, password: pw },
    });
    await prisma.employee.upsert({
      where: { id: e.id },
      create: { id: e.id, businessId: P_BIZ, venueId: P_VENUE, userId: `${e.id}-user`, firstName: e.first, lastName: e.last, email, role: e.role, departmentId: e.dept, hourlyRate: e.rate, active: true, permissions: [], phone: `+353 86${Math.floor(1000000 + Math.random() * 8999999)}` },
      update: { role: e.role, hourlyRate: e.rate, departmentId: e.dept },
    });
  }

  // Shifts for Pro
  await prisma.shift.deleteMany({ where: { venueId: P_VENUE } });
  const pShifts: Array<[string, number, number, number, string, boolean]> = [
    ["demo-p-emp-1",  1, 8, 18, "Head Chef",       true], ["demo-p-emp-1",  3, 8, 18, "Head Chef",       true],
    ["demo-p-emp-1",  5, 8, 20, "Head Chef",       true], ["demo-p-emp-1",  6, 8, 20, "Head Chef",       true],
    ["demo-p-emp-2",  1, 9, 17, "Sous Chef",       true], ["demo-p-emp-2",  2, 9, 17, "Sous Chef",       true],
    ["demo-p-emp-2",  4, 9, 17, "Sous Chef",       true], ["demo-p-emp-2",  6, 9, 19, "Sous Chef",       true],
    ["demo-p-emp-3",  2, 9, 16, "Pastry Chef",     true], ["demo-p-emp-3",  3, 9, 16, "Pastry Chef",     true],
    ["demo-p-emp-3",  5, 9, 17, "Pastry Chef",     true], ["demo-p-emp-3",  6, 9, 17, "Pastry Chef",     true],
    ["demo-p-emp-4",  1,10, 18, "Kitchen Porter",  true], ["demo-p-emp-4",  3,10, 18, "Kitchen Porter",  true],
    ["demo-p-emp-4",  5,10, 18, "Kitchen Porter",  true], ["demo-p-emp-4",  6,10, 18, "Kitchen Porter",  true],
    ["demo-p-emp-5",  1,14, 23, "Bar Manager",     true], ["demo-p-emp-5",  3,12, 22, "Bar Manager",     true],
    ["demo-p-emp-5",  5,15, 23, "Bar Manager",     true], ["demo-p-emp-5",  6,12, 23, "Bar Manager",     true],
    ["demo-p-emp-6",  2,15, 23, "Bartender",       true], ["demo-p-emp-6",  4,15, 23, "Bartender",       true],
    ["demo-p-emp-6",  5,12, 22, "Bartender",       true], ["demo-p-emp-6",  6,12, 22, "Bartender",       true],
    ["demo-p-emp-7",  1,17, 23, "Bartender",       true], ["demo-p-emp-7",  3,17, 23, "Bartender",       true],
    ["demo-p-emp-7",  6,15, 23, "Bartender",       true], ["demo-p-emp-7",  7,15, 23, "Bartender",       true],
    ["demo-p-emp-8",  1,12, 20, "Floor Manager",   true], ["demo-p-emp-8",  3,12, 20, "Floor Manager",   true],
    ["demo-p-emp-8",  5,17, 23, "Floor Manager",   true], ["demo-p-emp-8",  6,12, 22, "Floor Manager",   true],
    ["demo-p-emp-9",  1,12, 20, "Waitress",        true], ["demo-p-emp-9",  2,12, 20, "Waitress",        true],
    ["demo-p-emp-9",  5,17, 23, "Waitress",        true], ["demo-p-emp-9",  6,12, 22, "Waitress",        true],
    ["demo-p-emp-10", 2,17, 23, "Waiter",          true], ["demo-p-emp-10", 4,12, 20, "Waiter",          true],
    ["demo-p-emp-10", 6,12, 22, "Waiter",          true], ["demo-p-emp-10", 7,12, 20, "Waiter",          true],
    ["demo-p-emp-11", 3,12, 20, "Waitress",        true], ["demo-p-emp-11", 5,12, 20, "Waitress",        true],
    ["demo-p-emp-11", 6,17, 23, "Waitress",        true], ["demo-p-emp-11", 7,12, 20, "Waitress",        true],
    ["demo-p-emp-12", 1, 9, 17, "Ops Manager",     true], ["demo-p-emp-12", 2, 9, 17, "Ops Manager",     true],
    ["demo-p-emp-12", 3, 9, 17, "Ops Manager",     true], ["demo-p-emp-12", 5,11, 20, "Ops Manager",     true],
  ];
  for (const [empId, dow, sh, eh, role, pub] of pShifts) {
    const start = shiftDate(0, dow, sh);
    const end   = shiftDate(0, dow, eh);
    await prisma.shift.create({ data: { employeeId: empId, venueId: P_VENUE, date: new Date(start.getFullYear(), start.getMonth(), start.getDate()), startTime: start, endTime: end, role, published: pub } });
  }

  // More expenses for Pro
  await prisma.expense.deleteMany({ where: { businessId: P_BIZ } });
  const pExpenses = [
    { amt: 2340.00, vat: 440.00, vendor: "Musgrave MarketPlace",  cat: "food_supplies", desc: "Weekly food delivery",      method: "invoice",        daysAgo: 1 },
    { amt: 1560.00, vat: 293.30, vendor: "Diageo Ireland",        cat: "beverages",     desc: "Keg & spirits delivery",    method: "invoice",        daysAgo: 2 },
    { amt: 420.00,  vat: 78.93,  vendor: "BWG Wines",             cat: "beverages",     desc: "Wine delivery",             method: "invoice",        daysAgo: 3 },
    { amt: 290.00,  vat: 54.53,  vendor: "Bunzl Ireland",         cat: "cleaning",      desc: "Cleaning supplies",         method: "card",           daysAgo: 4 },
    { amt: 3200.00, vat: 0,      vendor: "ESB Energy",            cat: "utilities",     desc: "Monthly electricity",       method: "direct_debit",   daysAgo: 5 },
    { amt: 820.00,  vat: 0,      vendor: "Bord Gáis Networks",    cat: "utilities",     desc: "Monthly gas",               method: "direct_debit",   daysAgo: 6 },
    { amt: 5200.00, vat: 0,      vendor: "Ranelagh Properties",   cat: "rent",          desc: "Monthly rent",              method: "bank_transfer",  daysAgo: 10 },
    { amt: 340.00,  vat: 63.93,  vendor: "Coca-Cola HBC Ireland", cat: "beverages",     desc: "Soft drinks & mixers",      method: "invoice",        daysAgo: 7 },
    { amt: 225.00,  vat: 42.31,  vendor: "CHUBB Security",        cat: "security",      desc: "Monthly alarm monitoring",  method: "direct_debit",   daysAgo: 8 },
    { amt: 380.00,  vat: 71.43,  vendor: "Pallas Foods",          cat: "food_supplies", desc: "Fish & seafood order",      method: "invoice",        daysAgo: 9 },
    { amt: 145.00,  vat: 27.27,  vendor: "JP Maintenance",        cat: "maintenance",   desc: "Quarterly equipment check", method: "card",           daysAgo: 12 },
    { amt: 195.00,  vat: 36.67,  vendor: "Ashtree Linen",         cat: "laundry",       desc: "Linen rental",              method: "invoice",        daysAgo: 13 },
  ];
  for (const ex of pExpenses) {
    await prisma.expense.create({ data: { businessId: P_BIZ, amount: ex.amt, vatAmount: ex.vat, currency: "EUR", vendor: ex.vendor, category: ex.cat, date: days(-ex.daysAgo), description: ex.desc, paymentMethod: ex.method, status: "confirmed", createdById: P_USER } });
  }

  // Pro reservations
  await prisma.reservation.deleteMany({ where: { businessId: P_BIZ } });
  const pTables = ["demo-p-t1","demo-p-t2","demo-p-t3","demo-p-t4","demo-p-t5"];
  for (const tid of pTables) {
    await prisma.table.upsert({ where: { id: tid }, create: { id: tid, businessId: P_BIZ, name: `Table ${pTables.indexOf(tid)+1}`, capacity: [2,4,4,6,8][pTables.indexOf(tid)], location: "Main Floor" }, update: {} });
  }
  const pRes = [
    { name: "O'Sullivan x4", size: 4, dayOff: 0, time: "19:30", status: "confirmed", notes: "Anniversary", tableId: "demo-p-t2" },
    { name: "Corporate — Google",  size: 8, dayOff: 1, time: "13:00", status: "confirmed", notes: "Team lunch",   tableId: "demo-p-t5" },
    { name: "Flynn Party x6",      size: 6, dayOff: 1, time: "19:00", status: "confirmed", notes: null,           tableId: "demo-p-t4" },
    { name: "Keane x2",            size: 2, dayOff: 2, time: "12:30", status: "confirmed", notes: null,           tableId: "demo-p-t1" },
    { name: "Murray x4",           size: 4, dayOff: 2, time: "20:00", status: "confirmed", notes: "Birthday",     tableId: "demo-p-t3" },
    { name: "Lynch Wedding Prep",  size: 8, dayOff: 7, time: "18:00", status: "confirmed", notes: "Pre-wedding",  tableId: "demo-p-t5" },
    { name: "Brennan x3",          size: 3, dayOff: 3, time: "13:00", status: "confirmed", notes: null,           tableId: "demo-p-t2" },
    { name: "Doyle",               size: 2, dayOff: -1,time: "19:00", status: "no_show",   notes: null,           tableId: "demo-p-t1" },
    { name: "Startup Dinner x5",   size: 5, dayOff: 5, time: "19:30", status: "confirmed", notes: "Investor dinner", tableId: "demo-p-t4" },
  ];
  for (const r of pRes) {
    await prisma.reservation.create({ data: { businessId: P_BIZ, customerName: r.name, partySize: r.size, date: days(r.dayOff, 12), time: r.time, duration: 90, status: r.status, notes: r.notes, tableId: r.tableId, createdById: P_USER } });
  }

  // Pro menu specials
  await prisma.menuSpecial.deleteMany({ where: { businessId: P_BIZ } });
  await prisma.menuSpecial.createMany({ data: [
    { businessId: P_BIZ, createdById: P_USER, title: "🐟 Sea Bass Special", description: "Pan-roasted sea bass, lemon beurre blanc, asparagus. €24.50.", category: "special", date: days(0, 8), pinned: true, archived: false },
    { businessId: P_BIZ, createdById: P_USER, title: "🍷 New Wine List", description: "Updated summer wine list — 6 new labels. Ask staff for recommendations.", category: "change", date: days(-2, 8), pinned: false, archived: false },
    { businessId: P_BIZ, createdById: P_USER, title: "⚠️ 86'd — Duck Confit", description: "Duck confit off today — supplier delay. Lamb shank available as sub.", category: "86'd", date: days(0, 8), pinned: false, archived: false },
    { businessId: P_BIZ, createdById: P_USER, title: "📋 Staff Briefing", description: "New allergen sheet live from Monday. All staff read before service.", category: "announcement", date: days(1, 8), pinned: true, archived: false },
  ]});

  // Time-off for Pro
  await prisma.timeOffRequest.deleteMany({ where: { employee: { businessId: P_BIZ } } });
  await prisma.timeOffRequest.createMany({ data: [
    { employeeId: "demo-p-emp-6",  startDate: days(7),  endDate: days(10), status: "pending",  reason: "Holiday — Portugal" },
    { employeeId: "demo-p-emp-9",  startDate: days(5),  endDate: days(5),  status: "approved", reason: "Doctor appointment", managedById: P_USER },
    { employeeId: "demo-p-emp-4",  startDate: days(14), endDate: days(18), status: "pending",  reason: "Summer holiday" },
    { employeeId: "demo-p-emp-11", startDate: days(3),  endDate: days(3),  status: "rejected", reason: "Short notice request", managedById: P_USER },
  ]});

  // Training certs for Pro
  await prisma.trainingCertification.deleteMany({ where: { businessId: P_BIZ } });
  await prisma.trainingCertification.createMany({ data: [
    { businessId: P_BIZ, employeeId: "demo-p-emp-1", title: "HACCP Level 3 — Management",    issuer: "QQI",             category: "HACCP",   issuedDate: days(-400), expiryDate: days(600) },
    { businessId: P_BIZ, employeeId: "demo-p-emp-2", title: "HACCP Level 2",                 issuer: "QQI",             category: "HACCP",   issuedDate: days(-180), expiryDate: days(185) },
    { businessId: P_BIZ, employeeId: "demo-p-emp-5", title: "RSA Responsible Serving",       issuer: "Fáilte Ireland",  category: "ALCOHOL", issuedDate: days(-100), expiryDate: days(800) },
    { businessId: P_BIZ, employeeId: "demo-p-emp-6", title: "RSA Responsible Serving",       issuer: "Fáilte Ireland",  category: "ALCOHOL", issuedDate: days(-500), expiryDate: days(-10), notes: "⚠️ EXPIRED" },
    { businessId: P_BIZ, employeeId: "demo-p-emp-7", title: "RSA Responsible Serving",       issuer: "Fáilte Ireland",  category: "ALCOHOL", issuedDate: days(-200), expiryDate: days(600) },
    { businessId: P_BIZ, employeeId: "demo-p-emp-9", title: "Food Safety Awareness",         issuer: "QQI",             category: "FOOD_SAFETY", issuedDate: days(-250), expiryDate: null },
    { businessId: P_BIZ, employeeId: "demo-p-emp-3", title: "First Aid Responder",           issuer: "Irish Red Cross", category: "FIRST_AID", issuedDate: days(-90), expiryDate: days(30), notes: "Due soon" },
  ]});

  // AI Settings for Pro
  await prisma.aISettings.upsert({
    where: { businessId: P_BIZ },
    create: { businessId: P_BIZ, bookingThresholdForStaffIncrease: 18, kitchenRatio: 20, floorRatio: 15, minBarStaff: 2, rotaWarningDaysAhead: 3, autoFlagShortStaffedShifts: true, minStaffPerShift: 2, priceChangeNotifyScope: "all_staff", priceChangeMessage: "Menu update in effect — check specials board." },
    update: {},
  });

  // Tip pool for Pro
  await prisma.tipDistribution.deleteMany({ where: { pool: { businessId: P_BIZ } } });
  await prisma.tipPool.deleteMany({ where: { businessId: P_BIZ } });
  const pPool = "demo-p-tip-pool-1";
  await prisma.tipPool.upsert({
    where: { id: pPool },
    create: { id: pPool, businessId: P_BIZ, periodStart: days(-7, 0, 0), periodEnd: days(-1, 23, 59), totalAmount: 1840.00, method: "hours", status: "distributed", distributedAt: days(-1), notes: "Last week tips." },
    update: {},
  });
  await prisma.tipDistribution.createMany({ data: [
    { poolId: pPool, employeeId: "demo-p-emp-5",  hoursWorked: 36, shareAmount: 330.00 },
    { poolId: pPool, employeeId: "demo-p-emp-6",  hoursWorked: 40, shareAmount: 366.67 },
    { poolId: pPool, employeeId: "demo-p-emp-7",  hoursWorked: 32, shareAmount: 293.33 },
    { poolId: pPool, employeeId: "demo-p-emp-8",  hoursWorked: 34, shareAmount: 311.67 },
    { poolId: pPool, employeeId: "demo-p-emp-9",  hoursWorked: 28, shareAmount: 256.67 },
    { poolId: pPool, employeeId: "demo-p-emp-10", hoursWorked: 20, shareAmount: 183.33 },
    { poolId: pPool, employeeId: "demo-p-emp-11", hoursWorked: 16, shareAmount: 146.67 },
    { poolId: pPool, employeeId: "demo-p-emp-4",  hoursWorked: 16, shareAmount: 146.67 },
  ]});

  console.log("✅ Pro owner demo created");

  // ── ENTERPRISE ────────────────────────────────────────────────────────────────
  const E_BIZ    = "demo-owner-ent-biz";
  const E_VENUE1 = "demo-owner-ent-venue1";
  const E_VENUE2 = "demo-owner-ent-venue2";
  const E_VENUE3 = "demo-owner-ent-venue3";
  const E_USER   = "demo-owner-ent-user";

  await prisma.business.upsert({
    where: { id: E_BIZ },
    create: {
      id: E_BIZ,
      name: "Harrington Group",
      onboardingComplete: true,
      geoLat: 53.3498,
      geoLng: -6.2603,
      geoRadius: 300,
      weeklyRevenueTarget: 90000,
      lsPlan: "enterprise",
      lsStatus: "active",
    },
    update: { lsPlan: "enterprise", lsStatus: "active" },
  });

  await prisma.user.upsert({
    where: { id: E_USER },
    create: { id: E_USER, email: "owner.enterprise@rotahr.demo", name: "Michael Harrington", role: "ADMIN", businessId: E_BIZ, password: pw },
    update: { name: "Michael Harrington", role: "ADMIN", businessId: E_BIZ, password: pw },
  });

  // 3 venues for Enterprise
  const entVenues = [
    { id: E_VENUE1, name: "Harrington's — Temple Bar", address: "12 Temple Bar Square, Dublin 2" },
    { id: E_VENUE2, name: "Harrington's — Dún Laoghaire", address: "5 Marine Road, Dún Laoghaire, Co. Dublin" },
    { id: E_VENUE3, name: "Harrington's — Malahide", address: "3 The Diamond, Malahide, Co. Dublin" },
  ];
  for (let i = 0; i < entVenues.length; i++) {
    const v = entVenues[i];
    await prisma.venue.upsert({
      where: { id: v.id },
      create: { id: v.id, businessId: E_BIZ, name: v.name, address: v.address, geoLat: 53.3498, geoLng: -6.2603, geoRadius: 200, timezone: "Europe/Dublin", isDefault: i === 0, active: true },
      update: { name: v.name },
    });
  }

  // Departments for Enterprise
  for (const dept of [
    { id: "demo-e-dept-kit", name: "Kitchen" },
    { id: "demo-e-dept-bar", name: "Bar" },
    { id: "demo-e-dept-flr", name: "Floor" },
    { id: "demo-e-dept-mgmt", name: "Management" },
  ]) {
    await prisma.department.upsert({ where: { id: dept.id }, create: { id: dept.id, businessId: E_BIZ, name: dept.name }, update: { name: dept.name } });
  }

  // 20 staff across 3 venues
  const entStaff = [
    // Temple Bar (venue1) — 8 staff
    { id: "demo-e-emp-1",  first: "Claire",  last: "Tully",     role: "venue manager",   dept: "demo-e-dept-mgmt", venue: E_VENUE1, rate: 28.0, userRole: "MANAGER" as const },
    { id: "demo-e-emp-2",  first: "Fergus",  last: "Moran",     role: "head chef",       dept: "demo-e-dept-kit",  venue: E_VENUE1, rate: 23.5, userRole: "MANAGER" as const },
    { id: "demo-e-emp-3",  first: "Sinéad",  last: "Brady",     role: "sous chef",       dept: "demo-e-dept-kit",  venue: E_VENUE1, rate: 19.0, userRole: "EMPLOYEE" as const },
    { id: "demo-e-emp-4",  first: "Mark",    last: "Doyle",     role: "bar manager",     dept: "demo-e-dept-bar",  venue: E_VENUE1, rate: 21.0, userRole: "MANAGER" as const },
    { id: "demo-e-emp-5",  first: "Aoibhinn",last: "Power",     role: "bartender",       dept: "demo-e-dept-bar",  venue: E_VENUE1, rate: 15.5, userRole: "EMPLOYEE" as const },
    { id: "demo-e-emp-6",  first: "Niall",   last: "Fagan",     role: "bartender",       dept: "demo-e-dept-bar",  venue: E_VENUE1, rate: 15.0, userRole: "EMPLOYEE" as const },
    { id: "demo-e-emp-7",  first: "Deirdre", last: "Cronin",    role: "waitress",        dept: "demo-e-dept-flr",  venue: E_VENUE1, rate: 14.0, userRole: "EMPLOYEE" as const },
    { id: "demo-e-emp-8",  first: "Kieran",  last: "Walsh",     role: "kitchen porter",  dept: "demo-e-dept-kit",  venue: E_VENUE1, rate: 13.5, userRole: "EMPLOYEE" as const },
    // Dún Laoghaire (venue2) — 6 staff
    { id: "demo-e-emp-9",  first: "Lorraine",last: "Kavanagh",  role: "venue manager",   dept: "demo-e-dept-mgmt", venue: E_VENUE2, rate: 27.0, userRole: "MANAGER" as const },
    { id: "demo-e-emp-10", first: "Tomás",   last: "Ó Briain",  role: "head chef",       dept: "demo-e-dept-kit",  venue: E_VENUE2, rate: 22.0, userRole: "MANAGER" as const },
    { id: "demo-e-emp-11", first: "Paula",   last: "Sheridan",  role: "bar manager",     dept: "demo-e-dept-bar",  venue: E_VENUE2, rate: 20.5, userRole: "MANAGER" as const },
    { id: "demo-e-emp-12", first: "Seán",    last: "Casey",     role: "bartender",       dept: "demo-e-dept-bar",  venue: E_VENUE2, rate: 15.0, userRole: "EMPLOYEE" as const },
    { id: "demo-e-emp-13", first: "Rachel",  last: "Dempsey",   role: "waitress",        dept: "demo-e-dept-flr",  venue: E_VENUE2, rate: 14.0, userRole: "EMPLOYEE" as const },
    { id: "demo-e-emp-14", first: "Dylan",   last: "Farrell",   role: "sous chef",       dept: "demo-e-dept-kit",  venue: E_VENUE2, rate: 18.5, userRole: "EMPLOYEE" as const },
    // Malahide (venue3) — 6 staff
    { id: "demo-e-emp-15", first: "Nuala",   last: "Murray",    role: "venue manager",   dept: "demo-e-dept-mgmt", venue: E_VENUE3, rate: 26.5, userRole: "MANAGER" as const },
    { id: "demo-e-emp-16", first: "Andrew",  last: "Burke",     role: "head chef",       dept: "demo-e-dept-kit",  venue: E_VENUE3, rate: 23.0, userRole: "MANAGER" as const },
    { id: "demo-e-emp-17", first: "Sarah",   last: "Dillon",    role: "floor manager",   dept: "demo-e-dept-flr",  venue: E_VENUE3, rate: 20.0, userRole: "MANAGER" as const },
    { id: "demo-e-emp-18", first: "Cormac",  last: "Healy",     role: "bartender",       dept: "demo-e-dept-bar",  venue: E_VENUE3, rate: 15.5, userRole: "EMPLOYEE" as const },
    { id: "demo-e-emp-19", first: "Eva",     last: "McCarthy",  role: "waitress",        dept: "demo-e-dept-flr",  venue: E_VENUE3, rate: 14.0, userRole: "EMPLOYEE" as const },
    { id: "demo-e-emp-20", first: "Ronan",   last: "Gallagher", role: "kitchen porter",  dept: "demo-e-dept-kit",  venue: E_VENUE3, rate: 13.5, userRole: "EMPLOYEE" as const },
  ];
  for (const e of entStaff) {
    const email = `${e.first.toLowerCase().replace("ó","o").replace("í","i").replace("á","a").replace("é","e")}.${e.last.toLowerCase().replace("'","").replace(" ",".")}@harringtongroup.demo`;
    await prisma.user.upsert({
      where: { id: `${e.id}-user` },
      create: { id: `${e.id}-user`, email, name: `${e.first} ${e.last}`, role: e.userRole, businessId: E_BIZ, password: pw },
      update: { businessId: E_BIZ, password: pw },
    });
    await prisma.employee.upsert({
      where: { id: e.id },
      create: { id: e.id, businessId: E_BIZ, venueId: e.venue, userId: `${e.id}-user`, firstName: e.first, lastName: e.last, email, role: e.role, departmentId: e.dept, hourlyRate: e.rate, active: true, permissions: [], phone: `+353 85${Math.floor(1000000 + Math.random() * 8999999)}` },
      update: { role: e.role, hourlyRate: e.rate, departmentId: e.dept, venueId: e.venue },
    });
  }

  // Shifts for Enterprise (Temple Bar only — shows multi-venue concept)
  await prisma.shift.deleteMany({ where: { venueId: { in: [E_VENUE1, E_VENUE2, E_VENUE3] } } });
  const eShifts: Array<[string, string, number, number, number, string, boolean]> = [
    // Temple Bar
    ["demo-e-emp-2",  E_VENUE1, 1, 8, 19, "Head Chef",      true], ["demo-e-emp-2",  E_VENUE1, 3, 8, 19, "Head Chef",    true],
    ["demo-e-emp-2",  E_VENUE1, 5, 8, 21, "Head Chef",      true], ["demo-e-emp-2",  E_VENUE1, 6, 8, 21, "Head Chef",    true],
    ["demo-e-emp-3",  E_VENUE1, 1, 9, 17, "Sous Chef",      true], ["demo-e-emp-3",  E_VENUE1, 2, 9, 17, "Sous Chef",    true],
    ["demo-e-emp-3",  E_VENUE1, 5, 9, 19, "Sous Chef",      true], ["demo-e-emp-3",  E_VENUE1, 6, 9, 19, "Sous Chef",    true],
    ["demo-e-emp-4",  E_VENUE1, 1,14, 23, "Bar Manager",    true], ["demo-e-emp-4",  E_VENUE1, 3,12, 22, "Bar Manager",  true],
    ["demo-e-emp-4",  E_VENUE1, 5,15, 23, "Bar Manager",    true], ["demo-e-emp-4",  E_VENUE1, 6,12, 23, "Bar Manager",  true],
    ["demo-e-emp-5",  E_VENUE1, 2,15, 23, "Bartender",      true], ["demo-e-emp-5",  E_VENUE1, 4,15, 23, "Bartender",    true],
    ["demo-e-emp-5",  E_VENUE1, 5,12, 22, "Bartender",      true], ["demo-e-emp-5",  E_VENUE1, 6,12, 22, "Bartender",    true],
    ["demo-e-emp-6",  E_VENUE1, 1,17, 23, "Bartender",      true], ["demo-e-emp-6",  E_VENUE1, 3,17, 23, "Bartender",    true],
    ["demo-e-emp-6",  E_VENUE1, 6,15, 23, "Bartender",      true], ["demo-e-emp-6",  E_VENUE1, 7,15, 23, "Bartender",    true],
    ["demo-e-emp-7",  E_VENUE1, 1,12, 20, "Waitress",       true], ["demo-e-emp-7",  E_VENUE1, 3,12, 20, "Waitress",     true],
    ["demo-e-emp-7",  E_VENUE1, 5,17, 23, "Waitress",       true], ["demo-e-emp-7",  E_VENUE1, 6,12, 22, "Waitress",     true],
    ["demo-e-emp-8",  E_VENUE1, 1,10, 18, "Kitchen Porter", true], ["demo-e-emp-8",  E_VENUE1, 3,10, 18, "Kitchen Porter",true],
    ["demo-e-emp-8",  E_VENUE1, 5,10, 18, "Kitchen Porter", true], ["demo-e-emp-8",  E_VENUE1, 6,10, 18, "Kitchen Porter",true],
    // Dún Laoghaire
    ["demo-e-emp-10", E_VENUE2, 1, 8, 19, "Head Chef",      true], ["demo-e-emp-10", E_VENUE2, 3, 8, 19, "Head Chef",    true],
    ["demo-e-emp-10", E_VENUE2, 5, 8, 20, "Head Chef",      true], ["demo-e-emp-10", E_VENUE2, 6, 8, 20, "Head Chef",    true],
    ["demo-e-emp-11", E_VENUE2, 1,14, 23, "Bar Manager",    true], ["demo-e-emp-11", E_VENUE2, 3,12, 22, "Bar Manager",  true],
    ["demo-e-emp-11", E_VENUE2, 5,15, 23, "Bar Manager",    true], ["demo-e-emp-11", E_VENUE2, 6,12, 23, "Bar Manager",  true],
    ["demo-e-emp-12", E_VENUE2, 2,15, 23, "Bartender",      true], ["demo-e-emp-12", E_VENUE2, 4,15, 23, "Bartender",    true],
    ["demo-e-emp-12", E_VENUE2, 5,12, 22, "Bartender",      true], ["demo-e-emp-12", E_VENUE2, 6,12, 22, "Bartender",    true],
    ["demo-e-emp-13", E_VENUE2, 1,12, 20, "Waitress",       true], ["demo-e-emp-13", E_VENUE2, 3,12, 20, "Waitress",     true],
    ["demo-e-emp-13", E_VENUE2, 5,17, 23, "Waitress",       true], ["demo-e-emp-13", E_VENUE2, 6,12, 22, "Waitress",     true],
    ["demo-e-emp-14", E_VENUE2, 1, 9, 17, "Sous Chef",      true], ["demo-e-emp-14", E_VENUE2, 2, 9, 17, "Sous Chef",    true],
    ["demo-e-emp-14", E_VENUE2, 5, 9, 19, "Sous Chef",      true], ["demo-e-emp-14", E_VENUE2, 6, 9, 19, "Sous Chef",    true],
    // Malahide
    ["demo-e-emp-16", E_VENUE3, 1, 8, 19, "Head Chef",      true], ["demo-e-emp-16", E_VENUE3, 4, 8, 19, "Head Chef",    true],
    ["demo-e-emp-16", E_VENUE3, 5, 8, 20, "Head Chef",      true], ["demo-e-emp-16", E_VENUE3, 6, 8, 20, "Head Chef",    true],
    ["demo-e-emp-17", E_VENUE3, 1,12, 20, "Floor Manager",  true], ["demo-e-emp-17", E_VENUE3, 3,12, 20, "Floor Manager",true],
    ["demo-e-emp-17", E_VENUE3, 5,15, 23, "Floor Manager",  true], ["demo-e-emp-17", E_VENUE3, 6,12, 23, "Floor Manager",true],
    ["demo-e-emp-18", E_VENUE3, 2,15, 23, "Bartender",      true], ["demo-e-emp-18", E_VENUE3, 4,15, 23, "Bartender",    true],
    ["demo-e-emp-18", E_VENUE3, 5,12, 22, "Bartender",      true], ["demo-e-emp-18", E_VENUE3, 6,12, 22, "Bartender",    true],
    ["demo-e-emp-19", E_VENUE3, 1,12, 20, "Waitress",       true], ["demo-e-emp-19", E_VENUE3, 2,12, 20, "Waitress",     true],
    ["demo-e-emp-19", E_VENUE3, 5,17, 23, "Waitress",       true], ["demo-e-emp-19", E_VENUE3, 6,12, 22, "Waitress",     true],
    ["demo-e-emp-20", E_VENUE3, 1,10, 18, "Kitchen Porter", true], ["demo-e-emp-20", E_VENUE3, 3,10, 18, "Kitchen Porter",true],
    ["demo-e-emp-20", E_VENUE3, 5,10, 18, "Kitchen Porter", true], ["demo-e-emp-20", E_VENUE3, 6,10, 18, "Kitchen Porter",true],
  ];
  for (const [empId, venueId, dow, sh, eh, role, pub] of eShifts) {
    const start = shiftDate(0, dow, sh);
    const end   = shiftDate(0, dow, eh);
    await prisma.shift.create({ data: { employeeId: empId, venueId, date: new Date(start.getFullYear(), start.getMonth(), start.getDate()), startTime: start, endTime: end, role, published: pub } });
  }

  // Enterprise expenses — high volume across all venues
  await prisma.expense.deleteMany({ where: { businessId: E_BIZ } });
  const eExpenses = [
    { amt: 5840.00, vat: 1097.60, vendor: "Musgrave MarketPlace",  cat: "food_supplies",  desc: "Group weekly food order — all venues",  method: "invoice",       daysAgo: 1  },
    { amt: 4200.00, vat: 789.47,  vendor: "Diageo Ireland",        cat: "beverages",      desc: "Group keg & spirits order",             method: "invoice",       daysAgo: 2  },
    { amt: 980.00,  vat: 184.24,  vendor: "BWG Wines",             cat: "beverages",      desc: "Wine delivery — all 3 venues",          method: "invoice",       daysAgo: 3  },
    { amt: 6800.00, vat: 0,       vendor: "ESB Energy",            cat: "utilities",      desc: "Monthly electricity — 3 venues",        method: "direct_debit",  daysAgo: 5  },
    { amt: 1840.00, vat: 0,       vendor: "Bord Gáis Networks",    cat: "utilities",      desc: "Monthly gas — 3 venues",                method: "direct_debit",  daysAgo: 6  },
    { amt: 18500.00,vat: 0,       vendor: "Harrington Properties", cat: "rent",           desc: "Monthly rent — 3 venue leases",         method: "bank_transfer", daysAgo: 10 },
    { amt: 1240.00, vat: 233.20,  vendor: "Bunzl Ireland",         cat: "cleaning",       desc: "Group cleaning supplies order",         method: "invoice",       daysAgo: 4  },
    { amt: 560.00,  vat: 105.28,  vendor: "CHUBB Security",        cat: "security",       desc: "3-venue alarm monitoring — monthly",    method: "direct_debit",  daysAgo: 8  },
    { amt: 890.00,  vat: 167.32,  vendor: "Pallas Foods",          cat: "food_supplies",  desc: "Seafood & fish order — all venues",     method: "invoice",       daysAgo: 7  },
    { amt: 380.00,  vat: 71.43,   vendor: "Ashtree Linen",         cat: "laundry",        desc: "Group linen rental",                    method: "invoice",       daysAgo: 9  },
    { amt: 640.00,  vat: 120.32,  vendor: "JP Maintenance",        cat: "maintenance",    desc: "Quarterly equipment maintenance — all", method: "card",          daysAgo: 12 },
    { amt: 2200.00, vat: 413.40,  vendor: "Diageo Ireland",        cat: "beverages",      desc: "Mid-week spirits top-up",               method: "invoice",       daysAgo: 11 },
    { amt: 0,       vat: 0,       vendor: "Revenue Commissioners", cat: "tax",            desc: "VAT return Q2 — group",                 method: "bank_transfer", daysAgo: 15 },
  ].filter(e => e.amt > 0);
  for (const ex of eExpenses) {
    await prisma.expense.create({ data: { businessId: E_BIZ, amount: ex.amt, vatAmount: ex.vat, currency: "EUR", vendor: ex.vendor, category: ex.cat, date: days(-ex.daysAgo), description: ex.desc, paymentMethod: ex.method, status: "confirmed", createdById: E_USER } });
  }

  // Enterprise reservations across venues
  await prisma.reservation.deleteMany({ where: { businessId: E_BIZ } });
  const entTables = [
    { id: "demo-e-t1", cap: 2, loc: "Main Floor" }, { id: "demo-e-t2", cap: 4, loc: "Main Floor" },
    { id: "demo-e-t3", cap: 4, loc: "Booth" },       { id: "demo-e-t4", cap: 6, loc: "Private" },
    { id: "demo-e-t5", cap: 8, loc: "Private" },     { id: "demo-e-t6", cap: 4, loc: "Main Floor" },
  ];
  for (const t of entTables) {
    await prisma.table.upsert({ where: { id: t.id }, create: { id: t.id, businessId: E_BIZ, name: `Table ${entTables.indexOf(t)+1}`, capacity: t.cap, location: t.loc }, update: {} });
  }
  const eRes = [
    { name: "Corporate — Meta",         size: 8, dayOff: 1, time: "13:00", status: "confirmed", notes: "Board lunch",          tableId: "demo-e-t5", venue: E_VENUE1 },
    { name: "O'Dwyer Party x6",         size: 6, dayOff: 1, time: "19:00", status: "confirmed", notes: "Birthday",             tableId: "demo-e-t4", venue: E_VENUE1 },
    { name: "Byrne x4",                 size: 4, dayOff: 2, time: "20:00", status: "confirmed", notes: null,                   tableId: "demo-e-t2", venue: E_VENUE2 },
    { name: "Murphy Wedding Party x8",  size: 8, dayOff: 7, time: "18:00", status: "confirmed", notes: "Private room request", tableId: "demo-e-t5", venue: E_VENUE2 },
    { name: "Kehoe x4",                 size: 4, dayOff: 3, time: "13:00", status: "confirmed", notes: null,                   tableId: "demo-e-t3", venue: E_VENUE3 },
    { name: "Enterprise Tech Dinner",   size: 6, dayOff: 4, time: "19:30", status: "confirmed", notes: "Investor dinner",      tableId: "demo-e-t4", venue: E_VENUE3 },
    { name: "Lyons x2",                 size: 2, dayOff: 0, time: "12:30", status: "confirmed", notes: null,                   tableId: "demo-e-t1", venue: E_VENUE1 },
    { name: "King x3",                  size: 3, dayOff: -1,time: "19:00", status: "no_show",   notes: null,                   tableId: "demo-e-t6", venue: E_VENUE2 },
    { name: "Dunne Christening x8",     size: 8, dayOff: 10,time: "14:00", status: "confirmed", notes: "Christening reception",tableId: "demo-e-t5", venue: E_VENUE3 },
  ];
  for (const r of eRes) {
    await prisma.reservation.create({ data: { businessId: E_BIZ, customerName: r.name, partySize: r.size, date: days(r.dayOff, 12), time: r.time, duration: 90, status: r.status, notes: r.notes, tableId: r.tableId, createdById: E_USER } });
  }

  // Enterprise AI Settings
  await prisma.aISettings.upsert({
    where: { businessId: E_BIZ },
    create: { businessId: E_BIZ, bookingThresholdForStaffIncrease: 25, kitchenRatio: 20, floorRatio: 15, minBarStaff: 3, rotaWarningDaysAhead: 5, autoFlagShortStaffedShifts: true, minStaffPerShift: 3, priceChangeNotifyScope: "all_staff", priceChangeMessage: "Group menu update in effect across all venues. See your venue manager." },
    update: {},
  });

  // Enterprise tip pools (one per venue)
  await prisma.tipDistribution.deleteMany({ where: { pool: { businessId: E_BIZ } } });
  await prisma.tipPool.deleteMany({ where: { businessId: E_BIZ } });
  const ePools = [
    { id: "demo-e-pool-1", total: 2840.00, notes: "Temple Bar — last week", emps: [
      { e: "demo-e-emp-4", h: 40, s: 540.95 }, { e: "demo-e-emp-5", h: 38, s: 513.90 },
      { e: "demo-e-emp-6", h: 32, s: 432.76 }, { e: "demo-e-emp-7", h: 28, s: 378.67 },
      { e: "demo-e-emp-3", h: 24, s: 324.57 }, { e: "demo-e-emp-8", h: 20, s: 270.48 },
    ]},
    { id: "demo-e-pool-2", total: 2180.00, notes: "Dún Laoghaire — last week", emps: [
      { e: "demo-e-emp-11", h: 36, s: 465.43 }, { e: "demo-e-emp-12", h: 40, s: 517.14 },
      { e: "demo-e-emp-13", h: 28, s: 362.00 }, { e: "demo-e-emp-14", h: 32, s: 413.71 },
      { e: "demo-e-emp-10", h: 20, s: 258.57 }, { e: "demo-e-emp-9", h: 12, s: 155.14 },
    ]},
    { id: "demo-e-pool-3", total: 1960.00, notes: "Malahide — last week", emps: [
      { e: "demo-e-emp-17", h: 36, s: 436.36 }, { e: "demo-e-emp-18", h: 38, s: 461.82 },
      { e: "demo-e-emp-19", h: 32, s: 387.27 }, { e: "demo-e-emp-20", h: 24, s: 290.91 },
      { e: "demo-e-emp-16", h: 20, s: 242.42 }, { e: "demo-e-emp-15", h: 12, s: 145.45 },
    ]},
  ];
  for (const pool of ePools) {
    await prisma.tipPool.upsert({
      where: { id: pool.id },
      create: { id: pool.id, businessId: E_BIZ, periodStart: days(-7, 0, 0), periodEnd: days(-1, 23, 59), totalAmount: pool.total, method: "hours", status: "distributed", distributedAt: days(-1), notes: pool.notes },
      update: {},
    });
    await prisma.tipDistribution.createMany({ data: pool.emps.map(e => ({ poolId: pool.id, employeeId: e.e, hoursWorked: e.h, shareAmount: e.s })) });
  }

  // Enterprise menu specials (group-wide)
  await prisma.menuSpecial.deleteMany({ where: { businessId: E_BIZ } });
  await prisma.menuSpecial.createMany({ data: [
    { businessId: E_BIZ, createdById: E_USER, title: "🏢 Group Policy Update", description: "All venues: new tipping policy in effect from Monday. See managers for briefing packs.", category: "announcement", date: days(1, 8), pinned: true, archived: false },
    { businessId: E_BIZ, createdById: E_USER, title: "🐟 Summer Seafood Menu", description: "New seasonal seafood menu launching this weekend across all Harrington venues. Training session Friday 3pm.", category: "change", date: days(0, 8), pinned: true, archived: false },
    { businessId: E_BIZ, createdById: E_USER, title: "🥩 Bank Holiday Special", description: "Full carvery on bank holiday Sunday across all venues. Extra staff rostered. Doors 12pm.", category: "special", date: days(2, 8), pinned: false, archived: false },
    { businessId: E_BIZ, createdById: E_USER, title: "⚠️ Allergen Sheet v4.2", description: "Updated allergen info for new summer menu. Mandatory for all front-of-house staff before Friday service.", category: "announcement", date: days(-1, 8), pinned: false, archived: false },
  ]});

  // Training certs for Enterprise
  await prisma.trainingCertification.deleteMany({ where: { businessId: E_BIZ } });
  await prisma.trainingCertification.createMany({ data: [
    { businessId: E_BIZ, employeeId: "demo-e-emp-2",  title: "HACCP Level 3",          issuer: "QQI",             category: "HACCP",   issuedDate: days(-400), expiryDate: days(600) },
    { businessId: E_BIZ, employeeId: "demo-e-emp-10", title: "HACCP Level 3",          issuer: "QQI",             category: "HACCP",   issuedDate: days(-300), expiryDate: days(700) },
    { businessId: E_BIZ, employeeId: "demo-e-emp-16", title: "HACCP Level 3",          issuer: "QQI",             category: "HACCP",   issuedDate: days(-200), expiryDate: days(800) },
    { businessId: E_BIZ, employeeId: "demo-e-emp-4",  title: "RSA Responsible Serving",issuer: "Fáilte Ireland",  category: "ALCOHOL", issuedDate: days(-100), expiryDate: days(800) },
    { businessId: E_BIZ, employeeId: "demo-e-emp-5",  title: "RSA Responsible Serving",issuer: "Fáilte Ireland",  category: "ALCOHOL", issuedDate: days(-500), expiryDate: days(-5),  notes: "⚠️ EXPIRED" },
    { businessId: E_BIZ, employeeId: "demo-e-emp-11", title: "RSA Responsible Serving",issuer: "Fáilte Ireland",  category: "ALCOHOL", issuedDate: days(-90),  expiryDate: days(900) },
    { businessId: E_BIZ, employeeId: "demo-e-emp-1",  title: "First Aid Responder",    issuer: "Irish Red Cross", category: "FIRST_AID", issuedDate: days(-50), expiryDate: days(1050) },
    { businessId: E_BIZ, employeeId: "demo-e-emp-9",  title: "First Aid Responder",    issuer: "Irish Red Cross", category: "FIRST_AID", issuedDate: days(-120), expiryDate: days(30), notes: "Renew soon" },
    { businessId: E_BIZ, employeeId: "demo-e-emp-15", title: "First Aid Responder",    issuer: "Irish Red Cross", category: "FIRST_AID", issuedDate: days(-60),  expiryDate: days(1040) },
  ]});

  console.log("✅ Enterprise owner demo created");
}

/**
 * seedDemo() — exported for in-process use (e.g. Vercel serverless, API routes).
 * Runs all the seed logic with its own Prisma client instance.
 */
export async function seedDemo(): Promise<void> {
  const seedPrisma = new PrismaClient();
  try {
    await main(seedPrisma);
    await seedOwnerDemos(seedPrisma);
  } finally {
    await seedPrisma.$disconnect();
  }
}

// ─── CLI entry point (only runs when executed directly, not when imported) ─────
// detect: node/tsx running this file directly
const isMain =
  typeof require !== "undefined"
    ? require.main === module
    : import.meta.url === `file://${process.argv[1]}`;

if (isMain) {
  const cliPrisma = new PrismaClient();
  main(cliPrisma)
    .then(() => seedOwnerDemos(cliPrisma))
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => cliPrisma.$disconnect());
}
