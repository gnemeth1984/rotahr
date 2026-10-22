/**
 * Shared, memoised loaders. Every query is scoped by businessId (and venueId
 * when one is selected). Nothing here writes.
 */
import { prisma } from "@/lib/db";
import { memo, type CopilotScope } from "./types";
import { addDaysYmd, dayStartUtc, storedDateYmd, ymdToStoredRange } from "./time";

export const HISTORY_DAYS = 180;
export const AHEAD_DAYS = 14;

export interface ResRow {
  id: string;
  ymd: string;
  time: string;
  partySize: number;
  status: string;
  createdAt: Date;
  customerId: string | null;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  dietary: string | null;
  occasion: string | null;
  kitchenNotes: string | null;
  customer: {
    visitCount: number;
    loyaltyTier: string;
    vipSince: Date | null;
    allergies: string | null;
    dietaryNotes: string | null;
  } | null;
}

export function loadReservations(scope: CopilotScope): Promise<ResRow[]> {
  return memo(scope, "reservations", async () => {
    const rows = await prisma.reservation.findMany({
      where: {
        businessId: scope.businessId,
        date: ymdToStoredRange(addDaysYmd(scope.date, -HISTORY_DAYS), addDaysYmd(scope.date, AHEAD_DAYS)),
        ...(scope.venueId ? { venueId: scope.venueId } : {}),
      },
      select: {
        id: true,
        date: true,
        time: true,
        partySize: true,
        status: true,
        createdAt: true,
        customerId: true,
        customerName: true,
        customerEmail: true,
        customerPhone: true,
        dietary: true,
        occasion: true,
        kitchenNotes: true,
        customer: { select: { visitCount: true, loyaltyTier: true, vipSince: true, allergies: true, dietaryNotes: true } },
      },
    });
    return rows.map(({ date, ...r }) => ({ ...r, ymd: storedDateYmd(date) }));
  });
}

export type StaffBucket = "kitchen" | "floor" | "bar" | "other";

/** Same department/role keywords the rota and staffing forecast use. */
export function staffBucket(department: string | null | undefined, role: string | null | undefined): StaffBucket {
  const s = `${department ?? ""} ${role ?? ""}`.toLowerCase();
  if (/kitchen|chef|cook|\bkp\b|porter|pastry|commis/.test(s)) return "kitchen";
  if (/\bbar|bartend|mixolog|barista|cellar/.test(s)) return "bar";
  if (/floor|server|wait|host|foh|front|runner|sommelier|restaurant/.test(s)) return "floor";
  return "other";
}

export interface ShiftRow {
  id: string;
  ymd: string;
  startTime: Date;
  endTime: Date;
  published: boolean;
  bucket: StaffBucket;
  employeeId: string | null;
}

export function loadShifts(scope: CopilotScope, days = 8): Promise<ShiftRow[]> {
  return memo(scope, `shifts:${days}`, async () => {
    const rows = await prisma.shift.findMany({
      where: {
        employee: { businessId: scope.businessId },
        startTime: { gte: dayStartUtc(scope.date, scope.timezone), lt: dayStartUtc(addDaysYmd(scope.date, days), scope.timezone) },
        ...(scope.venueId ? { venueId: scope.venueId } : {}),
      },
      select: {
        id: true,
        date: true,
        startTime: true,
        endTime: true,
        published: true,
        role: true,
        employeeId: true,
        employee: { select: { role: true, department: { select: { name: true } } } },
      },
    });
    return rows.map((s) => ({
      id: s.id,
      ymd: storedDateYmd(s.date),
      startTime: s.startTime,
      endTime: s.endTime,
      published: s.published,
      employeeId: s.employeeId,
      bucket: staffBucket(s.employee?.department?.name, s.role ?? s.employee?.role),
    }));
  });
}

export interface StaffingSettings {
  kitchenRatio: number;
  floorRatio: number;
  minBarStaff: number;
  rotaWarningDaysAhead: number;
}

export function loadStaffingSettings(scope: CopilotScope): Promise<StaffingSettings> {
  return memo(scope, "aiSettings", async () => {
    const s = await prisma.aISettings.findUnique({
      where: { businessId: scope.businessId },
      select: { kitchenRatio: true, floorRatio: true, minBarStaff: true, rotaWarningDaysAhead: true },
    });
    return {
      kitchenRatio: s?.kitchenRatio || 20,
      floorRatio: s?.floorRatio || 15,
      minBarStaff: s?.minBarStaff ?? 1,
      rotaWarningDaysAhead: s?.rotaWarningDaysAhead ?? 3,
    };
  });
}
