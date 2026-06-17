// @ts-nocheck
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Week starting Monday June 16 2025
const WEEK_START = new Date("2025-06-16T00:00:00.000Z");

function dayOf(offset: number, hour: number, minute = 0) {
  const d = new Date(WEEK_START);
  d.setUTCDate(d.getUTCDate() + offset);
  d.setUTCHours(hour, minute, 0, 0);
  return d;
}

async function main() {
  const password = await bcrypt.hash("password123", 12);

  // ── Business ──────────────────────────────────────────────
  const business = await prisma.business.upsert({
    where: { id: "christys-bar-seed-id" },
    update: { name: "Christy's Bar" },
    create: { id: "christys-bar-seed-id", name: "Christy's Bar" },
  });

  // ── Manager ───────────────────────────────────────────────
  const christy = await prisma.user.upsert({
    where: { email: "christywalsh@gmail.com" },
    update: { name: "Christy Walsh", role: "MANAGER", password, businessId: business.id },
    create: { name: "Christy Walsh", email: "christywalsh@gmail.com", role: "MANAGER", password, businessId: business.id },
  });

  // ── Departments ───────────────────────────────────────────
  const bar = await prisma.department.upsert({
    where: { id: "dept-bar" },
    update: {},
    create: { id: "dept-bar", name: "Bar", businessId: business.id },
  });
  const kitchen = await prisma.department.upsert({
    where: { id: "dept-kitchen" },
    update: {},
    create: { id: "dept-kitchen", name: "Kitchen", businessId: business.id },
  });
  const floor = await prisma.department.upsert({
    where: { id: "dept-floor" },
    update: {},
    create: { id: "dept-floor", name: "Floor", businessId: business.id },
  });

  // ── Tables ────────────────────────────────────────────────
  const tablesData = [
    { id: "table-1", name: "Table 1", capacity: 2, location: "Window" },
    { id: "table-2", name: "Table 2", capacity: 2, location: "Window" },
    { id: "table-3", name: "Table 3", capacity: 4, location: "Main Floor" },
    { id: "table-4", name: "Table 4", capacity: 4, location: "Main Floor" },
    { id: "table-5", name: "Table 5", capacity: 4, location: "Main Floor" },
    { id: "table-6", name: "Table 6", capacity: 6, location: "Main Floor" },
    { id: "table-7", name: "Table 7", capacity: 6, location: "Back Room" },
    { id: "table-8", name: "Table 8", capacity: 8, location: "Back Room" },
    { id: "table-9", name: "Table 9", capacity: 10, location: "Back Room" },
    { id: "table-private", name: "Private Dining Room", capacity: 20, location: "Private Room" },
  ];
  for (const t of tablesData) {
    await prisma.table.upsert({
      where: { id: t.id },
      update: { name: t.name, capacity: t.capacity, location: t.location },
      create: { ...t, businessId: business.id },
    });
  }

  // ── Staff users ───────────────────────────────────────────
  const staffUsers = [
    { id: "user-sean",    email: "sean.murphy@rotahr.dev",    name: "Sean Murphy",    role: "EMPLOYEE" },
    { id: "user-aoife",   email: "aoife.kelly@rotahr.dev",    name: "Aoife Kelly",    role: "EMPLOYEE" },
    { id: "user-padraig", email: "padraig.ryan@rotahr.dev",   name: "Pádraig Ryan",   role: "EMPLOYEE" },
    { id: "user-niamh",   email: "niamh.obrien@rotahr.dev",   name: "Niamh O'Brien",  role: "EMPLOYEE" },
    { id: "user-conor",   email: "conor.fitzgerald@rotahr.dev", name: "Conor Fitzgerald", role: "EMPLOYEE" },
    { id: "user-siobhan", email: "siobhan.brennan@rotahr.dev", name: "Siobhán Brennan", role: "EMPLOYEE" },
    { id: "user-declan",  email: "declan.doyle@rotahr.dev",   name: "Declan Doyle",   role: "EMPLOYEE" },
    { id: "user-roisin",  email: "roisin.walsh@rotahr.dev",   name: "Róisín Walsh",   role: "EMPLOYEE" },
  ];

  for (const u of staffUsers) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, password, businessId: business.id },
      create: { id: u.id, name: u.name, email: u.email, role: u.role, password, businessId: business.id },
    });
  }

  // ── Employees ─────────────────────────────────────────────
  const employeesData = [
    {
      id: "emp-sean",
      firstName: "Sean", lastName: "Murphy",
      email: "sean.murphy@rotahr.dev", phone: "+353 87 123 4567",
      ppsNumber: "1234567A", role: "bartender",
      departmentId: bar.id, userId: "user-sean",
      emergencyName: "Mary Murphy", emergencyPhone: "+353 87 765 4321", emergencyRelation: "Mother",
      medicalConditions: "None", bloodType: "O+",
    },
    {
      id: "emp-aoife",
      firstName: "Aoife", lastName: "Kelly",
      email: "aoife.kelly@rotahr.dev", phone: "+353 86 234 5678",
      ppsNumber: "2345678B", role: "waitress",
      departmentId: floor.id, userId: "user-aoife",
      emergencyName: "Tom Kelly", emergencyPhone: "+353 86 876 5432", emergencyRelation: "Father",
      medicalConditions: "Nut allergy", medications: "EpiPen", bloodType: "A+",
    },
    {
      id: "emp-padraig",
      firstName: "Pádraig", lastName: "Ryan",
      email: "padraig.ryan@rotahr.dev", phone: "+353 85 345 6789",
      ppsNumber: "3456789C", role: "chef",
      departmentId: kitchen.id, userId: "user-padraig",
      emergencyName: "Sinéad Ryan", emergencyPhone: "+353 85 987 6543", emergencyRelation: "Wife",
      bloodType: "B+",
    },
    {
      id: "emp-niamh",
      firstName: "Niamh", lastName: "O'Brien",
      email: "niamh.obrien@rotahr.dev", phone: "+353 83 456 7890",
      ppsNumber: "4567890D", role: "waitress",
      departmentId: floor.id, userId: "user-niamh",
      emergencyName: "Colm O'Brien", emergencyPhone: "+353 83 098 7654", emergencyRelation: "Brother",
      bloodType: "AB-",
    },
    {
      id: "emp-conor",
      firstName: "Conor", lastName: "Fitzgerald",
      email: "conor.fitzgerald@rotahr.dev", phone: "+353 87 567 8901",
      ppsNumber: "5678901E", role: "bartender",
      departmentId: bar.id, userId: "user-conor",
      emergencyName: "Patricia Fitzgerald", emergencyPhone: "+353 87 109 8765", emergencyRelation: "Mother",
      bloodType: "A-",
    },
    {
      id: "emp-siobhan",
      firstName: "Siobhán", lastName: "Brennan",
      email: "siobhan.brennan@rotahr.dev", phone: "+353 86 678 9012",
      ppsNumber: "6789012F", role: "sous chef",
      departmentId: kitchen.id, userId: "user-siobhan",
      emergencyName: "Michael Brennan", emergencyPhone: "+353 86 210 9876", emergencyRelation: "Husband",
      medicalConditions: "Asthma", medications: "Ventolin inhaler", bloodType: "O-",
    },
    {
      id: "emp-declan",
      firstName: "Declan", lastName: "Doyle",
      email: "declan.doyle@rotahr.dev", phone: "+353 85 789 0123",
      ppsNumber: "7890123G", role: "floor manager",
      departmentId: floor.id, userId: "user-declan",
      emergencyName: "Anne Doyle", emergencyPhone: "+353 85 321 0987", emergencyRelation: "Sister",
      bloodType: "B-",
    },
    {
      id: "emp-roisin",
      firstName: "Róisín", lastName: "Walsh",
      email: "roisin.walsh@rotahr.dev", phone: "+353 83 890 1234",
      ppsNumber: "8901234H", role: "bartender",
      departmentId: bar.id, userId: "user-roisin",
      emergencyName: "Liam Walsh", emergencyPhone: "+353 83 432 1098", emergencyRelation: "Father",
      bloodType: "A+",
    },
  ];

  for (const e of employeesData) {
    await prisma.employee.upsert({
      where: { id: e.id },
      update: e,
      create: { ...e, businessId: business.id },
    });
  }

  // ── Shifts (week of Jun 16–22 2025, ~34-38h each) ─────────
  // Each employee gets 5 days × 7h = 35h minimum, some get overtime
  // Shift patterns: morning 9-17, afternoon 14-22, evening 17-01
  // offset: 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun

  const shiftsData = [
    // Sean Murphy – Bar – Mon-Fri + Sat (38h)
    { id: "sh-sean-0", employeeId: "emp-sean", offset: 0, start: 14, end: 22, role: "Bartender" },
    { id: "sh-sean-1", employeeId: "emp-sean", offset: 1, start: 14, end: 22, role: "Bartender" },
    { id: "sh-sean-2", employeeId: "emp-sean", offset: 2, start: 17, end: 23, role: "Bartender" },
    { id: "sh-sean-3", employeeId: "emp-sean", offset: 3, start: 14, end: 22, role: "Bartender" },
    { id: "sh-sean-4", employeeId: "emp-sean", offset: 4, start: 17, end: 23, role: "Bartender" },
    { id: "sh-sean-5", employeeId: "emp-sean", offset: 5, start: 12, end: 20, role: "Bartender", overtime: 2 },

    // Aoife Kelly – Floor – Mon-Sat (37h)
    { id: "sh-aoife-0", employeeId: "emp-aoife", offset: 0, start: 12, end: 20, role: "Waitress" },
    { id: "sh-aoife-1", employeeId: "emp-aoife", offset: 1, start: 12, end: 20, role: "Waitress" },
    { id: "sh-aoife-2", employeeId: "emp-aoife", offset: 2, start: 9,  end: 17, role: "Waitress" },
    { id: "sh-aoife-3", employeeId: "emp-aoife", offset: 3, start: 12, end: 20, role: "Waitress" },
    { id: "sh-aoife-4", employeeId: "emp-aoife", offset: 4, start: 14, end: 22, role: "Waitress", overtime: 1 },
    { id: "sh-aoife-5", employeeId: "emp-aoife", offset: 5, start: 14, end: 22, role: "Waitress" },

    // Pádraig Ryan – Kitchen – Tue-Sun (36h)
    { id: "sh-padraig-0", employeeId: "emp-padraig", offset: 1, start: 9,  end: 17, role: "Chef" },
    { id: "sh-padraig-1", employeeId: "emp-padraig", offset: 2, start: 9,  end: 17, role: "Chef" },
    { id: "sh-padraig-2", employeeId: "emp-padraig", offset: 3, start: 9,  end: 17, role: "Chef" },
    { id: "sh-padraig-3", employeeId: "emp-padraig", offset: 4, start: 12, end: 22, role: "Chef", overtime: 2 },
    { id: "sh-padraig-4", employeeId: "emp-padraig", offset: 5, start: 10, end: 20, role: "Chef" },
    { id: "sh-padraig-5", employeeId: "emp-padraig", offset: 6, start: 10, end: 16, role: "Chef" },

    // Niamh O'Brien – Floor – Mon-Fri + Sun (35h)
    { id: "sh-niamh-0", employeeId: "emp-niamh", offset: 0, start: 9,  end: 17, role: "Waitress" },
    { id: "sh-niamh-1", employeeId: "emp-niamh", offset: 1, start: 9,  end: 17, role: "Waitress" },
    { id: "sh-niamh-2", employeeId: "emp-niamh", offset: 2, start: 9,  end: 17, role: "Waitress" },
    { id: "sh-niamh-3", employeeId: "emp-niamh", offset: 3, start: 14, end: 22, role: "Waitress" },
    { id: "sh-niamh-4", employeeId: "emp-niamh", offset: 4, start: 9,  end: 16, role: "Waitress" },
    { id: "sh-niamh-5", employeeId: "emp-niamh", offset: 6, start: 12, end: 20, role: "Waitress" },

    // Conor Fitzgerald – Bar – Mon-Sat (38h)
    { id: "sh-conor-0", employeeId: "emp-conor", offset: 0, start: 17, end: 23, role: "Bartender" },
    { id: "sh-conor-1", employeeId: "emp-conor", offset: 1, start: 17, end: 23, role: "Bartender" },
    { id: "sh-conor-2", employeeId: "emp-conor", offset: 2, start: 14, end: 22, role: "Bartender" },
    { id: "sh-conor-3", employeeId: "emp-conor", offset: 3, start: 17, end: 23, role: "Bartender" },
    { id: "sh-conor-4", employeeId: "emp-conor", offset: 4, start: 20, end: 23, role: "Bartender", overtime: 3 },
    { id: "sh-conor-5", employeeId: "emp-conor", offset: 5, start: 14, end: 23, role: "Bartender", overtime: 1 },

    // Siobhán Brennan – Kitchen – Mon-Sat (36h)
    { id: "sh-siobhan-0", employeeId: "emp-siobhan", offset: 0, start: 12, end: 18, role: "Sous Chef" },
    { id: "sh-siobhan-1", employeeId: "emp-siobhan", offset: 1, start: 12, end: 20, role: "Sous Chef" },
    { id: "sh-siobhan-2", employeeId: "emp-siobhan", offset: 2, start: 12, end: 20, role: "Sous Chef" },
    { id: "sh-siobhan-3", employeeId: "emp-siobhan", offset: 3, start: 9,  end: 17, role: "Sous Chef" },
    { id: "sh-siobhan-4", employeeId: "emp-siobhan", offset: 4, start: 14, end: 22, role: "Sous Chef" },
    { id: "sh-siobhan-5", employeeId: "emp-siobhan", offset: 5, start: 10, end: 16, role: "Sous Chef" },

    // Declan Doyle – Floor Manager – Mon-Fri + Sat (38h)
    { id: "sh-declan-0", employeeId: "emp-declan", offset: 0, start: 9,  end: 17, role: "Floor Manager" },
    { id: "sh-declan-1", employeeId: "emp-declan", offset: 1, start: 9,  end: 17, role: "Floor Manager" },
    { id: "sh-declan-2", employeeId: "emp-declan", offset: 2, start: 9,  end: 17, role: "Floor Manager" },
    { id: "sh-declan-3", employeeId: "emp-declan", offset: 3, start: 9,  end: 17, role: "Floor Manager" },
    { id: "sh-declan-4", employeeId: "emp-declan", offset: 4, start: 9,  end: 17, role: "Floor Manager" },
    { id: "sh-declan-5", employeeId: "emp-declan", offset: 5, start: 12, end: 20, role: "Floor Manager", overtime: 2 },

    // Róisín Walsh – Bar – Wed-Sun (35h)
    { id: "sh-roisin-0", employeeId: "emp-roisin", offset: 2, start: 17, end: 23, role: "Bartender" },
    { id: "sh-roisin-1", employeeId: "emp-roisin", offset: 3, start: 17, end: 23, role: "Bartender" },
    { id: "sh-roisin-2", employeeId: "emp-roisin", offset: 4, start: 17, end: 23, role: "Bartender", overtime: 1 },
    { id: "sh-roisin-3", employeeId: "emp-roisin", offset: 5, start: 12, end: 23, role: "Bartender", overtime: 1 },
    { id: "sh-roisin-4", employeeId: "emp-roisin", offset: 6, start: 12, end: 20, role: "Bartender" },
  ];

  for (const s of shiftsData) {
    const date = dayOf(s.offset, 0);
    const startTime = dayOf(s.offset, s.start);
    const endTime = dayOf(s.offset, s.end);
    await prisma.shift.upsert({
      where: { id: s.id },
      update: { date, startTime, endTime, role: s.role, published: true, overtimeHours: s.overtime ?? 0, employeeId: s.employeeId },
      create: { id: s.id, date, startTime, endTime, role: s.role, published: true, overtimeHours: s.overtime ?? 0, employeeId: s.employeeId },
    });
  }

  // ── Time Off Requests ─────────────────────────────────────
  const timeOffData = [
    {
      id: "tor-1",
      employeeId: "emp-aoife",
      startDate: new Date("2025-06-23"),
      endDate: new Date("2025-06-27"),
      status: "pending",
      reason: "Family holiday to Spain",
    },
    {
      id: "tor-2",
      employeeId: "emp-sean",
      startDate: new Date("2025-07-07"),
      endDate: new Date("2025-07-11"),
      status: "approved",
      reason: "Wedding anniversary trip",
    },
    {
      id: "tor-3",
      employeeId: "emp-niamh",
      startDate: new Date("2025-06-30"),
      endDate: new Date("2025-07-04"),
      status: "pending",
      reason: "Attending a course in Dublin",
    },
    {
      id: "tor-4",
      employeeId: "emp-padraig",
      startDate: new Date("2025-07-14"),
      endDate: new Date("2025-07-18"),
      status: "approved",
      reason: "Annual leave",
    },
    {
      id: "tor-5",
      employeeId: "emp-conor",
      startDate: new Date("2025-06-26"),
      endDate: new Date("2025-06-26"),
      status: "rejected",
      reason: "Need Saturday off for a match",
    },
    {
      id: "tor-6",
      employeeId: "emp-roisin",
      startDate: new Date("2025-07-21"),
      endDate: new Date("2025-07-25"),
      status: "pending",
      reason: "Summer holidays",
    },
  ];

  for (const t of timeOffData) {
    await prisma.timeOffRequest.upsert({
      where: { id: t.id },
      update: t,
      create: t,
    });
  }

  // ── Reservations ──────────────────────────────────────────
  const reservationsData = [
    {
      id: "res-1",
      customerName: "Brian & Claire Hannigan",
      customerEmail: "brian.hannigan@gmail.com",
      customerPhone: "+353 87 111 2233",
      partySize: 2,
      date: dayOf(0, 19),
      time: "19:00",
      duration: 90,
      status: "confirmed",
      tableId: "table-1",
      notes: "Anniversary dinner — please arrange a small dessert surprise if possible.",
    },
    {
      id: "res-2",
      customerName: "O'Sullivan Family",
      customerEmail: "margaret.osullivan@hotmail.com",
      customerPhone: "+353 86 222 3344",
      partySize: 6,
      date: dayOf(1, 18),
      time: "18:00",
      duration: 120,
      status: "confirmed",
      tableId: "table-6",
      notes: "One guest has a severe gluten intolerance. Please ensure kitchen is aware.",
    },
    {
      id: "res-3",
      customerName: "Galway Tech Meetup",
      customerEmail: "events@galwaytech.ie",
      customerPhone: "+353 91 333 4455",
      partySize: 18,
      date: dayOf(2, 19, 30),
      time: "19:30",
      duration: 180,
      status: "confirmed",
      tableId: "table-private",
      notes: "Corporate group. Pre-ordered: 10x beef, 5x salmon, 3x vegetarian. Bar tab agreed with manager. AV projector requested for presentation.",
    },
    {
      id: "res-4",
      customerName: "Declan Morrissey",
      customerEmail: "declan.m@icloud.com",
      customerPhone: "+353 85 444 5566",
      partySize: 4,
      date: dayOf(3, 20),
      time: "20:00",
      duration: 90,
      status: "confirmed",
      tableId: "table-4",
      notes: "Celebrating a promotion. Guest requested window seat if available.",
    },
    {
      id: "res-5",
      customerName: "Siobhán & Friends",
      customerEmail: "siobhan.mc@gmail.com",
      customerPhone: "+353 83 555 6677",
      partySize: 8,
      date: dayOf(4, 20, 30),
      time: "20:30",
      duration: 120,
      status: "confirmed",
      tableId: "table-8",
      notes: "Birthday party — cake being brought in by the group. 2 guests are vegetarian, 1 vegan.",
    },
    {
      id: "res-6",
      customerName: "McCarthy & McCarthy Solicitors",
      customerEmail: "reception@mccarthysol.ie",
      customerPhone: "+353 91 666 7788",
      partySize: 10,
      date: dayOf(5, 13),
      time: "13:00",
      duration: 120,
      status: "confirmed",
      tableId: "table-9",
      notes: "Business lunch. Invoice to be issued to the company. Dietary note: one guest is halal.",
    },
    {
      id: "res-7",
      customerName: "Patrick Finn",
      customerEmail: "pfinn@eircom.net",
      customerPhone: "+353 87 777 8899",
      partySize: 3,
      date: dayOf(6, 15),
      time: "15:00",
      duration: 90,
      status: "pending",
      tableId: "table-3",
      notes: "Regular customer. Prefers quiet corner table. Allergic to shellfish.",
    },
    {
      id: "res-8",
      customerName: "Keane Baby Shower",
      customerEmail: "louise.keane@gmail.com",
      customerPhone: "+353 86 888 9900",
      partySize: 14,
      date: dayOf(5, 15),
      time: "15:00",
      duration: 150,
      status: "confirmed",
      tableId: "table-private",
      notes: "Baby shower event. Decorations being set up from 14:00 — please allow early access. No alcohol for the guest of honour. Prosecco ordered for others.",
    },
  ];

  for (const r of reservationsData) {
    await prisma.reservation.upsert({
      where: { id: r.id },
      update: r,
      create: { ...r, businessId: business.id },
    });
  }

  // ── Summary ───────────────────────────────────────────────
  console.log(`✅ Business: ${business.name}`);
  console.log(`✅ Employees: ${employeesData.length} staff seeded`);
  console.log(`✅ Shifts: ${shiftsData.length} shifts (all published, 34-38h/week)`);
  console.log(`✅ Time off: ${timeOffData.length} requests`);
  console.log(`✅ Reservations: ${reservationsData.length} bookings`);
  console.log(`✅ Tables: ${tablesData.length} tables`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
