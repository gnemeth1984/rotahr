// @ts-nocheck
import { prisma } from "@/lib/db";

export interface ConflictResult {
  hasConflicts: boolean;
  conflicts: ConflictDetail[];
  canProceed: boolean; // false only for hard blocks (double-booking)
}

export interface ConflictDetail {
  type: "TABLE_DOUBLE_BOOK" | "STAFFING_SHORTAGE" | "KITCHEN_OVERLOAD" | "PARTY_TOO_LARGE";
  severity: "HARD" | "WARN";
  message: string;
}

// Table occupancy window = ±2 hours (matches tableService.findAvailable)
const TABLE_WINDOW_MS = 2 * 60 * 60 * 1000;
const KITCHEN_RATIO = 20; // 1 kitchen staff per 20 covers
const FLOOR_RATIO = 15;   // 1 floor staff per 15 covers

export async function detectConflicts(params: {
  businessId: string;
  proposedDate: Date; // full date+time
  partySize: number;
  tableId?: string;
}): Promise<ConflictResult> {
  const { businessId, proposedDate, partySize, tableId } = params;
  const conflicts: ConflictDetail[] = [];

  const windowStart = new Date(proposedDate.getTime() - TABLE_WINDOW_MS);
  const windowEnd = new Date(proposedDate.getTime() + TABLE_WINDOW_MS);

  // 1. TABLE DOUBLE-BOOKING CHECK
  if (tableId) {
    const table = await prisma.table.findFirst({
      where: { id: tableId, businessId },
    });

    if (!table) {
      conflicts.push({
        type: "TABLE_DOUBLE_BOOK",
        severity: "HARD",
        message: `Table ${tableId} not found or doesn't belong to this business.`,
      });
    } else {
      // Check capacity
      if (partySize > table.capacity) {
        conflicts.push({
          type: "PARTY_TOO_LARGE",
          severity: "HARD",
          message: `Party of ${partySize} exceeds table capacity of ${table.capacity}.`,
        });
      }

      // Check overlapping reservations on this table
      const overlapping = await prisma.reservation.findFirst({
        where: {
          tableId,
          businessId,
          status: { not: "CANCELLED" },
          date: { gte: windowStart, lte: windowEnd },
        },
      });

      if (overlapping) {
        conflicts.push({
          type: "TABLE_DOUBLE_BOOK",
          severity: "HARD",
          message: `Table is already booked within 2 hours of ${proposedDate.toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit" })}.`,
        });
      }
    }
  }

  // 2. STAFFING + KITCHEN OVERLOAD CHECK
  const proposedHour = proposedDate.getHours();
  const startOfDay = new Date(proposedDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(proposedDate);
  endOfDay.setHours(23, 59, 59, 999);

  // Count total covers at this hour (existing + proposed)
  const reservationsAtHour = await prisma.reservation.findMany({
    where: {
      businessId,
      status: { not: "CANCELLED" },
      date: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
    select: { time: true, partySize: true },
  });

  const coversAtHour = reservationsAtHour
    .filter((r: { time: string; partySize: number }) => {
      const h = parseInt(r.time.split(":")[0], 10);
      return h === proposedHour;
    })
    .reduce((sum: number, r: { time: string; partySize: number }) => sum + r.partySize, 0);

  const totalCoversWithNew = coversAtHour + partySize;

  // Fetch shifts for this hour
  const shifts = await prisma.shift.findMany({
    where: {
      employee: { businessId },
      date: { gte: startOfDay, lte: endOfDay },
    },
    include: {
      employee: { include: { department: true } },
    },
  });

  let kitchenCount = 0;
  let floorCount = 0;

  for (const shift of shifts) {
    const start = new Date(shift.startTime).getHours();
    let end = new Date(shift.endTime).getHours();
    if (end <= start) end = start + 8;
    if (proposedHour >= start && proposedHour < end) {
      const deptName = (shift as any).employee?.department?.name ?? "";
      if (/kitchen|chef|cook/i.test(deptName)) kitchenCount++;
      if (/floor|waiter|server|front.?of.?house|foh/i.test(deptName)) floorCount++;
    }
  }

  const kitchenRequired = Math.ceil(totalCoversWithNew / KITCHEN_RATIO);
  const floorRequired = Math.ceil(totalCoversWithNew / FLOOR_RATIO);

  if (kitchenCount < kitchenRequired) {
    conflicts.push({
      type: "KITCHEN_OVERLOAD",
      severity: "WARN",
      message: `Kitchen may be overloaded at ${proposedHour}:00 — ${totalCoversWithNew} total covers but only ${kitchenCount} kitchen staff (need ${kitchenRequired}).`,
    });
  }

  if (floorCount < floorRequired) {
    conflicts.push({
      type: "STAFFING_SHORTAGE",
      severity: "WARN",
      message: `Floor understaffed at ${proposedHour}:00 — ${totalCoversWithNew} total covers but only ${floorCount} floor staff (need ${floorRequired}).`,
    });
  }

  const hasHardBlock = conflicts.some((c) => c.severity === "HARD");

  return {
    hasConflicts: conflicts.length > 0,
    conflicts,
    canProceed: !hasHardBlock,
  };
}
