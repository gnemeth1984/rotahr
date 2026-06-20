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

const prisma = new PrismaClient();

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
async function main() {
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
      },
      update: { role: e.role, hourlyRate: e.rate, departmentId: e.dept, venueId: VENUE },
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

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
