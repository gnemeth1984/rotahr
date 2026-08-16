import { prisma } from "@/lib/db";
import {
  REAL_BUSINESS_WHERE,
  REAL_CUSTOMER_WHERE,
  PAYING_CUSTOMER_WHERE,
  DEMO_BUSINESS_IDS,
} from "@/lib/tenancy/real-business";
import { sealPulse, scrubText } from "./redact";
import { SUPER_ADMINS } from "@/lib/auth/super-admins";

/**
 * The read side of the Navigator <-> Rotahr bridge.
 *
 * Everything here is an AGGREGATE except the "myVenue" group, which covers
 * Gabor's own business and is allowed record-level detail. Nothing personal
 * crosses over — see redact.ts, and note that sealPulse() runs on the finished
 * object and throws rather than shipping anything questionable.
 *
 * Deltas matter more than levels. "48 HACCP records" tells him nothing; "+12
 * this week, first usage from two new tenants" is a decision. Every counter
 * therefore carries a previous-period comparison.
 */

const OWN_BUSINESS_ID = "admin-test-biz";

/**
 * How much history a tenant needs before "gone quiet" is allowed to mean
 * anything. Below this we have no habit to compare against, so silence is
 * unmeasured rather than at risk. Deliberately conservative: a false "at risk"
 * sends Gabor chasing a customer who was never really onboarded.
 */
const BASELINE_MIN_EVENTS = 10;
const BASELINE_MIN_DAYS = 3;

export type Delta = { now: number; prev: number; change: number };

export type SystemPulse = {
  generatedAt: string;
  founder: {
    realBusinesses: number;
    listingShells: number;
    /** Demo + Gabor's own account. Tenants, but never customers. */
    internalBusinesses: number;
    /** Tenants that are neither demo nor internal. The real top of funnel. */
    externalBusinesses: number;
    payingCustomers: number;
    byPlan: { plan: string; count: number }[];
    mrrEur: number;
    signups: Delta;
    activeBusinesses7d: number;
    /** Instrumented customers that have gone quiet. A real churn signal. */
    atRisk: number;
    /** Customers with too little history to judge, so quietness says nothing. */
    unmeasured: number;
  };
  usage: { module: string; total: number; delta: number; tenants: number }[];
  myVenue: {
    bookingsToday: number;
    coversToday: number;
    haccpOverdue: number;
    lowStock: number;
    pendingTimeOff: number;
    expiringCerts: number;
    openRepairs: number;
    unfiledExpenses30d: number;
  };
  growth: {
    blogPosts: number;
    blogPublished7d: number;
    siteScore: number | null;
    siteIssues: number | null;
    siteCritical: number | null;
    auditAgeDays: number | null;
    gscClicks28d: number;
    gscImpressions28d: number;
    gscClicksPrev28d: number;
    leads: number;
    sends30d: number;
    opened30d: number;
    openRate: number;
    unreadInbound: number;
    demandGaps: { query: string; impressions: number; position: number }[];
  };
  build: {
    commits7d: number;
    deploys7d: number;
    lastDeployStatus: string | null;
    daysSinceLastShip: number | null;
    recent: { label: string; status: string | null; at: string }[];
  };
  health: {
    cronRuns24h: number;
    cronFailures24h: number;
    failingJobs: { job: string; fails: number }[];
    seoFailures7d: number;
  };
  myActivity: { action: string; count: number }[];
};

const d = (n: number) => new Date(Date.now() - n * 864e5);

const delta = (now: number, prev: number): Delta => ({ now, prev, change: now - prev });

/** Monthly price per plan, EUR incl. VAT, as sold today. */
const PLAN_PRICE: Record<string, number> = { starter: 59, pro: 119, enterprise: 215 };

export async function buildSystemPulse(): Promise<SystemPulse> {
  const now = new Date();

  // ── Founder ────────────────────────────────────────────────────────────────
  const [realBusinesses, allBusinesses, planRows, signups30, signupsPrev30, activeRows] = await Promise.all([
    prisma.business.count({ where: REAL_BUSINESS_WHERE }),
    prisma.business.count(),
    // PAYING_CUSTOMER_WHERE requires a Lemon Squeezy subscription id, not just
    // lsStatus. The demo seed writes lsStatus directly, so the old filter
    // reported the three owner demos as paying and invented EUR393 of MRR.
    prisma.business.groupBy({
      by: ["lsPlan"],
      _count: true,
      where: PAYING_CUSTOMER_WHERE,
    }),
    prisma.business.count({ where: { ...REAL_BUSINESS_WHERE, createdAt: { gte: d(30) } } }),
    prisma.business.count({
      where: { ...REAL_BUSINESS_WHERE, createdAt: { gte: d(60), lt: d(30) } },
    }),
    prisma.activityLog.groupBy({ by: ["businessId"], _count: true, where: { createdAt: { gte: d(7) } } }),
  ]);

  const byPlan = planRows
    .map((r) => ({ plan: r.lsPlan ?? "none", count: r._count }))
    .filter((r) => r.plan !== "none")
    .sort((a, b) => b.count - a.count);

  const mrrEur = byPlan.reduce((sum, r) => sum + (PLAN_PRICE[r.plan] ?? 0) * r.count, 0);
  const payingCustomers = byPlan.reduce((s, r) => s + r.count, 0);

  // "6 tenants" reads like traction until you know 5 of them are demos and
  // Gabor's own login. Split it so the honest number is the visible one.
  const internalBusinesses = await prisma.business.count({
    where: { id: { in: DEMO_BUSINESS_IDS } },
  });
  const externalBusinesses = Math.max(0, realBusinesses - internalBusinesses);

  // At risk vs unmeasured.
  //
  // This used to be "every customer with no activity in 7 days", which
  // over-reported badly: instrumentation coverage is partial, so a tenant with
  // no ActivityLog rows looks identical to a tenant that has left. Those are
  // opposite conclusions and lumping them together produced a scary number that
  // meant nothing.
  //
  // Split by whether we ever had a USAGE BASELINE for them:
  //   - no baseline            -> unmeasured. We cannot tell. Not a risk signal.
  //   - had a baseline, silent -> atRisk. That is a real behaviour change.
  //
  // "Ever logged anything" was too weak a bar. A tenant with two events in its
  // whole lifetime never had a habit to break, so going quiet says nothing about
  // churn -- it just means we never measured them properly. A tenant is only
  // measurable once it has used the product on several separate days.
  const activeIds = new Set(activeRows.map((r) => r.businessId).filter(Boolean) as string[]);
  const customers = await prisma.business.findMany({
    where: REAL_CUSTOMER_WHERE,
    select: { id: true },
  });

  const baselineEvents = await prisma.activityLog.findMany({
    where: { businessId: { in: customers.map((c) => c.id) } },
    select: { businessId: true, createdAt: true },
  });

  // businessId -> { events, distinct calendar days (UTC) }
  const seen = new Map<string, { events: number; days: Set<string> }>();
  for (const e of baselineEvents) {
    if (!e.businessId) continue;
    let row = seen.get(e.businessId);
    if (!row) {
      row = { events: 0, days: new Set<string>() };
      seen.set(e.businessId, row);
    }
    row.events += 1;
    row.days.add(e.createdAt.toISOString().slice(0, 10));
  }

  const hasBaseline = (id: string) => {
    const row = seen.get(id);
    if (!row) return false;
    return row.events >= BASELINE_MIN_EVENTS && row.days.size >= BASELINE_MIN_DAYS;
  };

  const quiet = customers.filter((c) => !activeIds.has(c.id));
  const atRisk = quiet.filter((c) => hasBaseline(c.id)).length;
  const unmeasured = quiet.filter((c) => !hasBaseline(c.id)).length;

  // ── Product usage across all real tenants ─────────────────────────────────
  const usage = await moduleUsage();

  // ── My venue ──────────────────────────────────────────────────────────────
  const myVenue = await ownVenue();

  // ── Growth ────────────────────────────────────────────────────────────────
  const growth = await growthSignals();

  // ── Build ─────────────────────────────────────────────────────────────────
  const build = await buildSignals();

  // ── Health ────────────────────────────────────────────────────────────────
  const health = await healthSignals();

  // ── What Gabor himself did ────────────────────────────────────────────────
  // Scoped to the super-admin account specifically. "Activity by any user" would
  // be a different question with a much less useful answer.
  const me = await prisma.user.findFirst({
    where: { email: { in: SUPER_ADMINS } },
    select: { id: true },
  });
  const myActivityRows = me
    ? await prisma.activityLog.groupBy({
        by: ["action"],
        _count: true,
        where: { createdAt: { gte: d(7) }, userId: me.id },
        orderBy: { _count: { action: "desc" } },
        take: 15,
      })
    : [];

  const pulse: SystemPulse = {
    generatedAt: now.toISOString(),
    founder: {
      realBusinesses,
      listingShells: allBusinesses - realBusinesses,
      internalBusinesses,
      externalBusinesses,
      payingCustomers,
      byPlan,
      mrrEur,
      signups: delta(signups30, signupsPrev30),
      activeBusinesses7d: activeIds.size,
      atRisk,
      unmeasured,
    },
    usage,
    myVenue,
    growth,
    build,
    health,
    myActivity: myActivityRows.map((r) => ({ action: r.action, count: r._count })),
  };

  // Fail closed. If anything personal survived, this throws and the caller keeps
  // serving the previous pulse rather than shipping a leak.
  return sealPulse(pulse);
}

/**
 * Per-module adoption. `tenants` is the number of DISTINCT real businesses
 * touching a module — the number that actually answers "is anyone using this",
 * which a raw row count does not (one enthusiastic tenant looks like traction).
 */
async function moduleUsage(): Promise<SystemPulse["usage"]> {
  const since = d(7);

  /**
   * How many DISTINCT businesses have ever touched this module.
   *
   * This is the number that actually answers "is anyone using it?" — a total of
   * 75 stock items means nothing if all 75 belong to one venue. Done as raw SQL
   * because Prisma's groupBy insists on an aggregate it would then throw away,
   * and the table names here are literals, never user input.
   */
  const tenantsOf = (table: string) =>
    prisma.$queryRawUnsafe<{ businessId: string | null }[]>(
      `select distinct "businessId" from "${table}"`
    );

  const count = async (
    module: string,
    total: Promise<number>,
    recent: Promise<number>,
    tenants: Promise<{ businessId: string | null }[]>
  ) => {
    const [t, r, g] = await Promise.all([total, recent, tenants]);
    return { module, total: t, delta: r, tenants: new Set(g.map((x) => x.businessId)).size };
  };

  return Promise.all([
    count("HACCP", prisma.hACCPRecord.count(), prisma.hACCPRecord.count({ where: { createdAt: { gte: since } } }), tenantsOf("HACCPRecord")),
    count("CRM", prisma.customer.count(), prisma.customer.count({ where: { createdAt: { gte: since } } }), tenantsOf("Customer")),
    count("Bookings", prisma.reservation.count(), prisma.reservation.count({ where: { createdAt: { gte: since } } }), tenantsOf("Reservation")),
    count("Bookkeeping", prisma.expense.count(), prisma.expense.count({ where: { createdAt: { gte: since } } }), tenantsOf("Expense")),
    count("Stock", prisma.stockItem.count(), prisma.stockItem.count({ where: { createdAt: { gte: since } } }), tenantsOf("StockItem")),
    count("Recipes", prisma.dish.count(), prisma.dish.count({ where: { createdAt: { gte: since } } }), tenantsOf("Dish")),
    // Shift has no businessId of its own — it hangs off Employee — so the tenant
    // spread has to be reached through the join rather than a plain distinct.
    count(
      "Rota",
      prisma.shift.count(),
      prisma.shift.count({ where: { createdAt: { gte: since } } }),
      prisma.$queryRawUnsafe<{ businessId: string | null }[]>(
        `select distinct e."businessId" from "Shift" s join "Employee" e on e.id = s."employeeId"`
      )
    ),
    count("Certifications", prisma.trainingCertification.count(), prisma.trainingCertification.count({ where: { createdAt: { gte: since } } }), tenantsOf("TrainingCertification")),
    count("Tips", prisma.tipPool.count(), prisma.tipPool.count({ where: { createdAt: { gte: since } } }), tenantsOf("TipPool")),
    count("Wastage", prisma.wastageRecord.count(), prisma.wastageRecord.count({ where: { createdAt: { gte: since } } }), tenantsOf("WastageRecord")),
    count("Ops tasks", prisma.opsTask.count(), prisma.opsTask.count({ where: { createdAt: { gte: since } } }), tenantsOf("OpsTask")),
    count("Log book", prisma.logEntry.count(), prisma.logEntry.count({ where: { createdAt: { gte: since } } }), tenantsOf("LogEntry")),
  ]);
}

/** Gabor's own business. Record-level detail is fine here — it is his. */
async function ownVenue(): Promise<SystemPulse["myVenue"]> {
  const businessId = OWN_BUSINESS_ID;
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay.getTime() + 864e5);

  const [bookings, haccpSchedules, haccpToday, lowStock, pendingTimeOff, certs, repairs, expenses] =
    await Promise.all([
      prisma.reservation.findMany({
        where: { businessId, date: { gte: startOfDay, lt: endOfDay } },
        select: { partySize: true },
      }),
      prisma.hACCPSchedule.count({ where: { businessId } }),
      prisma.hACCPRecord.count({ where: { businessId, createdAt: { gte: startOfDay } } }),
      prisma.$queryRawUnsafe<{ n: number }[]>(
        `select count(*)::int n from "StockItem"
         where "businessId" = $1 and "reorderLevel" is not null
           and coalesce("currentStock", 0) <= "reorderLevel"`,
        businessId
      ),
      prisma.timeOffRequest.count({ where: { status: "pending", employee: { businessId } } }),
      prisma.trainingCertification.count({
        where: { businessId, expiryDate: { gte: new Date(), lte: d(-30) } },
      }),
      prisma.logEntry.count({ where: { businessId, type: "repair", resolved: false } }),
      prisma.expense.count({ where: { businessId, createdAt: { gte: d(30) } } }),
    ]);

  return {
    bookingsToday: bookings.length,
    coversToday: bookings.reduce((s, b) => s + (b.partySize ?? 0), 0),
    haccpOverdue: Math.max(0, haccpSchedules - haccpToday),
    lowStock: Number(lowStock[0]?.n ?? 0),
    pendingTimeOff,
    expiringCerts: certs,
    openRepairs: repairs,
    unfiledExpenses30d: expenses,
  };
}

async function growthSignals(): Promise<SystemPulse["growth"]> {
  const [blogPosts, blogRecent, audit, leads, sends, opened, unread] = await Promise.all([
    prisma.blogPost.count(),
    prisma.blogPost.count({ where: { createdAt: { gte: d(7) } } }),
    prisma.siteAudit.findFirst({
      orderBy: { createdAt: "desc" },
      select: { score: true, issueCount: true, criticalCount: true, createdAt: true },
    }),
    prisma.outreachLead.count(),
    prisma.outreachSend.count({ where: { sentAt: { gte: d(30) } } }),
    prisma.outreachSend.count({ where: { sentAt: { gte: d(30) }, opened: true } }),
    prisma.inboundEmail.count({ where: { createdAt: { gte: d(30) } } }),
  ]);

  const gsc = await prisma.$queryRawUnsafe<{ clicks: number; impressions: number }[]>(
    `select coalesce(sum(clicks),0)::int clicks, coalesce(sum(impressions),0)::int impressions
     from "SeoMetric" where date >= current_date - 28 and query = ''`
  );
  const gscPrev = await prisma.$queryRawUnsafe<{ clicks: number }[]>(
    `select coalesce(sum(clicks),0)::int clicks
     from "SeoMetric" where date >= current_date - 56 and date < current_date - 28 and query = ''`
  );

  // Demand Rotahr ranks for but does not convert: real impressions, zero clicks.
  // This is the closest thing to a free product-idea feed the system has.
  const gaps = await prisma.$queryRawUnsafe<{ query: string; impressions: number; position: number }[]>(
    `select query, sum(impressions)::int impressions, round(avg(position)::numeric,1)::float position
     from "SeoMetric" where date >= current_date - 28 and query <> ''
     group by query having sum(impressions) > 5 and sum(clicks) = 0
     order by sum(impressions) desc limit 8`
  );

  const auditAgeDays = audit ? Math.floor((Date.now() - audit.createdAt.getTime()) / 864e5) : null;

  return {
    blogPosts,
    blogPublished7d: blogRecent,
    siteScore: audit?.score ?? null,
    siteIssues: audit?.issueCount ?? null,
    siteCritical: audit?.criticalCount ?? null,
    auditAgeDays,
    gscClicks28d: Number(gsc[0]?.clicks ?? 0),
    gscImpressions28d: Number(gsc[0]?.impressions ?? 0),
    gscClicksPrev28d: Number(gscPrev[0]?.clicks ?? 0),
    leads,
    sends30d: sends,
    opened30d: opened,
    openRate: sends > 0 ? Math.round((opened / sends) * 100) : 0,
    unreadInbound: unread,
    // Search queries are not personal data, but they are user-typed free text,
    // so they get scrubbed like anything else before they can reach a prompt.
    demandGaps: gaps.map((g) => ({
      query: scrubText(String(g.query), 80),
      impressions: Number(g.impressions),
      position: Number(g.position),
    })),
  };
}

async function buildSignals(): Promise<SystemPulse["build"]> {
  const [commits, deploys, recent] = await Promise.all([
    prisma.navShipLog.count({ where: { kind: "commit", at: { gte: d(7) } } }),
    prisma.navShipLog.count({ where: { kind: "deploy", at: { gte: d(7) } } }),
    prisma.navShipLog.findMany({
      orderBy: { at: "desc" },
      take: 5,
      select: { message: true, status: true, at: true },
    }),
  ]);

  const last = recent[0];
  return {
    commits7d: commits,
    deploys7d: deploys,
    lastDeployStatus: last?.status ?? null,
    daysSinceLastShip: last ? Math.floor((Date.now() - last.at.getTime()) / 864e5) : null,
    recent: recent.map((r) => ({
      // Named `label`, not `message`: "message" is a banned key in sealPulse
      // (it is the shape a chat/DM body arrives in) and a commit line is not
      // worth punching a hole in that check for.
      label: scrubText(r.message, 120),
      status: r.status,
      at: r.at.toISOString(),
    })),
  };
}

async function healthSignals(): Promise<SystemPulse["health"]> {
  const [runs, fails, failRows, seoFails] = await Promise.all([
    prisma.cronRun.count({ where: { createdAt: { gte: d(1) } } }),
    prisma.cronRun.count({ where: { createdAt: { gte: d(1) }, ok: false } }),
    prisma.cronRun.groupBy({
      by: ["job"],
      _count: true,
      where: { createdAt: { gte: d(7) }, ok: false },
      orderBy: { _count: { job: "desc" } },
      take: 6,
    }),
    prisma.seoRun.count({ where: { createdAt: { gte: d(7) }, ok: false } }),
  ]);

  return {
    cronRuns24h: runs,
    cronFailures24h: fails,
    failingJobs: failRows.map((r) => ({ job: r.job, fails: r._count })),
    seoFailures7d: seoFails,
  };
}

/**
 * Renders the pulse into the prompt.
 *
 * HARD CAP. Navigator's job is the ADHD mechanics of Gabor's day; business
 * telemetry is a supporting character. If this block ever grows to the point
 * where it crowds out his plan, tasks and energy pattern, the product gets
 * worse. So it renders compactly, drops the least decision-relevant lines
 * first, and is truncated by the caller if it still overruns.
 */
export function renderPulse(p: SystemPulse, maxChars = 2600): string {
  const f = p.founder;
  const g = p.growth;
  const arrow = (n: number) => (n > 0 ? `+${n}` : String(n));

  const lines: string[] = [
    `## The system (Rotahr, refreshed ${p.generatedAt.slice(0, 16).replace("T", " ")})`,
    `Real tenant businesses ${f.realBusinesses} (plus ${f.listingShells} empty listing shells — never count these as customers).`,
    `Paying ${f.payingCustomers}, MRR ~EUR${f.mrrEur}. Signups 30d ${f.signups.now} (${arrow(f.signups.change)} vs prior 30d). Active 7d ${f.activeBusinesses7d}. Gone quiet ${f.atRisk}${f.unmeasured ? ` (plus ${f.unmeasured} too little history to judge - unknown, do not treat as churn)` : ""}.`,
  ];

  const moving = p.usage.filter((u) => u.delta > 0).sort((a, b) => b.delta - a.delta);
  // A module that grew this week is not dead, even if only one tenant touched
  // it — listing it in both places made the block contradict itself.
  const movingNames = new Set(moving.map((m) => m.module));
  const dead = p.usage.filter((u) => !movingNames.has(u.module) && (u.total === 0 || u.tenants <= 1));
  if (moving.length) {
    lines.push(`Modules moving this week: ${moving.map((m) => `${m.module} +${m.delta} (${m.tenants} tenants)`).join(", ")}.`);
  }
  if (dead.length) {
    lines.push(`Modules with no real traction: ${dead.map((m) => m.module).join(", ")}.`);
  }

  const v = p.myVenue;
  const venueBits = [
    v.bookingsToday ? `${v.bookingsToday} bookings / ${v.coversToday} covers today` : null,
    v.haccpOverdue ? `${v.haccpOverdue} HACCP checks outstanding` : null,
    v.lowStock ? `${v.lowStock} items out of stock` : null,
    v.pendingTimeOff ? `${v.pendingTimeOff} time-off requests waiting` : null,
    v.expiringCerts ? `${v.expiringCerts} certs expiring` : null,
    v.openRepairs ? `${v.openRepairs} open repairs` : null,
  ].filter(Boolean);
  if (venueBits.length) lines.push(`My venue: ${venueBits.join(", ")}.`);

  lines.push(
    `Growth: ${g.blogPosts} posts (${g.blogPublished7d} this week), site score ${g.siteScore ?? "?"} with ${g.siteCritical ?? 0} critical. Search 28d ${g.gscClicks28d} clicks / ${g.gscImpressions28d} impressions (prior ${g.gscClicksPrev28d}). Outreach ${g.sends30d} sent, ${g.openRate}% opened. ${g.unreadInbound} inbound 30d.`
  );

  if (g.demandGaps.length) {
    lines.push(
      `Search demand with zero clicks: ${g.demandGaps.slice(0, 5).map((x) => `"${x.query}" (${x.impressions} imp, pos ${x.position})`).join(", ")}.`
    );
  }

  const b = p.build;
  lines.push(
    `Build: ${b.commits7d} commits and ${b.deploys7d} deploys in 7d${
      b.daysSinceLastShip != null ? `, last ship ${b.daysSinceLastShip}d ago (${b.lastDeployStatus ?? "?"})` : ""
    }.`
  );

  const h = p.health;
  if (h.cronFailures24h > 0 || h.seoFailures7d > 0) {
    lines.push(
      `HEALTH: ${h.cronFailures24h} cron failures in 24h${
        h.failingJobs.length ? ` (${h.failingJobs.map((j) => `${j.job} x${j.fails}`).join(", ")})` : ""
      }${h.seoFailures7d ? `, ${h.seoFailures7d} SEO job failures in 7d` : ""}.`
    );
  }

  if (p.myActivity.length) {
    lines.push(`What I did in Rotahr this week: ${p.myActivity.map((a) => `${a.action} x${a.count}`).join(", ")}.`);
  }

  lines.push(
    `Use this only when it is relevant to what he asked or to what he should do next. Do not recite these numbers back at him unprompted.`
  );

  let out = lines.join("\n");
  if (out.length > maxChars) out = `${out.slice(0, maxChars - 3)}...`;
  return out;
}
