/**
 * The one list of Reservation.status values. The column is a free-text String,
 * so this is the contract every route, page and report should use.
 */
export const RESERVATION_STATUSES = [
  "pending", // public-page request awaiting a human
  "confirmed",
  "seated",
  "completed",
  "cancelled",
  "no_show",
] as const;

export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export const NO_SHOW: ReservationStatus = "no_show";

/** Statuses that never count as a visit or as expected covers. */
export const NON_ATTENDING_STATUSES: readonly ReservationStatus[] = ["cancelled", "no_show"];

/** Statuses that are finished — not "upcoming" any more. */
export const CLOSED_STATUSES: readonly ReservationStatus[] = ["cancelled", "no_show", "completed"];

/**
 * Map any legacy/variant spelling to the canonical value.
 * Returns null for anything that isn't a known status.
 */
export function normaliseReservationStatus(raw: unknown): ReservationStatus | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (s === "noshow") return "no_show";
  return (RESERVATION_STATUSES as readonly string[]).includes(s) ? (s as ReservationStatus) : null;
}

export function isNonAttending(status: string | null | undefined): boolean {
  const s = normaliseReservationStatus(status);
  return s === "cancelled" || s === "no_show";
}
