// @ts-nocheck
import { prisma } from "@/lib/db";

export interface StaffingRecommendation {
  hour: number;
  expectedCovers: number;
  kitchenRequired: number;
  floorRequired: number;
  barWarning: boolean;
  kitchenOnShift: number;
  floorOnShift: number;
  barOnShift: number;
  kitchenShortfall: number;
  floorShortfall: number;
  issues: string[];
}

export interface StaffingForecast {
  date: string;
  businessId: string;
  recommendations: StaffingRecommendation[];
  summary: string;
}

// Default fallback ratios (overridden by business AISettings)
const DEFAULT_KITCHEN_RATIO = 20;
const DEFAULT_FLOOR_RATIO = 15;
const DEFAULT_MIN_BAR = 1;
const DEFAULT_BOOKING_THRESHOLD = 20;

export async function generateStaffingForecast(
  businessId: string,
  date: Date
): Promise<StaffingForecast> {
  // Load per-business AI settings
  const aiSettings = await prisma.aISettings.findUnique({
    where: { businessId },
  });
  const KITCHEN_RATIO = aiSettings?.kitchenRatio ?? DEFAULT_KITCHEN_RATIO;
  const FLOOR_RATIO = aiSettings?.floorRatio ?? DEFAULT_FLOOR_RATIO;
  const MIN_BAR = aiSettings?.minBarStaff ?? DEFAULT_MIN_BAR;
  const BOOKING_THRESHOLD = aiSettings?.bookingThresholdForStaffIncrease ?? DEFAULT_BOOKING_THRESHOLD;
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const dateStr = startOfDay.toISOString().split("T")[0];

  // Fetch all reservations for the day
  const reservations = await prisma.reservation.findMany({
    where: {
      businessId,
      date: {
        gte: startOfDay,
        lte: endOfDay,
      },
      status: { not: "CANCELLED" },
    },
    select: { time: true, partySize: true },
  });

  // Fetch shifts for the day
  const shifts = await prisma.shift.findMany({
    where: {
      employee: { businessId },
      date: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
    include: {
      employee: {
        include: { department: true },
      },
    },
  });

  // Build hourly covers map (hour -> total covers)
  const hourlyCovers: Record<number, number> = {};
  for (const res of reservations) {
    const timeParts = res.time.split(":");
    const hour = parseInt(timeParts[0], 10);
    hourlyCovers[hour] = (hourlyCovers[hour] || 0) + res.partySize;
  }

  // Build hourly staff counts from shifts
  // Shift startTime/endTime are DateTime fields — use .getHours()
  function parseShiftHours(shift: {
    startTime: Date | string;
    endTime: Date | string;
  }): number[] {
    const startDate = new Date(shift.startTime);
    const endDate = new Date(shift.endTime);
    const start = startDate.getHours();
    let end = endDate.getHours();
    if (end <= start) end = start + 8; // overnight fallback
    const hours: number[] = [];
    for (let h = start; h < end; h++) {
      hours.push(h % 24);
    }
    return hours;
  }

  // dept name normalisation helpers
  function isKitchen(deptName: string) {
    return /kitchen|chef|cook/i.test(deptName);
  }
  function isFloor(deptName: string) {
    return /floor|waiter|waitress|server|front.?of.?house|foh/i.test(deptName);
  }
  function isBar(deptName: string) {
    return /bar/i.test(deptName);
  }

  type HourlyStaff = { kitchen: number; floor: number; bar: number };
  const hourlyStaff: Record<number, HourlyStaff> = {};

  for (const shift of shifts) {
    const deptName = shift.employee?.department?.name ?? "";
    const hours = parseShiftHours(shift);
    for (const h of hours) {
      if (!hourlyStaff[h]) hourlyStaff[h] = { kitchen: 0, floor: 0, bar: 0 };
      if (isKitchen(deptName)) hourlyStaff[h].kitchen++;
      else if (isFloor(deptName)) hourlyStaff[h].floor++;
      else if (isBar(deptName)) hourlyStaff[h].bar++;
    }
  }

  // Build recommendations for every busy hour
  const busyHours = Object.keys(hourlyCovers)
    .map(Number)
    .sort((a, b) => a - b);

  const recommendations: StaffingRecommendation[] = busyHours.map((hour) => {
    const covers = hourlyCovers[hour] ?? 0;
    const staff = hourlyStaff[hour] ?? { kitchen: 0, floor: 0, bar: 0 };

    const kitchenRequired = Math.ceil(covers / KITCHEN_RATIO);
    const floorRequired = Math.ceil(covers / FLOOR_RATIO);
    const kitchenShortfall = Math.max(0, kitchenRequired - staff.kitchen);
    const floorShortfall = Math.max(0, floorRequired - staff.floor);

    const issues: string[] = [];
    if (kitchenShortfall > 0) {
      issues.push(
        `Need ${kitchenShortfall} more kitchen staff at ${hour}:00 (${covers} covers)`
      );
    }
    if (floorShortfall > 0) {
      issues.push(
        `Need ${floorShortfall} more floor staff at ${hour}:00 (${covers} covers)`
      );
    }
    if (staff.bar < MIN_BAR && covers > 0) {
      issues.push(`Need ${MIN_BAR} bar staff at ${hour}:00 (currently ${staff.bar})`);
    }

    return {
      hour,
      expectedCovers: covers,
      kitchenRequired,
      floorRequired,
      barWarning: staff.bar < MIN_BAR && covers > 0,
      kitchenOnShift: staff.kitchen,
      floorOnShift: staff.floor,
      barOnShift: staff.bar,
      kitchenShortfall,
      floorShortfall,
      issues,
    };
  });

  const totalIssues = recommendations.reduce(
    (acc, r) => acc + r.issues.length,
    0
  );
  const totalCovers = reservations.reduce((acc, r) => acc + r.partySize, 0);
  const thresholdWarning =
    totalCovers >= BOOKING_THRESHOLD
      ? ` High volume day (${totalCovers} covers) — consider adding extra staff.`
      : "";
  const summary =
    totalIssues === 0
      ? `Staffing looks good for ${dateStr}. All shifts are adequately covered.${thresholdWarning}`
      : `Found ${totalIssues} staffing issue(s) for ${dateStr}. Review recommendations below.${thresholdWarning}`;

  return {
    date: dateStr,
    businessId,
    recommendations,
    summary,
  };
}
