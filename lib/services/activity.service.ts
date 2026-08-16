// @ts-nocheck
// Fire-and-forget activity logging — never throws, never blocks the caller.
import { prisma } from "@/lib/db";

/**
 * The vocabulary of things worth recording.
 *
 * This list was three entries long (login, booking_created, shift_published)
 * and over a full month it captured 107 logins, 2 bookings and 3 rota
 * publishes. That is not a record of anybody's work — it made the question
 * "what have I actually been doing in Rotahr?" literally unanswerable, and it
 * made every adoption number a guess.
 *
 * Rule for adding to this list: log the COMPLETION of a meaningful unit of
 * work, not every mutation. A log that fires on each keystroke is as useless as
 * one that never fires — the signal has to survive being counted.
 *
 * Never put personal data in `details`. It feeds Navigator, and Navigator feeds
 * an external model. Ids, counts and short labels only.
 */
export type ActivityAction =
  // access
  | "login"
  // bookings
  | "booking_created"
  | "booking_cancelled"
  // rota & time
  | "shift_published"
  | "shift_created"
  | "shift_swapped"
  | "clock_in"
  | "clock_out"
  | "timeoff_requested"
  | "timeoff_decided"
  // money
  | "expense_added"
  | "receipt_scanned"
  | "tips_distributed"
  // kitchen & compliance
  | "haccp_logged"
  | "cert_added"
  | "wastage_logged"
  | "delivery_scanned"
  // stock & menu
  | "stock_item_added"
  | "stock_ordered"
  | "recipe_added"
  | "special_posted"
  // ops
  | "ops_task_created"
  | "ops_task_completed"
  | "log_entry_created"
  // customers
  | "crm_note_added"
  | "crm_email_sent"
  // admin
  | "settings_changed"
  | "employee_added";

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
