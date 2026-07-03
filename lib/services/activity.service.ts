// @ts-nocheck
// Fire-and-forget activity logging — never throws, never blocks the caller.
import { prisma } from "@/lib/db";

export type ActivityAction =
  | "login"
  | "booking_created"
  | "expense_added"
  | "shift_published"
  | "clock_in"
  | "clock_out";

export async function logActivity({
  businessId,
  userId,
  userName,
  action,
  details,
}: {
  businessId?: string | null;
  userId?: string | null;
  userName?: string | null;
  action: ActivityAction | string;
  details?: Record<string, unknown>;
}) {
  try {
    await prisma.activityLog.create({
      data: {
        businessId: businessId ?? null,
        userId: userId ?? null,
        userName: userName ?? null,
        action,
        details: details ?? undefined,
      },
    });
  } catch (err) {
    console.error("[activity.service] Failed to log activity:", err);
  }
}
