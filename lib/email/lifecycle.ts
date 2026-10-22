import { prisma } from "@/lib/db";
import { REAL_CUSTOMER_WHERE } from "@/lib/tenancy/real-business";
import { computeAccess } from "@/lib/billing/access";
import { getActivationMany, type ActivationProgress } from "@/lib/activation/progress";
import { isSuppressed, unsubscribeUrl } from "@/lib/email/suppression";
import { isUnroutableAddress, sendEmail } from "@/lib/email/send";
import { PLANS } from "@/lib/seo/product-facts";

/**
 * Behaviour-triggered lifecycle email for trial signups.
 *
 * One email per missing setup step, sent only while the business is in its free
 * trial, at most once per step per business, and never more often than one
 * lifecycle email every MIN_GAP_DAYS. Which email a venue gets depends on what
 * it has actually done (lib/activation/progress), not on a calendar drip, so a
 * venue that set everything up on day one never hears from this at all.
 *
 * SAFETY
 *  - planLifecycle() is read-only: it works out who would get what and renders
 *    the email. The admin Funnel tab and the cron's default mode both use it.
 *  - runLifecycle({ dryRun: false }) refuses to send unless the environment has
 *    LIFECYCLE_EMAILS_ENABLED=1. That variable is not set anywhere and the cron
 *    is not scheduled in vercel.json; switching it on is a deliberate decision.
 *  - Suppressed (unsubscribed), demo and unroutable addresses are skipped.
 *  - Sends are recorded in ActivityLog (action "lifecycle_email") and that log
 *    is the idempotency key, so no schema change is needed.
 */

export type LifecycleKey = "no_staff" | "no_rota" | "no_invite" | "setup_help" | "trial_ending";

export const LIFECYCLE_KEYS: LifecycleKey[] = ["trial_ending", "no_staff", "no_rota", "no_invite", "setup_help"];

export const LIFECYCLE_LABEL: Record<LifecycleKey, string> = {
  no_staff: "No staff added (day 1+)",
  no_rota: "Staff added, no rota published (day 2+)",
  no_invite: "Rota published, team not invited (1 day after publish)",
  setup_help: "Still not set up after a week — founder offer to help",
  trial_ending: "Free months end within 7 days",
};

const MIN_GAP_DAYS = 3;
const DAY = 24 * 60 * 60 * 1000;
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://rotahr.com";
const LOG_ACTION = "lifecycle_email";

export interface LifecycleContext {
  firstName: string;
  businessName: string;
  email: string;
  daysSinceSignup: number;
  progress: ActivationProgress;
  trialEndsAt: Date | null;
  trialDaysLeft: number | null;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export interface LifecyclePlanItem {
  businessId: string;
  businessName: string;
  createdAt: string;
  to: string | null;
  key: LifecycleKey | null;
  /** Why this business gets this email, or why it gets nothing. */
  reason: string;
  /** Set when the business qualifies but must not be mailed. */
  skip: string | null;
  email: RenderedEmail | null;
  lastSentAt: string | null;
  sentKeys: LifecycleKey[];
}

// ─── Templates ────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function layout(opts: { ctx: LifecycleContext; paragraphs: string[]; cta?: { label: string; href: string }; ps?: string }) {
  const { ctx } = opts;
  const unsub = unsubscribeUrl(ctx.email, BASE_URL);
  const hi = ctx.firstName ? `Hi ${esc(ctx.firstName)},` : "Hi,";
  const body = opts.paragraphs.map((p) => `<p style="margin:0 0 14px">${p}</p>`).join("\n    ");
  const cta = opts.cta
    ? `<p style="margin:20px 0 22px"><a href="${opts.cta.href}" style="display:inline-block;background:#ff6b35;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;font-size:15px">${esc(opts.cta.label)}</a></p>`
    : "";
  const ps = opts.ps ? `<p style="margin:16px 0 0;color:#475569;font-size:14px">${opts.ps}</p>` : "";
  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;max-width:560px;margin:0 auto;color:#1f2937;font-size:15px;line-height:1.6;padding:8px">
    <p style="margin:0 0 14px">${hi}</p>
    ${body}
    ${cta}
    <p style="margin:18px 0 4px">Gabor</p>
    <p style="margin:0;color:#6b7280;font-size:13px">Founder, Rotahr &middot; former chef</p>
    ${ps}
    <div style="border-top:1px solid #e5e7eb;margin:24px 0 0;padding-top:14px;color:#9ca3af;font-size:12px;line-height:1.5">
      <p style="margin:0">You're getting this because you started a Rotahr account for ${esc(ctx.businessName)}. Rotahr, Ireland.</p>
      <p style="margin:6px 0 0"><a href="${unsub}" style="color:#6b7280">Unsubscribe</a> &mdash; one click, takes effect immediately.</p>
    </div>
  </div>`;

  const strip = (s: string) =>
    s
      .replace(/<a [^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g, "$2 ($1)")
      .replace(/<[^>]+>/g, "")
      .replace(/&mdash;/g, "—")
      .replace(/&middot;/g, "·")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&euro;/g, "€")
      .replace(/&rsquo;/g, "'");
  const text = [
    ctx.firstName ? `Hi ${ctx.firstName},` : "Hi,",
    ...opts.paragraphs.map(strip),
    ...(opts.cta ? [`${opts.cta.label}: ${opts.cta.href}`] : []),
    "Gabor\nFounder, Rotahr · former chef",
    ...(opts.ps ? [strip(opts.ps)] : []),
    `--\nYou're getting this because you started a Rotahr account for ${ctx.businessName}.\nUnsubscribe: ${unsub}`,
  ].join("\n\n");
  return { html, text };
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-IE", { weekday: "long", day: "numeric", month: "long" });
}

export function renderLifecycle(key: LifecycleKey, ctx: LifecycleContext): RenderedEmail {
  const biz = esc(ctx.businessName);
  const p = ctx.progress;
  const drafts = p.shiftCount - p.publishedShiftCount;

  switch (key) {
    case "no_staff": {
      const r = layout({
        ctx,
        paragraphs: [
          `You set up <strong>${biz}</strong> on Rotahr, but there's nobody on the team yet &mdash; and a rota without staff is just an empty grid.`,
          `Names and emails are all it needs to start. If you already have a staff list in payroll, Excel or Google Sheets, export it as a CSV and import the lot in one go &mdash; you'll see a preview before anything is saved.`,
        ],
        cta: { label: "Add your team", href: `${BASE_URL}/employees` },
        ps: `If it's easier, just reply with your staff list (names and emails) and I'll put them in for you.`,
      });
      return { subject: `Add your team to ${ctx.businessName} on Rotahr`, ...r };
    }
    case "no_rota": {
      const r = layout({
        ctx,
        paragraphs: [
          `You've added ${p.staffCount} ${p.staffCount === 1 ? "person" : "people"} to <strong>${biz}</strong>. The next step is the one that saves the Sunday evening: build a week and hit <strong>Publish</strong>.`,
          drafts > 0
            ? `You've already drafted ${drafts} shift${drafts === 1 ? "" : "s"}. Staff only see published shifts, so they're one click from being live.`
            : `Drag shifts onto the week, then publish. Once one week is right, copy it forward and adjust &mdash; most venues only change a handful of shifts week to week.`,
        ],
        cta: { label: drafts > 0 ? "Review and publish" : "Build your first week", href: `${BASE_URL}/rota` },
      });
      return {
        subject: drafts > 0 ? `Your ${ctx.businessName} rota is drafted — publish it?` : `Your team's in. Build the first week?`,
        ...r,
      };
    }
    case "no_invite": {
      const r = layout({
        ctx,
        paragraphs: [
          `Your rota for <strong>${biz}</strong> is published &mdash; but nobody on the team has a login yet, so for now you're the only one who can see it.`,
          `Invite them from the dashboard (one button sends them all). They get their shifts on their phone, can swap shifts, request time off and clock in, and they're told when the rota changes &mdash; so fewer "what am I on this week?" messages.`,
        ],
        cta: { label: "Invite your team", href: `${BASE_URL}/dashboard` },
      });
      return { subject: `Your rota's published — your team can't see it yet`, ...r };
    }
    case "setup_help": {
      const r = layout({
        ctx,
        paragraphs: [
          `It's been about a week since you opened <strong>${biz}</strong> on Rotahr, and it isn't set up yet. That's normal &mdash; hospitality doesn't leave a lot of quiet hours for new software.`,
          `So here's an offer: reply with your staff list and what a normal week looks like (even a photo of the paper rota works), and I'll set it up for you. No charge, no call needed unless you want one.`,
          `If Rotahr isn't the right fit, a one-line reply saying why would genuinely help me.`,
        ],
      });
      return { subject: `Want me to set up ${ctx.businessName} for you?`, ...r };
    }
    case "trial_ending": {
      const ends = ctx.trialEndsAt ? fmtDate(ctx.trialEndsAt) : "soon";
      const plans = PLANS.map((pl) => `${pl.name} &euro;${pl.price}/month (${pl.staff})`).join(", ");
      const r = layout({
        ctx,
        paragraphs: [
          `Your free first 3 months on Rotahr for <strong>${biz}</strong> end on ${ends}.`,
          `To keep everything running, pick a plan: ${plans}. It's a flat monthly fee per venue, VAT included, billed in euro &mdash; never per employee.`,
          `If you don't pick one, nothing is deleted: the account goes read-only, so you and your team can still log in and see everything, and you can switch it back on whenever you like.`,
        ],
        cta: { label: "Choose a plan", href: `${BASE_URL}/settings/billing` },
        ps: `Not sure which plan fits, or need a bit longer? Reply and tell me.`,
      });
      return { subject: `Your free months on Rotahr end on ${ends}`, ...r };
    }
  }
}

// ─── Planning ─────────────────────────────────────────────────────────────────

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / DAY);
}

/**
 * Decide which email (if any) a business is due. Pure: given the same inputs it
 * always returns the same answer, so the rules can be tested without a database.
 */
export function decideLifecycle(input: {
  now: Date;
  createdAt: Date;
  progress: ActivationProgress;
  trialing: boolean;
  trialDaysLeft: number | null;
  foundingMember: boolean;
  sentKeys: Set<LifecycleKey>;
  lastSentAt: Date | null;
}): { key: LifecycleKey | null; reason: string } {
  const { now, createdAt, progress: p, sentKeys } = input;
  if (!input.trialing) return { key: null, reason: "not in a free trial (paying, legacy or expired)" };
  if (input.lastSentAt && now.getTime() - input.lastSentAt.getTime() < MIN_GAP_DAYS * DAY) {
    return { key: null, reason: `a lifecycle email went out less than ${MIN_GAP_DAYS} days ago` };
  }
  const age = daysBetween(createdAt, now);
  const step = (k: string) => p.steps.find((s) => s.key === k)!;

  // Billing deadline outranks setup nudges. Founding members have a different
  // deal (rota stays free) so they get a personal note, not this template.
  if (
    !input.foundingMember &&
    input.trialDaysLeft !== null &&
    input.trialDaysLeft <= 7 &&
    !sentKeys.has("trial_ending")
  ) {
    return { key: "trial_ending", reason: `trial ends in ${input.trialDaysLeft} day(s)` };
  }

  if (!step("staff").done) {
    if (age >= 1 && !sentKeys.has("no_staff")) return { key: "no_staff", reason: `day ${age}, no staff added` };
  } else if (!step("rota").done) {
    const sinceStaff = step("staff").doneAt ? daysBetween(new Date(step("staff").doneAt!), now) : age;
    if (age >= 2 && sinceStaff >= 1 && !sentKeys.has("no_rota")) {
      return { key: "no_rota", reason: `day ${age}, ${p.staffCount} staff, nothing published` };
    }
  } else if (!step("invite").done) {
    const sincePublish = step("rota").doneAt ? daysBetween(new Date(step("rota").doneAt!), now) : age;
    if (sincePublish >= 1 && p.awaitingInvite > 0 && !sentKeys.has("no_invite")) {
      return { key: "no_invite", reason: `published ${sincePublish} day(s) ago, nobody invited` };
    }
  }

  // A week in and still no published rota: one personal offer of help.
  if (age >= 7 && !step("rota").done && !sentKeys.has("setup_help")) {
    return { key: "setup_help", reason: `day ${age}, ${p.completed}/3 steps done` };
  }

  if (p.allDone) return { key: null, reason: "fully set up" };
  return { key: null, reason: `day ${age}, ${p.completed}/3 steps — nothing due yet` };
}

/**
 * Who would get what, right now. Read-only.
 * Covers real (non-demo, non-listing-shell) businesses created in the last
 * `lookbackDays`, which comfortably spans the 90-day trial.
 */
export async function planLifecycle(
  opts: { now?: Date; lookbackDays?: number; businessIds?: string[] } = {},
): Promise<LifecyclePlanItem[]> {
  const now = opts.now ?? new Date();
  const since = new Date(now.getTime() - (opts.lookbackDays ?? 100) * DAY);

  const businesses = await prisma.business.findMany({
    where: {
      ...REAL_CUSTOMER_WHERE,
      createdAt: { gte: since },
      ...(opts.businessIds ? { id: { in: opts.businessIds } } : {}),
    },
    select: {
      id: true,
      name: true,
      createdAt: true,
      lsStatus: true,
      trialEndsAt: true,
      foundingMember: true,
    },
    orderBy: { createdAt: "desc" },
  });
  if (businesses.length === 0) return [];

  const ids = businesses.map((b) => b.id);
  const [progressBy, logs] = await Promise.all([
    getActivationMany(ids),
    prisma.activityLog.findMany({
      where: { businessId: { in: ids }, action: LOG_ACTION },
      select: { businessId: true, details: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const items: LifecyclePlanItem[] = [];
  for (const b of businesses) {
    const progress = progressBy.get(b.id)!;
    // A send that failed at Resend doesn't count, so it can be retried.
    const mine = logs.filter(
      (l) => l.businessId === b.id && (l.details as { status?: string } | null)?.status !== "failed",
    );
    const sentKeys = new Set(
      mine.map((l) => (l.details as { key?: string } | null)?.key).filter(Boolean) as LifecycleKey[],
    );
    const lastSentAt = mine[0]?.createdAt ?? null;
    const access = computeAccess({
      lsStatus: b.lsStatus,
      trialEndsAt: b.trialEndsAt,
      foundingMember: b.foundingMember,
      now,
    });

    const decision = decideLifecycle({
      now,
      createdAt: b.createdAt,
      progress,
      trialing: access.reason === "trialing",
      trialDaysLeft: access.daysLeft,
      foundingMember: b.foundingMember,
      sentKeys,
      lastSentAt,
    });

    const to = progress.ownerEmail;
    let skip: string | null = null;
    let email: RenderedEmail | null = null;
    if (decision.key) {
      if (!to) skip = "no owner email";
      else if (isUnroutableAddress(to)) skip = "unroutable/demo address";
      else if (await isSuppressed(to)) skip = "unsubscribed";
      email = renderLifecycle(decision.key, {
        firstName: (progress.ownerName ?? "").trim().split(/\s+/)[0] ?? "",
        businessName: b.name,
        email: to ?? "owner@example.com",
        daysSinceSignup: daysBetween(b.createdAt, now),
        progress,
        trialEndsAt: access.trialEndsAt,
        trialDaysLeft: access.daysLeft,
      });
    }

    items.push({
      businessId: b.id,
      businessName: b.name,
      createdAt: b.createdAt.toISOString(),
      to,
      key: decision.key,
      reason: decision.reason,
      skip,
      email,
      lastSentAt: lastSentAt ? lastSentAt.toISOString() : null,
      sentKeys: [...sentKeys],
    });
  }
  return items;
}

export function lifecycleSendingEnabled(): boolean {
  return process.env.LIFECYCLE_EMAILS_ENABLED === "1";
}

export interface LifecycleRunResult {
  dryRun: boolean;
  enabled: boolean;
  due: number;
  sent: number;
  skipped: { businessId: string; reason: string }[];
  failures: { businessId: string; error: string }[];
  items: LifecyclePlanItem[];
}

/**
 * Plan, and — only when explicitly enabled — send. Defaults to a dry run.
 */
export async function runLifecycle(opts: { dryRun?: boolean; now?: Date; limit?: number } = {}): Promise<LifecycleRunResult> {
  const enabled = lifecycleSendingEnabled();
  const dryRun = opts.dryRun !== false || !enabled;
  const items = await planLifecycle({ now: opts.now });
  const due = items.filter((i) => i.key && !i.skip);
  const result: LifecycleRunResult = {
    dryRun,
    enabled,
    due: due.length,
    sent: 0,
    skipped: items.filter((i) => i.key && i.skip).map((i) => ({ businessId: i.businessId, reason: i.skip! })),
    failures: [],
    items,
  };
  if (dryRun) return result;

  for (const item of due.slice(0, opts.limit ?? 50)) {
    const res = await deliverPlanItem(item, { via: "cron" });
    if (res.ok) result.sent++;
    else result.failures.push({ businessId: item.businessId, error: res.error ?? "unknown" });
  }
  return result;
}

/**
 * Send one planned email and record it. The log row is written BEFORE the send
 * so a crash mid-send can't lead to a duplicate later, and a second concurrent
 * attempt at the same key (double click, cron racing a manual send) backs out.
 */
async function deliverPlanItem(
  item: LifecyclePlanItem,
  meta: { via: "cron" | "manual"; sentBy?: string | null },
): Promise<{ ok: boolean; error: string | null; resendId: string | null }> {
  const base = { key: item.key, to: item.to, via: meta.via, sentBy: meta.sentBy ?? null };
  const log = await prisma.activityLog.create({
    data: { businessId: item.businessId, action: LOG_ACTION, details: { ...base, status: "sending" } },
  });
  const rivals = await prisma.activityLog.findMany({
    where: { businessId: item.businessId, action: LOG_ACTION, details: { path: ["key"], equals: item.key! } },
    select: { id: true, details: true, createdAt: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  const live = rivals.filter((r) => (r.details as { status?: string } | null)?.status !== "failed");
  if (live[0] && live[0].id !== log.id) {
    await prisma.activityLog.delete({ where: { id: log.id } });
    return { ok: false, error: "already sent", resendId: null };
  }

  const res = await sendEmail({
    context: `lifecycle:${item.key}`,
    to: item.to!,
    subject: item.email!.subject,
    html: item.email!.html,
    text: item.email!.text,
  });
  await prisma.activityLog.update({
    where: { id: log.id },
    data: {
      details: { ...base, status: res.ok ? "sent" : "failed", resendId: res.id, error: res.error },
    },
  });
  return { ok: res.ok, error: res.error, resendId: res.id };
}

/**
 * Manual send from the admin Funnel tab: one business, one email, on an
 * explicit click. Works whether or not LIFECYCLE_EMAILS_ENABLED is set (that
 * flag only governs the automatic cron), but every other rule still applies:
 * the email is re-planned server-side right now and goes only if this exact
 * key is still due, the address isn't unsubscribed/unroutable, and it hasn't
 * been sent before.
 */
export async function sendLifecycleNow(input: {
  businessId: string;
  key: LifecycleKey;
  sentBy?: string | null;
}): Promise<{ ok: boolean; error: string | null; to: string | null; subject: string | null }> {
  const [item] = await planLifecycle({ businessIds: [input.businessId] });
  if (!item) return { ok: false, error: "business not found or not eligible", to: null, subject: null };
  if (item.key !== input.key) {
    return {
      ok: false,
      error: item.key ? `no longer due — now due: ${item.key}` : `no longer due (${item.reason})`,
      to: item.to,
      subject: null,
    };
  }
  if (item.skip || !item.to || !item.email) {
    return { ok: false, error: `can't send: ${item.skip ?? "no recipient"}`, to: item.to, subject: null };
  }
  const res = await deliverPlanItem(item, { via: "manual", sentBy: input.sentBy });
  return { ok: res.ok, error: res.error, to: item.to, subject: item.email.subject };
}
