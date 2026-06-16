// @ts-nocheck
import { prisma } from "@/lib/db";

export interface ConflictReport {
  hasConflicts: boolean;
  conflicts: ConflictItem[];
  coverPressureWarnings: CoverPressureWarning[];
}

export interface ConflictItem {
  type: "TABLE_DOUBLE_BOOKED" | "CAPACITY_EXCEEDED" | "TIME_OVERLAP";
  message: string;
  reservationIds: string[];
  severity: "LOW" | "MEDIUM" | "HIGH";
}

export interface CoverPressureWarning {
  windowStart: string;
  windowEnd: string;
  totalCovers: number;
  reservationCount: number;
  message: string;
}

const COVER_PRESSURE_THRESHOLD = 80;
const OVERLAP_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 hours in ms

export async function detectConflicts(
  businessId: string,
  date: string
): Promise<ConflictReport> {
  const targetDate = new Date(date);
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  // Fetch reservations by the `date` field
  const reservations = await prisma.reservation.findMany({
    where: {
      businessId,
      date: {
        gte: startOfDay,
        lte: endOfDay,
      },
      status: {
        notIn: ["CANCELLED", "NO_SHOW"],
      },
    },
    orderBy: { time: "asc" },
  });

  const conflicts: ConflictItem[] = [];
  const coverPressureWarnings: CoverPressureWarning[] = [];

  // --- Table double-booking detection ---
  const tableReservations = reservations.filter((r) => r.tableId !== null);

  for (let i = 0; i < tableReservations.length; i++) {
    for (let j = i + 1; j < tableReservations.length; j++) {
      const a = tableReservations[i];
      const b = tableReservations[j];

      if (a.tableId !== b.tableId) continue;

      const aTime = a.time.getTime();
      const bTime = b.time.getTime();

      if (Math.abs(aTime - bTime) < OVERLAP_WINDOW_MS) {
        conflicts.push({
          type: "TABLE_DOUBLE_BOOKED",
          message: `Table ${a.tableId} is double-booked: reservations at ${a.time.toLocaleTimeString()} and ${b.time.toLocaleTimeString()} overlap within 2hr window.`,
          reservationIds: [a.id, b.id],
          severity: "HIGH",
        });
      }
    }
  }

  // --- Cover pressure detection (rolling 2hr windows) ---
  for (const anchor of reservations) {
    const windowStart = anchor.time.getTime();
    const windowEnd = windowStart + OVERLAP_WINDOW_MS;

    const inWindow = reservations.filter((r) => {
      const t = r.time.getTime();
      return t >= windowStart && t <= windowEnd;
    });

    const totalCovers = inWindow.reduce((sum, r) => sum + r.partySize, 0);

    if (totalCovers > COVER_PRESSURE_THRESHOLD) {
      const alreadyReported = coverPressureWarnings.some(
        (w) => w.windowStart === new Date(windowStart).toISOString()
      );
      if (!alreadyReported) {
        coverPressureWarnings.push({
          windowStart: new Date(windowStart).toISOString(),
          windowEnd: new Date(windowEnd).toISOString(),
          totalCovers,
          reservationCount: inWindow.length,
          message: `${totalCovers} covers expected between ${new Date(windowStart).toLocaleTimeString()} and ${new Date(windowEnd).toLocaleTimeString()} — kitchen pressure likely.`,
        });
      }
    }
  }

  // --- Capacity exceeded detection ---
  const tables = await prisma.table.findMany({
    where: { businessId },
  });

  for (const reservation of reservations) {
    if (!reservation.tableId) continue;
    const table = tables.find((t) => t.id === reservation.tableId);
    if (!table) continue;

    if (reservation.partySize > table.capacity) {
      conflicts.push({
        type: "CAPACITY_EXCEEDED",
        message: `Reservation for ${reservation.partySize} guests assigned to table "${table.name}" (capacity: ${table.capacity}).`,
        reservationIds: [reservation.id],
        severity: "HIGH",
      });
    }
  }

  return {
    hasConflicts: conflicts.length > 0,
    conflicts,
    coverPressureWarnings,
  };
}

/**
 * Quick check: does a specific table have a conflicting reservation
 * within ±2 hours of the given time on the same date?
 */
export async function checkSingleReservationConflicts(
  businessId: string,
  tableId: string,
  date: Date,
  time: Date,
  excludeReservationId?: string
): Promise<boolean> {
  const dateStart = new Date(date);
  dateStart.setHours(0, 0, 0, 0);
  const dateEnd = new Date(date);
  dateEnd.setHours(23, 59, 59, 999);

  const windowStart = new Date(time.getTime() - OVERLAP_WINDOW_MS);
  const windowEnd = new Date(time.getTime() + OVERLAP_WINDOW_MS);

  const existing = await prisma.reservation.findFirst({
    where: {
      businessId,
      tableId,
      date: { gte: dateStart, lte: dateEnd },
      time: { gte: windowStart, lte: windowEnd },
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
      ...(excludeReservationId ? { NOT: { id: excludeReservationId } } : {}),
    },
  });

  return existing !== null;
}
