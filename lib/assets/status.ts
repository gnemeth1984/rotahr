/**
 * Asset register status derivation.
 *
 * Lives in one place because three callers need identical answers: the list
 * API (badges), the weekly digest cron (what to email) and the UI (sorting).
 * When the cert module duplicated this logic the page and the cron disagreed
 * about what "expiring soon" meant, so this is deliberately shared.
 *
 * Nothing here is stored. Status is always derived from the dates, so a row
 * cannot go stale just because no job ran.
 */

export const WARRANTY_SOON_DAYS = 60; // longer lead than certs: you need time to claim
export const SERVICE_SOON_DAYS = 30;
/** Replacement needs the longest lead of all — it is a budget decision, not a
 *  phone call. */
export const REPLACE_SOON_DAYS = 90;

/**
 * Lead times for the advance warnings, longest first.
 *
 * Two stages on purpose: 30 days is "book the engineer", 7 days is "you still
 * have not booked the engineer". One reminder a month out gets read and
 * forgotten; one a week out arrives too late to arrange cover.
 */
export const REMINDER_STAGES = [30, 7] as const;
export type ReminderStage = (typeof REMINDER_STAGES)[number];
export type ReminderKind = "service" | "warranty" | "replace";

/** How long an already-passed date keeps showing up. Stops the digest nagging
 *  forever about a warranty that lapsed two years ago. */
export const RECENTLY_PASSED_DAYS = 90;

export type WarrantyStatus = "NO_WARRANTY" | "EXPIRED" | "EXPIRING_SOON" | "VALID";
export type ServiceStatus = "NO_SCHEDULE" | "OVERDUE" | "DUE_SOON" | "SCHEDULED";
export type ReplaceStatus = "NO_TARGET" | "OVERDUE" | "DUE_SOON" | "SCHEDULED";

export const ASSET_CATEGORIES = [
  "refrigeration",
  "cooking",
  "dishwashing",
  "bar",
  "coffee",
  "hvac",
  "plumbing",
  "electrical",
  "pos",
  "furniture",
  "other",
] as const;
export type AssetCategory = (typeof ASSET_CATEGORIES)[number];

export const ASSET_STATUSES = [
  "active",
  "faulty",
  "awaiting_parts",
  "out_of_service",
  "retired",
] as const;

export const SERVICE_KINDS = ["service", "repair", "inspection", "installation", "callout"] as const;

export const DOC_KINDS = ["warranty", "invoice", "service_report", "manual", "photo", "other"] as const;

/** Maps a HACCPEquipment.equipType onto an asset category so imported units
 *  land in a sensible bucket instead of "other". */
export function categoryForEquipType(equipType: string): AssetCategory {
  switch (equipType) {
    case "fridge":
    case "freezer":
    case "cooling":
      return "refrigeration";
    case "hot_holding":
    case "cooking":
      return "cooking";
    default:
      return "other";
  }
}

export function daysUntil(date: Date | null | undefined, now: Date = new Date()): number | null {
  if (!date) return null;
  return Math.round((date.getTime() - now.getTime()) / 86400000);
}

export function warrantyStatus(
  warrantyExpiry: Date | null | undefined,
  now: Date = new Date()
): WarrantyStatus {
  const days = daysUntil(warrantyExpiry, now);
  if (days === null) return "NO_WARRANTY";
  if (days < 0) return "EXPIRED";
  if (days <= WARRANTY_SOON_DAYS) return "EXPIRING_SOON";
  return "VALID";
}

export function serviceStatus(
  nextServiceDate: Date | null | undefined,
  now: Date = new Date()
): ServiceStatus {
  const days = daysUntil(nextServiceDate, now);
  if (days === null) return "NO_SCHEDULE";
  if (days < 0) return "OVERDUE";
  if (days <= SERVICE_SOON_DAYS) return "DUE_SOON";
  return "SCHEDULED";
}

export function replaceStatus(
  replaceByDate: Date | null | undefined,
  now: Date = new Date()
): ReplaceStatus {
  const days = daysUntil(replaceByDate, now);
  if (days === null) return "NO_TARGET";
  if (days < 0) return "OVERDUE";
  if (days <= REPLACE_SOON_DAYS) return "DUE_SOON";
  return "SCHEDULED";
}

/** True when this asset should appear in the weekly digest. */
export function needsAttention(
  asset: { warrantyExpiry: Date | null; nextServiceDate: Date | null; replaceByDate?: Date | null },
  now: Date = new Date()
): boolean {
  const w = warrantyStatus(asset.warrantyExpiry, now);
  const s = serviceStatus(asset.nextServiceDate, now);
  const r = replaceStatus(asset.replaceByDate ?? null, now);
  const wDays = daysUntil(asset.warrantyExpiry, now);
  const sDays = daysUntil(asset.nextServiceDate, now);
  const rDays = daysUntil(asset.replaceByDate ?? null, now);

  const warrantyRelevant =
    (w === "EXPIRING_SOON" || (w === "EXPIRED" && wDays !== null && wDays >= -RECENTLY_PASSED_DAYS));
  const serviceRelevant =
    (s === "DUE_SOON" || (s === "OVERDUE" && sDays !== null && sDays >= -RECENTLY_PASSED_DAYS));
  const replaceRelevant =
    (r === "DUE_SOON" || (r === "OVERDUE" && rDays !== null && rDays >= -RECENTLY_PASSED_DAYS));

  return warrantyRelevant || serviceRelevant || replaceRelevant;
}

/**
 * Which advance warnings are owed for one asset today.
 *
 * Returns a row per (kind, stage) whose due date falls inside that stage's
 * window but outside the next tighter one, so a date 20 days out yields the
 * 30-day warning only — never both at once. The caller de-duplicates against
 * AssetReminder before sending anything.
 *
 * Overdue dates are handled by the weekly digest, not here: an advance warning
 * for something already late would read as nonsense.
 */
export function dueReminders(
  asset: {
    nextServiceDate: Date | null;
    warrantyExpiry: Date | null;
    replaceByDate?: Date | null;
  },
  now: Date = new Date()
): { kind: ReminderKind; stage: ReminderStage; dueDate: Date; days: number }[] {
  const out: { kind: ReminderKind; stage: ReminderStage; dueDate: Date; days: number }[] = [];

  const fields: { kind: ReminderKind; date: Date | null }[] = [
    { kind: "service", date: asset.nextServiceDate },
    { kind: "warranty", date: asset.warrantyExpiry },
    { kind: "replace", date: asset.replaceByDate ?? null },
  ];

  for (const f of fields) {
    if (!f.date) continue;
    const days = daysUntil(f.date, now);
    if (days === null || days < 0) continue;

    // Stages are ordered widest first; pick the tightest one that still contains
    // this date so the 7-day warning supersedes the 30-day one.
    let matched: ReminderStage | null = null;
    for (const stage of REMINDER_STAGES) {
      if (days <= stage) matched = stage;
    }
    if (matched === null) continue;

    out.push({ kind: f.kind, stage: matched, dueDate: f.date, days });
  }

  return out;
}

/**
 * Rolls a service date forward by the interval.
 *
 * Uses setMonth, so a 6-month interval from 31 Aug gives 28/29 Feb rather than
 * silently landing in March. Returns null when there is no interval — a one-off
 * repair must not invent a schedule that was never set.
 */
export function rollNextService(
  servicedOn: Date,
  intervalMonths: number | null | undefined
): Date | null {
  if (!intervalMonths || intervalMonths <= 0) return null;
  const next = new Date(servicedOn.getTime());
  const targetMonth = next.getMonth() + intervalMonths;
  const dayOfMonth = next.getDate();
  next.setDate(1);
  next.setMonth(targetMonth);
  // Clamp to the last valid day of the landing month.
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(dayOfMonth, lastDay));
  return next;
}

/** Sort key: the most urgent thing first, so the list reads as a worklist. */
export function urgencyRank(
  asset: { warrantyExpiry: Date | null; nextServiceDate: Date | null; status: string },
  now: Date = new Date()
): number {
  if (asset.status === "out_of_service" || asset.status === "faulty") return 0;
  const s = serviceStatus(asset.nextServiceDate, now);
  const w = warrantyStatus(asset.warrantyExpiry, now);
  if (s === "OVERDUE") return 1;
  if (w === "EXPIRING_SOON") return 2;
  if (s === "DUE_SOON") return 3;
  if (asset.status === "awaiting_parts") return 4;
  if (w === "EXPIRED") return 5;
  return 6;
}

export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IE", { day: "2-digit", month: "short", year: "numeric" });
}
