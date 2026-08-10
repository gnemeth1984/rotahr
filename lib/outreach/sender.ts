import { prisma } from "@/lib/db";
import { isUndeliverable } from "@/lib/outreach/verdict";
import { isSuppressed, normaliseEmail } from "@/lib/email/suppression";
import { sendOutreachEmail, isBrevoConfigured, checkSenderDomain } from "./brevo";
import {
  renderEmail,
  NEXT_STATUS,
  STEP_DELAY_DAYS,
  isSequenceStep,
  type SequenceStep,
} from "./templates";

/**
 * Cold-outreach batch sender.
 *
 * Two hard constraints shape this file:
 *
 *  1. Serverless functions freeze the moment a response is returned, so every
 *     send must be awaited before the handler responds. Fire-and-forget looks
 *     fine locally and silently drops mail in production.
 *  2. A daily cap must survive cold starts, so the counter is a row in Postgres
 *     rather than a module-level variable. Two concurrent invocations would each
 *     see their own in-memory count and together blow through the cap.
 */

/**
 * 25/day, not the 60 the old sender used. rotahr.com has no cold-sending
 * history, and the list was scraped rather than verified — at 60/day the hard
 * bounces alone would wreck the domain's reputation before the first reply.
 * Raise it deliberately once bounce rate is known to be low.
 */
export const DEFAULT_DAILY_LIMIT = Number(process.env.OUTREACH_DAILY_LIMIT || 25);
const SEND_DELAY_MS = Number(process.env.OUTREACH_SEND_DELAY_MS || 1500);

/** Terminal statuses — never eligible for another send. */
const TERMINAL = ["cold", "unsubscribed", "replied", "bounced"];

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** YYYY-MM-DD in Europe/Dublin, so "today" matches Gabor's day, not UTC's. */
export function dublinDateKey(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Dublin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export async function getSentToday(): Promise<number> {
  const row = await prisma.outreachDailyCount.findUnique({
    where: { date: dublinDateKey() },
  });
  return row?.count ?? 0;
}

async function incrementSentToday(): Promise<void> {
  const date = dublinDateKey();
  await prisma.outreachDailyCount.upsert({
    where: { date },
    create: { date, count: 1 },
    update: { count: { increment: 1 } },
  });
}

export type EligibleFilter = {
  segment?: string | null;
  country?: string | null;
  limit?: number | null;
  /**
   * Restrict the batch to specific addresses. Eligibility, suppression and the
   * daily cap all still apply — this narrows the selection, it does not bypass
   * any check. Needed because selection is otherwise randomised, so there is no
   * way to aim a small test batch at a known address.
   */
  emails?: string[] | null;
};

/**
 * Leads due a send: brand new, or past the delay for their current step.
 * Raw SQL because the per-status delay is a comparison between two columns,
 * which Prisma's filter API can't express.
 */
/**
 * A row limit that is always a non-negative integer.
 *
 * `Math.max(0, Math.floor(take))` is not enough: both pass NaN straight
 * through, and interpolating that produces `LIMIT nan`, which Postgres rejects
 * with `column "nan" does not exist` (42703) — the whole batch fails on a
 * misread env var rather than sending a sensible number.
 */
function safeTake(take: number): number {
  return Number.isFinite(take) && take > 0 ? Math.floor(take) : 0;
}

/**
 * Countries the cold batch may email, as an allowlist.
 *
 * Unset means "no restriction", which is the behaviour this cron has always
 * had. It exists because the lead table holds both markets (258 IE, 1517 UK)
 * and nothing in the query separated them, so a market being "on hold" was a
 * decision held in someone's head rather than in the code. Set
 * OUTREACH_COUNTRIES=ie to hold the UK list without deleting it.
 */
function allowedCountries(): string[] {
  return (process.env.OUTREACH_COUNTRIES || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export async function findEligibleLeads(
  filter: EligibleFilter & { take: number }
): Promise<
  { id: string; email: string; name: string; segment: string; city: string; country: string; status: string }[]
> {
  const { segment, country, emails, take } = filter;

  // Placeholders are numbered as clauses are appended. Hand-numbering $1/$2 per
  // filter combination is how an off-by-one silently sends to the wrong segment.
  const params: unknown[] = [];
  const clauses: string[] = [];

  if (segment) {
    params.push(segment);
    clauses.push(`AND segment = $${params.length}`);
  }
  if (country) {
    params.push(country);
    clauses.push(`AND country = $${params.length}`);
  }
  // Applied on top of any explicit country filter, never instead of it, so an
  // ad-hoc call cannot widen the batch past the configured markets.
  const allowed = allowedCountries();
  if (allowed.length) {
    params.push(allowed);
    clauses.push(`AND lower(country) = ANY($${params.length}::text[])`);
  }
  if (emails?.length) {
    params.push(emails.map((e) => normaliseEmail(e)));
    clauses.push(`AND email = ANY($${params.length}::text[])`);
  }

  const rows = await prisma.$queryRawUnsafe<
    { id: string; email: string; name: string; segment: string; city: string; country: string; status: string }[]
  >(
    `
    SELECT id, email, name, segment, city, country, status
    FROM "OutreachLead"
    WHERE status NOT IN ('cold','unsubscribed','replied','bounced','converted')
      AND "bouncedAt" IS NULL
      AND "repliedAt" IS NULL
      AND (
        status = 'new'
        OR (status = 'contacted'   AND "lastContacted" <= NOW() - INTERVAL '5 days')
        OR (status = 'followup_1'  AND "lastContacted" <= NOW() - INTERVAL '7 days')
        OR (status = 'followup_2'  AND "lastContacted" <= NOW() - INTERVAL '9 days')
        OR (status = 'followup_3'  AND "lastContacted" <= NOW() - INTERVAL '14 days')
      )
      ${clauses.join("\n      ")}
    ORDER BY
      CASE WHEN status = 'new' THEN 0 ELSE 1 END,
      "lastContacted" ASC NULLS FIRST,
      random()
    LIMIT ${safeTake(take)}
    `,
    ...params
  );

  return rows;
}

export type LeadSendOutcome = {
  email: string;
  step: string;
  sent: boolean;
  subject?: string;
  reason?: string;
};

/** Sends the lead's current step, advances its status, records the send. */
export async function sendToLead(lead: {
  id: string;
  email: string;
  name: string;
  segment: string;
  city: string;
  country: string;
  status: string;
}): Promise<LeadSendOutcome> {
  const step: SequenceStep = isSequenceStep(lead.status) ? lead.status : "new";

  // Suppression is checked immediately before every send, not once per batch.
  // Someone can unsubscribe while a batch is mid-flight.
  if (await isSuppressed(lead.email)) {
    await prisma.outreachLead.update({
      where: { id: lead.id },
      data: { status: "unsubscribed" },
    });
    return { email: lead.email, step, sent: false, reason: "unsubscribed" };
  }

  /**
   * Never send to a mailbox a probe has already proved dead.
   *
   * Read from the stored verdict rather than probed here: verification speaks
   * SMTP on port 25, which Vercel blocks outbound, so it runs as a batch job.
   * Only `dead` and `no-mx` block — `unknown` and `catch-all` still send, so a
   * failed or impossible probe never costs a real prospect.
   */
  const verdict = await prisma.outreachLead
    .findUnique({ where: { id: lead.id }, select: { emailVerdict: true } })
    .then((r) => r?.emailVerdict ?? null)
    .catch(() => null);
  if (isUndeliverable(verdict)) {
    return { email: lead.email, step, sent: false, reason: `skipped: mailbox ${verdict}` };
  }

  const content = renderEmail(lead, step);

  const result = await sendOutreachEmail({
    to: lead.email,
    toName: lead.name,
    subject: content.subject,
    html: content.html,
    tags: ["outreach", step, lead.country],
  });

  if (!result.ok) {
    // A permanent rejection retires the lead; anything transient leaves it
    // eligible so the next run picks it up again.
    if (result.hardBounce) {
      await prisma.outreachLead.update({
        where: { id: lead.id },
        data: { status: "bounced", bouncedAt: new Date() },
      });
    }
    return { email: lead.email, step, sent: false, reason: result.error };
  }

  await prisma.$transaction([
    prisma.outreachLead.update({
      where: { id: lead.id },
      data: {
        status: NEXT_STATUS[step],
        lastContacted: new Date(),
        contactCount: { increment: 1 },
      },
    }),
    prisma.outreachSend.create({
      data: {
        leadId: lead.id,
        email: lead.email,
        segment: lead.segment,
        step,
        subject: content.subject,
        messageId: result.messageId,
      },
    }),
  ]);

  await incrementSentToday();

  return { email: lead.email, step, sent: true, subject: content.subject };
}

export type BatchResult = {
  sent: number;
  skipped: number;
  attempted: number;
  dailyLimit: number;
  sentToday: number;
  reason?: string;
  outcomes: LeadSendOutcome[];
};

/**
 * Sends one batch. `dryRun` walks the whole selection and reports exactly who
 * would receive what, without contacting Brevo — the safe way to inspect a
 * batch before it goes to real strangers.
 */
export async function runBatch(
  opts: EligibleFilter & { dryRun?: boolean } = {}
): Promise<BatchResult> {
  const dailyLimit = DEFAULT_DAILY_LIMIT;
  const sentToday = await getSentToday();
  const base = {
    sent: 0,
    skipped: 0,
    attempted: 0,
    dailyLimit,
    sentToday,
    outcomes: [] as LeadSendOutcome[],
  };

  if (!opts.dryRun && !isBrevoConfigured()) {
    return { ...base, reason: "BREVO_API_KEY is not set" };
  }

  // Refuse a real batch while the sending domain is unauthenticated. Brevo
  // returns 201 for these sends, so without this check the batch looks like it
  // worked while 1,700 unsigned cold emails train every mailbox provider to
  // treat rotahr.com as spam — including the customer mail sent from it.
  if (!opts.dryRun && process.env.OUTREACH_ALLOW_UNVERIFIED_DOMAIN !== "true") {
    const dns = await checkSenderDomain();
    if (!dns.authenticated) {
      const detail = dns.error
        ? dns.error
        : `add the missing DNS records for ${dns.domain} (${dns.missing
            .map((r) => `${r.type} ${r.host}`)
            .join(", ")})`;
      return {
        ...base,
        reason: `Sending domain ${dns.domain} is not authenticated at Brevo — ${detail}. Mail would be unsigned and land in spam.`,
      };
    }
  }

  const remaining = dailyLimit - sentToday;
  if (!opts.dryRun && remaining <= 0) {
    return { ...base, reason: `Daily limit of ${dailyLimit} already reached` };
  }

  const requested = opts.limit ?? remaining;
  const take = opts.dryRun ? requested : Math.min(requested, remaining);
  if (take <= 0) return { ...base, reason: "Nothing to send" };

  const leads = await findEligibleLeads({
    segment: opts.segment ?? null,
    country: opts.country ?? null,
    emails: opts.emails ?? null,
    take,
  });

  if (!leads.length) return { ...base, reason: "No eligible leads" };

  const outcomes: LeadSendOutcome[] = [];
  let sent = 0;
  let skipped = 0;

  for (const lead of leads) {
    if (opts.dryRun) {
      const step: SequenceStep = isSequenceStep(lead.status) ? lead.status : "new";
      const suppressed = await isSuppressed(lead.email);
      outcomes.push({
        email: lead.email,
        step,
        sent: false,
        subject: renderEmail(lead, step).subject,
        reason: suppressed ? "would skip: unsubscribed" : "dry run",
      });
      continue;
    }

    // Awaited, never fire-and-forget: the function freezes on response.
    const outcome = await sendToLead(lead);
    outcomes.push(outcome);
    if (outcome.sent) sent++;
    else skipped++;

    if (leads.indexOf(lead) < leads.length - 1) await sleep(SEND_DELAY_MS);
  }

  return {
    sent,
    skipped,
    attempted: leads.length,
    dailyLimit,
    sentToday: await getSentToday(),
    outcomes,
  };
}

/** Sends the `new` template to one address, ignoring the sequence. For testing. */
export async function sendTestEmail(to: string): Promise<LeadSendOutcome> {
  const email = normaliseEmail(to);
  const content = renderEmail(
    { name: "Your Restaurant", email, segment: "Restaurant", city: "Dublin", country: "ie" },
    "new"
  );
  const result = await sendOutreachEmail({
    to: email,
    toName: "Test",
    subject: `[TEST] ${content.subject}`,
    html: content.html,
    tags: ["outreach", "test"],
  });
  return result.ok
    ? { email, step: "new", sent: true, subject: content.subject }
    : { email, step: "new", sent: false, reason: result.error };
}

export async function outreachStats() {
  const [byStatus, byCountry, totals, engagement, recentSends, suppressed] =
    await Promise.all([
      prisma.outreachLead.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.outreachLead.groupBy({ by: ["country"], _count: { _all: true } }),
      prisma.outreachLead.count(),
      prisma.outreachSend.aggregate({
        _count: { _all: true },
        where: {},
      }),
      prisma.outreachSend.findMany({
        orderBy: { sentAt: "desc" },
        take: 25,
        select: {
          id: true,
          email: true,
          step: true,
          subject: true,
          sentAt: true,
          opened: true,
          clicked: true,
          failedAt: true,
          failedReason: true,
        },
      }),
      prisma.emailSuppression.count({ where: { revokedAt: null } }),
    ]);

  const [opened, clicked] = await Promise.all([
    prisma.outreachSend.count({ where: { opened: true } }),
    prisma.outreachSend.count({ where: { clicked: true } }),
  ]);

  const totalSends = engagement._count._all;

  return {
    totalLeads: totals,
    byStatus: Object.fromEntries(byStatus.map((r) => [r.status, r._count._all])),
    byCountry: Object.fromEntries(byCountry.map((r) => [r.country, r._count._all])),
    totalSends,
    opened,
    clicked,
    openRate: totalSends ? Math.round((opened / totalSends) * 1000) / 10 : 0,
    clickRate: totalSends ? Math.round((clicked / totalSends) * 1000) / 10 : 0,
    sentToday: await getSentToday(),
    dailyLimit: DEFAULT_DAILY_LIMIT,
    suppressed,
    brevoConfigured: isBrevoConfigured(),
    recentSends,
  };
}

export { STEP_DELAY_DAYS, TERMINAL };
