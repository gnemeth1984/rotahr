/**
 * Trial expiry and subscription access state.
 *
 * THE RULE THIS MODULE EXISTS TO ENFORCE
 *
 * When a trial ends without a subscription, Rotahr stops accepting new work.
 * It does not stop showing you yours. Rotas, timesheets, HACCP records,
 * bookings, invoices and reports all stay readable and exportable, forever.
 *
 * This is deliberate. A venue's HACCP log is a legal record an inspector can
 * ask for, and their timesheets are the evidence behind wages already worked.
 * Holding either hostage to convert a trial would be indefensible, and for the
 * HACCP records arguably unlawful. Read-only is the honest version of a
 * paywall: we stop giving you more, we never take away what you already put in.
 *
 * Two things keep working no matter what, because breaking them causes real
 * damage rather than mild friction:
 *
 *   1. Anyone already on shift can still CLOCK OUT. Stranding an open timesheet
 *      is a payroll problem, not a conversion tactic. (Clock IN is blocked —
 *      that is new work.)
 *   2. Billing, auth and support always reach us. Locking someone out of the
 *      page where they would pay us is self-defeating.
 *
 * DESIGN: FAIL OPEN, ALWAYS.
 *
 * Every unknown resolves to full access. We only ever downgrade when we
 * positively know both that the business is unpaid AND that a trial deadline
 * has already passed. A null `trialEndsAt` means "no deadline" and is treated
 * as unlimited — which is exactly how every business that existed before this
 * feature shipped is backfilled, so no live venue can be locked by the deploy
 * that introduced this.
 *
 * The cost of failing open is that somebody gets a few extra free days. The
 * cost of failing closed is that a chef cannot record a fridge temperature
 * during a health inspection. Those are not comparable, so the choice is not
 * close.
 */

export type AccessMode = "full" | "readonly";

export type AccessReason =
  | "subscribed"
  | "trialing"
  | "no_deadline"
  | "unknown"
  | "trial_expired"
  | "subscription_lapsed";

export interface AccessState {
  mode: AccessMode;
  reason: AccessReason;
  /** Whole days left in the trial. 0 once expired, null when not trialing. */
  daysLeft: number | null;
  trialEndsAt: Date | null;
  /** True while trialing with a week or less to go — drives the banner. */
  warn: boolean;
}

export interface AccessInput {
  /** Business.lsStatus — "active" | "cancelled" | "past_due" | "none" | null */
  lsStatus?: string | null;
  /** Business.trialEndsAt — null means no deadline, i.e. never restrict. */
  trialEndsAt?: Date | string | null;
  now?: Date;
}

/** Statuses that mean the business is paying us. Anything else is not. */
const PAYING = new Set(["active", "on_trial"]);

/** Show the countdown banner at this many days remaining or fewer. */
export const WARN_WITHIN_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Pure, dependency-free so it can run in Edge middleware, on the server, and
 * in tests without a database.
 */
export function computeAccess(input: AccessInput): AccessState {
  const now = input.now ?? new Date();

  // Paying beats everything, including an expired trial date we never cleared.
  if (input.lsStatus && PAYING.has(input.lsStatus)) {
    return {
      mode: "full",
      reason: "subscribed",
      daysLeft: null,
      trialEndsAt: null,
      warn: false,
    };
  }

  const raw = input.trialEndsAt;

  // No deadline recorded => unlimited. This is the backfill state for every
  // business that predates the feature, and the fail-open default.
  if (raw === null || raw === undefined || raw === "") {
    return {
      mode: "full",
      reason: "no_deadline",
      daysLeft: null,
      trialEndsAt: null,
      warn: false,
    };
  }

  const ends = raw instanceof Date ? raw : new Date(raw);

  // Unparseable date => we know nothing => allow.
  if (Number.isNaN(ends.getTime())) {
    return {
      mode: "full",
      reason: "unknown",
      daysLeft: null,
      trialEndsAt: null,
      warn: false,
    };
  }

  const msLeft = ends.getTime() - now.getTime();

  if (msLeft > 0) {
    const daysLeft = Math.ceil(msLeft / DAY_MS);
    return {
      mode: "full",
      reason: "trialing",
      daysLeft,
      trialEndsAt: ends,
      warn: daysLeft <= WARN_WITHIN_DAYS,
    };
  }

  // Expired, and not paying. The only path to read-only.
  return {
    mode: "readonly",
    reason: input.lsStatus === "cancelled" || input.lsStatus === "past_due"
      ? "subscription_lapsed"
      : "trial_expired",
    daysLeft: 0,
    trialEndsAt: ends,
    warn: true,
  };
}

/** Length of a new trial. Matches what the pricing page promises. */
export const TRIAL_DAYS = 30;

export function newTrialEndsAt(from: Date = new Date()): Date {
  return new Date(from.getTime() + TRIAL_DAYS * DAY_MS);
}

/**
 * API paths that stay writable in read-only mode.
 *
 * Matched as prefixes against the pathname. Keep this list short and keep the
 * justification with each entry — every addition is a hole in the gate.
 */
export const ALWAYS_WRITABLE: readonly string[] = [
  "/api/auth", // signing in and out must never be blocked
  "/api/billing", // the page where they pay us
  "/api/webhooks", // Lemon Squeezy telling us they just paid
  "/api/cron", // scheduled jobs authenticate with CRON_SECRET, not a session
  "/api/clock", // clock OUT must work; the route itself blocks clock IN
  "/api/help", // reaching support
  "/api/notifications", // marking a notification read is not new work
  "/api/app-notifications", // same
  "/api/push-subscription", // keeping an existing device registered
  "/api/track", // analytics beacons
  "/api/unsubscribe", // legally must keep working
  "/api/demo", // demo tenants are not real customers
  "/api/navigator", // private super-admin tool, not tenant data
];

export function isAlwaysWritable(pathname: string): boolean {
  return ALWAYS_WRITABLE.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}

/** Methods that create or change data. */
export function isWriteMethod(method: string): boolean {
  const m = method.toUpperCase();
  return m === "POST" || m === "PUT" || m === "PATCH" || m === "DELETE";
}

/** The 402 body returned to a blocked write. */
export function readOnlyPayload(state: AccessState) {
  return {
    error: "read_only",
    reason: state.reason,
    message:
      state.reason === "subscription_lapsed"
        ? "Your subscription has lapsed, so Rotahr is read-only. Everything you have recorded stays readable and exportable. Restart your plan to add new records."
        : "Your free trial has ended, so Rotahr is read-only. Everything you have recorded stays readable and exportable. Choose a plan to start adding new records again.",
    trialEndsAt: state.trialEndsAt?.toISOString() ?? null,
    billingUrl: "/settings/billing",
  };
}
