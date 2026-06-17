// @ts-nocheck
import { prisma } from "@/lib/db";

export interface StaffingForecast {
  date: string;
  totalCovers: number;
  scheduledShifts: {
    total: number;
    kitchen: number;
    bar: number;
    floor: number;
    management: number;
  };
  warnings: StaffingWarning[];
  recommendations: string[];
}

export interface StaffingWarning {
  type: "UNDERSTAFFED" | "KITCHEN_PRESSURE" | "BAR_PRESSURE" | "CRITICAL";
  message: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
}

// Matches shift.role strings — case-insensitive
function isRole(role: string, keyword: string) {
  return role.toLowerCase().includes(keyword.toLowerCase());
}

export async function generateStaffingForecast(
  businessId: string,
  date: string
): Promise<StaffingForecast> {
  const targetDate = new Date(date);
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  // Reservations for this day
  const reservations = await prisma.reservation.findMany({
    where: {
      businessId,
      date: { gte: startOfDay, lte: endOfDay },
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
    },
  });

  const totalCovers = reservations.reduce((sum, r) => sum + r.partySize, 0);

  // Shifts for this day — Shift has no businessId, query via employee relation
  const shifts = await prisma.shift.findMany({
    where: {
      date: { gte: startOfDay, lte: endOfDay },
      employee: { businessId },
    },
  });

  const shiftCounts = {
    total: shifts.length,
    kitchen: shifts.filter((s) => isRole(s.role, "kitchen")).length,
    bar: shifts.filter((s) => isRole(s.role, "bar")).length,
    floor: shifts.filter(
      (s) => isRole(s.role, "floor") || isRole(s.role, "waiter") || isRole(s.role, "server")
    ).length,
    management: shifts.filter(
      (s) => isRole(s.role, "manager") || isRole(s.role, "management")
    ).length,
  };

  const warnings: StaffingWarning[] = [];
  const recommendations: string[] = [];

  // Per-reservation checks
  for (const reservation of reservations) {
    const party = reservation.partySize;
    const timeStr = reservation.time.toLocaleTimeString("en-IE", {
      hour: "2-digit",
      minute: "2-digit",
    });

    if (party >= 20 && shiftCounts.total < 5) {
      warnings.push({
        type: "CRITICAL",
        message: `Reservation for ${party} guests at ${timeStr} requires at least 5 staff on shift.`,
        severity: "HIGH",
      });
      recommendations.push(
        `Schedule at least ${5 - shiftCounts.total} more staff for the ${timeStr} reservation.`
      );
    }

    if (party >= 10 && shiftCounts.kitchen < 2) {
      warnings.push({
        type: "KITCHEN_PRESSURE",
        message: `Party of ${party} at ${timeStr} requires 2+ kitchen staff. Currently ${shiftCounts.kitchen} scheduled.`,
        severity: party >= 15 ? "HIGH" : "MEDIUM",
      });
      if (!recommendations.some((r) => r.includes("kitchen"))) {
        recommendations.push(
          `Add at least ${2 - shiftCounts.kitchen} kitchen staff shift(s) to handle large party bookings.`
        );
      }
    }

    if (party >= 15 && shiftCounts.bar < 2) {
      warnings.push({
        type: "BAR_PRESSURE",
        message: `Party of ${party} at ${timeStr} requires 2+ bar staff. Currently ${shiftCounts.bar} scheduled.`,
        severity: "MEDIUM",
      });
      if (!recommendations.some((r) => r.includes("bar"))) {
        recommendations.push(
          `Add at least ${2 - shiftCounts.bar} bar staff shift(s) for large party service.`
        );
      }
    }
  }

  // Day-level checks
  if (totalCovers > 50 && shiftCounts.total < 4) {
    warnings.push({
      type: "UNDERSTAFFED",
      message: `${totalCovers} total covers expected but only ${shiftCounts.total} staff scheduled.`,
      severity: "HIGH",
    });
    recommendations.push(
      "Consider scheduling additional floor staff for peak service."
    );
  }

  if (totalCovers > 80 && shiftCounts.kitchen < 2) {
    const already = warnings.some((w) => w.type === "KITCHEN_PRESSURE");
    if (!already) {
      warnings.push({
        type: "KITCHEN_PRESSURE",
        message: `High volume day (${totalCovers} covers) with only ${shiftCounts.kitchen} kitchen staff.`,
        severity: "HIGH",
      });
    }
  }

  if (warnings.length === 0) {
    recommendations.push(
      "Staffing levels look appropriate for current bookings."
    );
  }

  return {
    date,
    totalCovers,
    scheduledShifts: shiftCounts,
    warnings,
    recommendations,
  };
}
