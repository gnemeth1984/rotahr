import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/prisma";

// Service periods (hours)
const LUNCH = { start: 11, end: 16 };
const DINNER = { start: 17, end: 23 };

// Default covers-per-staff benchmarks (override via AISettings)
const DEFAULT_COVERS_PER_FLOOR = 12;
const DEFAULT_COVERS_PER_KITCHEN = 15;

function getServicePeriod(hour: number): "lunch" | "dinner" | null {
  if (hour >= LUNCH.start && hour < LUNCH.end) return "lunch";
  if (hour >= DINNER.start && hour < DINNER.end) return "dinner";
  return null;
}

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function toDateStr(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user?.businessId) return NextResponse.json({ error: "No business" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const weekStartParam = searchParams.get("weekStart");
  const weekStart = weekStartParam ? new Date(weekStartParam + "T00:00:00") : (() => {
    const d = new Date();
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
  })();

  const weekEnd = addDays(weekStart, 6);
  weekEnd.setHours(23, 59, 59, 999);

  // Fetch AI settings for custom benchmarks
  const aiSettings = await prisma.aISettings.findUnique({ where: { businessId: user.businessId } });
  // Use AI settings booking threshold as a proxy for covers per staff if set
  const coversPerFloor = DEFAULT_COVERS_PER_FLOOR;
  const coversPerKitchen = DEFAULT_COVERS_PER_KITCHEN;

  // Fetch reservations for the week
  const reservations = await prisma.reservation.findMany({
    where: {
      businessId: user.businessId,
      date: { gte: weekStart, lte: weekEnd },
      status: { notIn: ["cancelled", "no_show"] },
    },
    select: { date: true, partySize: true, time: true },
  });

  // Fetch shifts for the week
  const shifts = await prisma.shift.findMany({
    where: {
      employee: { businessId: user.businessId },
      date: { gte: weekStart, lte: weekEnd },
      published: true,
    },
    select: { date: true, startTime: true, endTime: true, role: true },
  });

  // Build per-day forecast
  const forecast = [];
  for (let i = 0; i < 7; i++) {
    const dayDate = addDays(weekStart, i);
    const dayStr = toDateStr(dayDate);

    // Get reservations for this day
    const dayRes = reservations.filter((r) => toDateStr(new Date(r.date)) === dayStr);

    // Group by service period
    const lunchCovers = dayRes
      .filter((r) => {
        const h = r.time ? parseInt(r.time.split(":")[0]) : new Date(r.date).getHours();
        return getServicePeriod(h) === "lunch";
      })
      .reduce((s, r) => s + (r.partySize ?? 2), 0);

    const dinnerCovers = dayRes
      .filter((r) => {
        const h = r.time ? parseInt(r.time.split(":")[0]) : new Date(r.date).getHours();
        return getServicePeriod(h) === "dinner";
      })
      .reduce((s, r) => s + (r.partySize ?? 2), 0);

    // Get rostered staff for this day
    const dayShifts = shifts.filter((s) => toDateStr(new Date(s.date)) === dayStr);
    const lunchStaff = dayShifts.filter((s) => {
      const h = new Date(s.startTime).getHours();
      return getServicePeriod(h) === "lunch" || (h <= 12 && new Date(s.endTime).getHours() >= 14);
    }).length;
    const dinnerStaff = dayShifts.filter((s) => {
      const h = new Date(s.startTime).getHours();
      return getServicePeriod(h) === "dinner" || (h <= 17 && new Date(s.endTime).getHours() >= 19);
    }).length;

    // Calculate needed staff (floor + kitchen blended)
    const lunchNeededFloor = Math.ceil(lunchCovers / coversPerFloor);
    const lunchNeededKitchen = Math.ceil(lunchCovers / coversPerKitchen);
    const lunchNeeded = lunchNeededFloor + lunchNeededKitchen;

    const dinnerNeededFloor = Math.ceil(dinnerCovers / coversPerFloor);
    const dinnerNeededKitchen = Math.ceil(dinnerCovers / coversPerKitchen);
    const dinnerNeeded = dinnerNeededFloor + dinnerNeededKitchen;

    forecast.push({
      date: dayStr,
      dayName: dayDate.toLocaleDateString("en-IE", { weekday: "short" }),
      dayLong: dayDate.toLocaleDateString("en-IE", { weekday: "long", day: "numeric", month: "short" }),
      lunch: {
        covers: lunchCovers,
        staffRostered: lunchStaff,
        staffNeeded: lunchNeeded,
        status: lunchCovers === 0 ? "no_bookings" : lunchStaff >= lunchNeeded ? "ok" : "understaffed",
        gap: Math.max(0, lunchNeeded - lunchStaff),
      },
      dinner: {
        covers: dinnerCovers,
        staffRostered: dinnerStaff,
        staffNeeded: dinnerNeeded,
        status: dinnerCovers === 0 ? "no_bookings" : dinnerStaff >= dinnerNeeded ? "ok" : "understaffed",
        gap: Math.max(0, dinnerNeeded - dinnerStaff),
      },
      totalCovers: lunchCovers + dinnerCovers,
      totalStaff: dayShifts.length,
    });
  }

  const totalUnderstaffed = forecast.filter(
    (d) => d.lunch.status === "understaffed" || d.dinner.status === "understaffed"
  ).length;

  return NextResponse.json({ forecast, weekStart: toDateStr(weekStart), totalUnderstaffed });
}
