/**
 * lib/marketing/founding.ts — the founding member programme, in one place.
 *
 * WHAT THIS IS
 *
 * The first 20 venues get Pro free for 12 months. In exchange they agree to a
 * short call once a month and a testimonial *if* they end up liking it. That
 * conditional matters: a testimonial promised in advance is worthless to
 * readers and dishonest to ask for, so the offer is not contingent on a good
 * one.
 *
 * WHY IT IS BUILT THIS WAY
 *
 * A grant is not a new access tier. It sets lsPlan = "pro" and trialEndsAt to
 * 12 months out, which lib/billing/access.ts already understands, so nothing
 * new gates anything and there is no second code path to keep correct. When the
 * 12 months lapse the business drops to read-only like any other expired trial
 * — they keep every rota, timesheet and HACCP record they entered, forever.
 *
 * `Business.foundingMember` exists to count, list and revoke the programme.
 * Do not read it to decide what a business can do.
 *
 * WHY 20 AND WHY A COUNTDOWN
 *
 * The count shown publicly is the real number of granted spots, read from the
 * database. If it ever needs to be a marketing fiction, delete the counter
 * rather than hardcoding a lie. Scarcity that isn't real is the fastest way to
 * lose the only asset a new product has.
 */

import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";

/** Total founding spots. Raising this later is fine; lowering it is not. */
export const TOTAL_SPOTS = 20;

/** Months of free Pro a founding member receives. */
export const TERM_MONTHS = 12;

/** The plan a grant confers. Must be a real plan name from plans.ts. */
export const GRANTED_PLAN = "pro";

/** What a founding member gets. Every line must be true today, not planned. */
export const FOUNDING_GETS = [
  "Everything on Pro, free for 12 months — up to 30 staff",
  "Rotas, clock-in with geofencing, timesheets and payroll summaries",
  "HACCP temperature, cleaning, delivery and opening/closing logs with PDF export for inspections",
  "Reservations, floor plan and the customer CRM",
  "Bookkeeping with AI receipt and delivery note scanning",
  "The iOS and Android app for your whole team",
  "Your feature requests go to the front of the queue, and you talk to the founder, not a ticket",
] as const;

/** What we ask in return. Deliberately small and deliberately explicit. */
export const FOUNDING_ASKS = [
  "A 20 minute call once a month, so we can watch you actually use it and fix what gets in your way",
  "Tell us when something is broken or annoying, rather than quietly stopping",
  "A testimonial or a review at the end — only if you genuinely like it by then",
] as const;

/**
 * Honest limitations, stated before someone signs up rather than discovered
 * afterwards. Every one of these is a real, current constraint.
 */
export const FOUNDING_CAVEATS = [
  "There is no importer yet. Your staff list and rota get typed in, or we do it with you on the first call.",
  "Break-time rules are modelled on Irish law. Outside Ireland the tracking still works, but check the thresholds against your own rules.",
  "The app is English only.",
  "Revenue is tracked for the business as a whole, not per site, because POS snapshots arrive business-wide.",
  "Rotahr records what you did; it does not make you compliant. An inspector still wants to see the records, and this is where you keep them.",
] as const;

export type FoundingStatus = {
  /** Spots granted so far. */
  taken: number;
  /** Spots left, floored at zero. */
  remaining: number;
  total: number;
  /** True once every spot is gone — the page switches to a waiting list. */
  full: boolean;
};

async function readTaken(): Promise<number> {
  try {
    return await prisma.business.count({ where: { foundingMember: true } });
  } catch (err) {
    // A counter is not worth a 500 on the homepage. Fail to "all spots open",
    // which is the state that predates the programme and is safe to show.
    console.error("[founding] count failed", err);
    return 0;
  }
}

/**
 * Cached so the marketing pages do not hit the database on every visit — Neon
 * compute is billed by the second and the homepage is the highest-traffic page
 * on the site. Five minutes is far tighter than the real rate of change here.
 */
const cachedTaken = unstable_cache(readTaken, ["founding-taken"], {
  revalidate: 300,
  tags: ["founding"],
});

export async function foundingStatus(): Promise<FoundingStatus> {
  const taken = Math.max(0, Math.min(await cachedTaken(), TOTAL_SPOTS));
  const remaining = Math.max(0, TOTAL_SPOTS - taken);
  return { taken, remaining, total: TOTAL_SPOTS, full: remaining === 0 };
}

/** The date a grant made now would run until. */
export function foundingEndsAt(from = new Date()): Date {
  const end = new Date(from);
  end.setMonth(end.getMonth() + TERM_MONTHS);
  return end;
}
