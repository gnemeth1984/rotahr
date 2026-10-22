import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { REAL_CUSTOMER_WHERE, PAYING_CUSTOMER_WHERE, DEMO_BUSINESS_IDS } from "@/lib/tenancy/real-business";
import { getActivationMany } from "@/lib/activation/progress";
import { computeAccess } from "@/lib/billing/access";

/**
 * Acquisition → activation → paid funnel, built only from tables we already
 * have. No third-party analytics, no new tracking.
 *
 *   visitors        anonymous browser sessions (PageView.sessionId, logged out)
 *   tried demo      sessions that opened /try or used a demo account
 *   register page   sessions that reached /auth/register
 *   signed up       real businesses created (REAL_CUSTOMER_WHERE — no demo
 *                   tenants, no /v/ listing shells)
 *   added staff / published rota / invited team   lib/activation/progress
 *   paying          PAYING_CUSTOMER_WHERE (a real Lemon Squeezy subscription)
 *
 * The first three count sessions and the rest count businesses, so the
 * session → signup step is an approximation: one person on two devices is two
 * sessions. A business is linked back to its pre-signup session when the same
 * browser keeps its rotahr_sid (localStorage) through registration, which is
 * how first-touch source and "tried the demo first" are worked out.
 */

const DAY = 24 * 60 * 60 * 1000;

export interface FunnelStage {
  key: string;
  label: string;
  count: number;
  unit: "sessions" | "businesses";
}

export interface FunnelBusinessRow {
  id: string;
  name: string;
  createdAt: string;
  ownerEmail: string | null;
  country: string;
  staffCount: number;
  publishedShiftCount: number;
  invitedCount: number;
  joinedCount: number;
  steps: { key: string; done: boolean; doneAt: string | null }[];
  paying: boolean;
  plan: string | null;
  trialDaysLeft: number | null;
  accessMode: string;
  firstTouch: { path: string; referrer: string | null; at: string } | null;
  triedDemo: boolean;
}

export interface FunnelResult {
  days: number;
  since: string | null;
  trackingSince: string | null;
  stages: FunnelStage[];
  medians: { staff: number | null; rota: number | null; invite: number | null };
  sources: { source: string; signups: number }[];
  businesses: FunnelBusinessRow[];
}

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  const v = s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  return Math.round(v * 10) / 10;
}

export function sourceOf(referrer: string | null | undefined): string {
  if (!referrer) return "Direct / unknown";
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, "");
    if (host.endsWith("rotahr.com")) return "Direct / unknown";
    if (/google\./.test(host)) return "Google";
    if (/bing\.com|duckduckgo|yahoo\./.test(host)) return "Other search";
    if (/chatgpt|openai|perplexity|claude\.ai|gemini|copilot\.microsoft/.test(host)) return "AI assistant";
    if (/facebook|instagram|fb\.|t\.co|twitter|x\.com|linkedin|lnkd|tiktok|reddit/.test(host)) return "Social";
    return host;
  } catch {
    return "Direct / unknown";
  }
}

export async function getFunnel(opts: { days?: number; now?: Date } = {}): Promise<FunnelResult> {
  const now = opts.now ?? new Date();
  const days = opts.days ?? 30;
  const since = days > 0 ? new Date(now.getTime() - days * DAY) : new Date(0);

  const demoIds = DEMO_BUSINESS_IDS;
  const [sessionRow] = await prisma.$queryRaw<
    { visitors: number; tried: number; register: number; first: Date | null }[]
  >(Prisma.sql`
    SELECT
      COUNT(DISTINCT "sessionId") FILTER (WHERE "userId" IS NULL)::int AS visitors,
      COUNT(DISTINCT "sessionId") FILTER (
        WHERE path LIKE '/try%'
           OR "businessId" LIKE 'demo-%'
           OR "businessId" IN (${Prisma.join(demoIds)})
      )::int AS tried,
      COUNT(DISTINCT "sessionId") FILTER (WHERE path LIKE '/auth/register%')::int AS register,
      (SELECT MIN("createdAt") FROM "PageView") AS first
    FROM "PageView"
    WHERE "createdAt" >= ${since}
      AND "sessionId" IS NOT NULL
      AND "sessionId" <> 'unknown'
  `);

  const businesses = await prisma.business.findMany({
    where: { ...REAL_CUSTOMER_WHERE, createdAt: { gte: since } },
    select: {
      id: true,
      name: true,
      createdAt: true,
      country: true,
      lsPlan: true,
      lsStatus: true,
      trialEndsAt: true,
      foundingMember: true,
    },
    orderBy: { createdAt: "desc" },
  });
  const ids = businesses.map((b) => b.id);

  const [progressBy, paying, touches] = await Promise.all([
    getActivationMany(ids),
    ids.length
      ? prisma.business.findMany({ where: { ...PAYING_CUSTOMER_WHERE, id: { in: ids } }, select: { id: true } })
      : Promise.resolve([] as { id: string }[]),
    ids.length
      ? prisma.$queryRaw<
          { businessId: string; path: string | null; referrer: string | null; at: Date | null; tried: boolean }[]
        >(Prisma.sql`
          WITH s AS (
            SELECT DISTINCT "sessionId", "businessId"
            FROM "PageView"
            WHERE "businessId" IN (${Prisma.join(ids)})
              AND "sessionId" IS NOT NULL AND "sessionId" <> 'unknown'
          ),
          pre AS (
            SELECT s."businessId", p.path, p.referrer, p."createdAt"
            FROM s JOIN "PageView" p ON p."sessionId" = s."sessionId"
            WHERE p."userId" IS NULL OR p."businessId" LIKE 'demo-%'
          ),
          firsts AS (
            SELECT DISTINCT ON ("businessId") "businessId", path, referrer, "createdAt"
            FROM pre ORDER BY "businessId", "createdAt" ASC
          )
          SELECT f."businessId", f.path, f.referrer, f."createdAt" AS at,
                 EXISTS (SELECT 1 FROM pre WHERE pre."businessId" = f."businessId" AND pre.path LIKE '/try%') AS tried
          FROM firsts f
        `)
      : Promise.resolve([]),
  ]);
  const payingSet = new Set(paying.map((p) => p.id));
  const touchBy = new Map(touches.map((t) => [t.businessId, t]));

  const rows: FunnelBusinessRow[] = businesses.map((b) => {
    const p = progressBy.get(b.id)!;
    const access = computeAccess({ lsStatus: b.lsStatus, trialEndsAt: b.trialEndsAt, foundingMember: b.foundingMember, now });
    const t = touchBy.get(b.id);
    return {
      id: b.id,
      name: b.name,
      createdAt: b.createdAt.toISOString(),
      ownerEmail: p.ownerEmail,
      country: b.country,
      staffCount: p.staffCount,
      publishedShiftCount: p.publishedShiftCount,
      invitedCount: p.invitedCount,
      joinedCount: p.joinedCount,
      steps: p.steps,
      paying: payingSet.has(b.id),
      plan: payingSet.has(b.id) ? b.lsPlan : null,
      trialDaysLeft: access.reason === "trialing" ? access.daysLeft : null,
      accessMode: access.reason,
      firstTouch: t?.path ? { path: t.path, referrer: t.referrer, at: (t.at ?? b.createdAt).toISOString() } : null,
      triedDemo: !!t?.tried,
    };
  });

  const count = (k: string) => rows.filter((r) => r.steps.find((s) => s.key === k)?.done).length;
  const daysTo = (k: string) =>
    rows
      .map((r) => {
        const s = r.steps.find((x) => x.key === k);
        return s?.doneAt ? (new Date(s.doneAt).getTime() - new Date(r.createdAt).getTime()) / DAY : null;
      })
      .filter((x): x is number => x !== null && x >= 0);

  const sourceCounts = new Map<string, number>();
  for (const r of rows) {
    const src = r.firstTouch ? sourceOf(r.firstTouch.referrer) : "Not linked to a visit";
    sourceCounts.set(src, (sourceCounts.get(src) ?? 0) + 1);
  }

  return {
    days,
    since: days > 0 ? since.toISOString() : null,
    trackingSince: sessionRow?.first ? new Date(sessionRow.first).toISOString() : null,
    stages: [
      { key: "visitors", label: "Visitors", count: sessionRow?.visitors ?? 0, unit: "sessions" },
      { key: "tried", label: "Opened the demo (/try)", count: sessionRow?.tried ?? 0, unit: "sessions" },
      { key: "register", label: "Reached sign-up page", count: sessionRow?.register ?? 0, unit: "sessions" },
      { key: "signup", label: "Signed up", count: rows.length, unit: "businesses" },
      { key: "staff", label: "Added staff", count: count("staff"), unit: "businesses" },
      { key: "rota", label: "Published a rota", count: count("rota"), unit: "businesses" },
      { key: "invite", label: "Invited the team", count: count("invite"), unit: "businesses" },
      { key: "paid", label: "Paying", count: rows.filter((r) => r.paying).length, unit: "businesses" },
    ],
    medians: { staff: median(daysTo("staff")), rota: median(daysTo("rota")), invite: median(daysTo("invite")) },
    sources: [...sourceCounts.entries()].map(([source, signups]) => ({ source, signups })).sort((a, b) => b.signups - a.signups),
    businesses: rows,
  };
}
