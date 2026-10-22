/**
 * Manager Copilot orchestration: scope → agents → daily brief.
 *
 * Read-only apart from two tables it owns: OpsBrief (a short-lived cache of
 * the brief) and CopilotSettings (target GP%). Both tolerate their migration
 * not being applied yet.
 */
import { prisma } from "@/lib/db";
import { isNonAttending } from "@/lib/reservations/status";
import { AGENT_LABELS, type AgentKey, type AgentResult, type CopilotScope, type Finding, SEVERITY_RANK } from "./types";
import { addDaysYmd, formatYmd, isYmd, localYmd, parseHour, zonedToUtc } from "./time";
import { loadReservations } from "./data";
import { isMissingTable } from "./db-errors";
import { runCompliance } from "./agents/compliance";
import { runMargin } from "./agents/margin";
import { runWaste } from "./agents/waste";
import { runBookings } from "./agents/bookings";
import { runNoShow } from "./agents/noshow";
import { toPromptPayload } from "./redact";
import { llmBriefSummary } from "./llm";

export const AGENT_KEYS: AgentKey[] = ["compliance", "bookings", "noshow", "margin", "waste"];
const DEFAULT_TZ = "Europe/Dublin";
const CACHE_TTL_MS = 15 * 60 * 1000;
const MAX_PAST_DAYS = 60;
const MAX_FUTURE_DAYS = 14;

export class ScopeError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function validTimeZone(tz: string | null | undefined): string | null {
  if (!tz) return null;
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: tz });
    return tz;
  } catch {
    return null;
  }
}

/**
 * Resolves who/where/when. venueId must belong to the tenant (404 otherwise —
 * same answer as "doesn't exist", so ids can't be probed). A past `date` runs
 * the agents as at 23:59 that day; a future one runs as of now.
 */
export async function buildScope(businessId: string, opts: { venueId?: string | null; date?: string | null; now?: Date }): Promise<CopilotScope> {
  const realNow = opts.now ?? new Date();
  const [business, venue, defaultVenue] = await Promise.all([
    prisma.business.findUnique({ where: { id: businessId }, select: { name: true, currency: true } }),
    opts.venueId
      ? prisma.venue.findFirst({ where: { id: opts.venueId, businessId }, select: { id: true, name: true, timezone: true } })
      : Promise.resolve(null),
    prisma.venue.findFirst({
      where: { businessId, active: true },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      select: { timezone: true },
    }),
  ]);
  if (!business) throw new ScopeError(404, "Business not found");
  if (opts.venueId && !venue) throw new ScopeError(404, "Venue not found");

  const timezone = validTimeZone(venue?.timezone) ?? validTimeZone(defaultVenue?.timezone) ?? DEFAULT_TZ;
  const today = localYmd(realNow, timezone);
  let date = today;
  let now = realNow;
  if (opts.date) {
    if (!isYmd(opts.date)) throw new ScopeError(400, "date must be YYYY-MM-DD");
    if (opts.date < addDaysYmd(today, -MAX_PAST_DAYS) || opts.date > addDaysYmd(today, MAX_FUTURE_DAYS))
      throw new ScopeError(400, `date must be within ${MAX_PAST_DAYS} days back and ${MAX_FUTURE_DAYS} ahead`);
    date = opts.date;
    if (date < today) now = zonedToUtc(date, "23:59", timezone);
  }

  return {
    businessId,
    businessName: business.name,
    venueId: venue?.id ?? null,
    venueName: venue?.name ?? null,
    timezone,
    currency: business.currency || "EUR",
    date,
    now,
    memo: new Map(),
  };
}

const RUNNERS: Record<AgentKey, (s: CopilotScope) => Promise<AgentResult>> = {
  compliance: runCompliance,
  margin: runMargin,
  waste: runWaste,
  bookings: runBookings,
  noshow: runNoShow,
};

/** Strips agent-internal extras (days, scored) so only AgentResult fields leave. */
function publicResult(r: AgentResult): AgentResult {
  const { agent, label, status, headline, businessWide, findings, metrics, table, error } = r;
  return { agent, label, status, headline, businessWide, findings, metrics, table, error };
}

export async function runAgent(scope: CopilotScope, key: AgentKey): Promise<AgentResult> {
  try {
    return publicResult(await RUNNERS[key](scope));
  } catch (err) {
    console.error(`[copilot] agent ${key} failed:`, err);
    return {
      agent: key,
      label: AGENT_LABELS[key],
      status: "unavailable",
      headline: "This check couldn't run just now.",
      findings: [],
      metrics: {},
      error: "Agent failed — the other checks are unaffected.",
    };
  }
}

/** All agents in parallel; one failing never takes the others down. */
export async function runAll(scope: CopilotScope, keys: AgentKey[] = AGENT_KEYS): Promise<AgentResult[]> {
  const settled = await Promise.allSettled(keys.map((k) => runAgent(scope, k)));
  return settled.map((s, i) =>
    s.status === "fulfilled"
      ? s.value
      : { agent: keys[i], label: AGENT_LABELS[keys[i]], status: "unavailable", headline: "This check couldn't run just now.", findings: [], metrics: {}, error: "Agent failed" },
  );
}

// ── Tonight ────────────────────────────────────────────────────────────────

const ALLERGY_RE = /\b(allerg\w*|coeliac|celiac|gluten|nuts?|peanuts?|sesame|shellfish|crustaceans?|molluscs?|dairy|lactose|eggs?|soya?|fish|celery|mustard|lupin|sulph\w*|sulfit\w*|anaphyla\w*|epi-?pen)\b/i;
const VIP_TIERS = new Set(["gold", "vip"]);

export interface Tonight {
  date: string;
  bookings: number;
  covers: number;
  firstSitting: string | null;
  lastSitting: string | null;
  busiestHour: string | null;
  allergyTables: number;
  dietaryTables: number;
  occasions: number;
  vips: number;
  /** Per-table notes for the manager's screen — subjects carry the names. */
  items: Finding[];
}

export async function buildTonight(scope: CopilotScope): Promise<Tonight> {
  const all = await loadReservations(scope);
  const rows = all
    .filter((r) => r.ymd === scope.date && !isNonAttending(r.status))
    .sort((a, b) => a.time.localeCompare(b.time));
  const items: Finding[] = [];
  let allergyTables = 0;
  let dietaryTables = 0;
  let occasions = 0;
  let vips = 0;
  const hours = new Map<number, number>();
  for (const r of rows) {
    const h = parseHour(r.time);
    if (h != null) hours.set(h, (hours.get(h) ?? 0) + r.partySize);
    const notes = [r.dietary, r.kitchenNotes, r.customer?.allergies, r.customer?.dietaryNotes].filter((x): x is string => Boolean(x && x.trim()));
    const allergy = notes.some((n) => ALLERGY_RE.test(n)) || Boolean(r.customer?.allergies?.trim());
    const dietary = !allergy && notes.length > 0;
    const vip = Boolean(r.customer && (VIP_TIERS.has(r.customer.loyaltyTier) || r.customer.vipSince || r.customer.visitCount >= 10));
    const occasion = Boolean(r.occasion?.trim());
    if (allergy) allergyTables++;
    if (dietary) dietaryTables++;
    if (occasion) occasions++;
    if (vip) vips++;
    if (!allergy && !dietary && !occasion && !vip) continue;
    const tags = [allergy && "allergy", dietary && "dietary note", occasion && "occasion", vip && "VIP / regular"].filter(Boolean).join(", ");
    const what = [notes.join("; "), r.occasion?.trim()].filter(Boolean).join(" · ");
    items.push({
      id: `tonight-${r.id}`,
      severity: allergy ? "medium" : "low",
      title: `${r.time}, party of ${r.partySize}: ${tags}`,
      href: "/bookings",
      subjects: [
        {
          type: "reservation",
          id: r.id,
          label: `${r.customerName || "Guest"}${what ? " — " + what.slice(0, 160) : ""}${vip && r.customer ? ` (${r.customer.visitCount} visits)` : ""}`,
        },
      ],
    });
  }
  let busiest: number | null = null;
  for (const [h, c] of hours) if (busiest == null || c > (hours.get(busiest) ?? 0)) busiest = h;
  return {
    date: scope.date,
    bookings: rows.length,
    covers: rows.reduce((a, r) => a + r.partySize, 0),
    firstSitting: rows[0]?.time ?? null,
    lastSitting: rows[rows.length - 1]?.time ?? null,
    busiestHour: busiest == null ? null : `${String(busiest).padStart(2, "0")}:00`,
    allergyTables,
    dietaryTables,
    occasions,
    vips,
    items,
  };
}

// ── Brief ──────────────────────────────────────────────────────────────────

export interface Brief {
  businessName: string;
  venueId: string | null;
  venueName: string | null;
  date: string;
  timezone: string;
  currency: string;
  generatedAt: string;
  cached: boolean;
  summary: string;
  summarySource: "rules" | "llm";
  priorities: (Finding & { agent: AgentKey })[];
  tonight: Tonight;
  agents: AgentResult[];
}

const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;

export function tonightFacts(t: Tonight): Record<string, number | string | null> {
  return {
    bookings: t.bookings,
    covers: t.covers,
    firstSitting: t.firstSitting,
    lastSitting: t.lastSitting,
    busiestHour: t.busiestHour,
    allergyTables: t.allergyTables,
    dietaryTables: t.dietaryTables,
    occasions: t.occasions,
    vips: t.vips,
  };
}

export function topPriorities(results: AgentResult[], n = 5): (Finding & { agent: AgentKey })[] {
  return results
    .flatMap((r) => r.findings.map((f) => ({ ...f, agent: r.agent })))
    .filter((f) => f.severity !== "low")
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])
    .slice(0, n);
}

export function rulesSummary(scope: Pick<CopilotScope, "date" | "venueName">, t: Tonight, results: AgentResult[]): string {
  const parts: string[] = [];
  const where = scope.venueName ? ` at ${scope.venueName}` : "";
  if (t.bookings === 0) parts.push(`${formatYmd(scope.date)}${where}: no bookings on the books yet.`);
  else {
    const extras = [
      t.allergyTables && plural(t.allergyTables, "allergy table"),
      t.dietaryTables && plural(t.dietaryTables, "dietary note"),
      t.occasions && plural(t.occasions, "occasion"),
      t.vips && plural(t.vips, "VIP/regular", "VIPs/regulars"),
    ].filter(Boolean);
    parts.push(
      `${formatYmd(scope.date)}${where}: ${plural(t.covers, "cover")} across ${plural(t.bookings, "booking")}` +
        `${t.busiestHour ? `, busiest around ${t.busiestHour}` : ""}${extras.length ? ` (${extras.join(", ")})` : ""}.`,
    );
  }
  const fc = results.find((r) => r.agent === "bookings");
  if (fc && fc.status !== "unavailable" && typeof fc.metrics.todayForecast === "number" && fc.metrics.todayForecast !== t.covers)
    parts.push(`Forecast ~${fc.metrics.todayForecast} covers with walk-ins and late bookings.`);
  const top = topPriorities(results, 3);
  if (top.length) parts.push(`Priorities: ${top.map((f, i) => `${i + 1}) ${f.title}`).join(" ")}`);
  else parts.push("Nothing urgent from compliance, margin, waste, staffing or no-shows.");
  const down = results.filter((r) => r.status === "unavailable").map((r) => r.label);
  if (down.length) parts.push(`Not checked just now: ${down.join(", ")}.`);
  return parts.join(" ");
}

async function readCache(businessId: string, venueKey: string, date: string): Promise<Brief | null> {
  try {
    const row = await prisma.opsBrief.findUnique({ where: { businessId_venueKey_date: { businessId, venueKey, date } } });
    if (!row || Date.now() - row.generatedAt.getTime() > CACHE_TTL_MS) return null;
    return { ...(row.data as unknown as Brief), cached: true };
  } catch (err) {
    if (!isMissingTable(err)) console.error("[copilot] brief cache read failed:", err);
    return null;
  }
}

async function writeCache(brief: Brief, businessId: string, venueKey: string): Promise<void> {
  try {
    const data = JSON.parse(JSON.stringify({ ...brief, cached: false }));
    await prisma.opsBrief.upsert({
      where: { businessId_venueKey_date: { businessId, venueKey, date: brief.date } },
      create: { businessId, venueKey, date: brief.date, data, summary: brief.summary, summarySource: brief.summarySource, generatedAt: new Date(brief.generatedAt) },
      update: { data, summary: brief.summary, summarySource: brief.summarySource, generatedAt: new Date(brief.generatedAt) },
    });
  } catch (err) {
    if (!isMissingTable(err)) console.error("[copilot] brief cache write failed:", err);
  }
}

export async function getBrief(scope: CopilotScope, opts: { refresh?: boolean; useLlm?: boolean } = {}): Promise<Brief> {
  const venueKey = scope.venueId ?? "all";
  if (!opts.refresh) {
    const hit = await readCache(scope.businessId, venueKey, scope.date);
    if (hit) return hit;
  }
  const [results, tonight] = await Promise.all([runAll(scope), buildTonight(scope)]);
  let summary = rulesSummary(scope, tonight, results);
  let summarySource: Brief["summarySource"] = "rules";
  if (opts.useLlm !== false) {
    try {
      const guests = (await loadReservations(scope)).filter((r) => r.ymd >= addDaysYmd(scope.date, -1)).map((r) => r.customerName);
      const payload = toPromptPayload({
        businessName: scope.businessName,
        venueName: scope.venueName,
        date: scope.date,
        results,
        tonight: tonightFacts(tonight),
        extraNames: guests,
      });
      const llm = await llmBriefSummary(payload);
      if (llm) {
        summary = llm;
        summarySource = "llm";
      }
    } catch (err) {
      // PulseLeakError or anything else: keep the rules summary, send nothing.
      console.warn("[copilot] brief prompt withheld:", (err as Error)?.message ?? err);
    }
  }
  const brief: Brief = {
    businessName: scope.businessName,
    venueId: scope.venueId,
    venueName: scope.venueName,
    date: scope.date,
    timezone: scope.timezone,
    currency: scope.currency,
    generatedAt: new Date().toISOString(),
    cached: false,
    summary,
    summarySource,
    priorities: topPriorities(results),
    tonight,
    agents: results,
  };
  await writeCache(brief, scope.businessId, venueKey);
  return brief;
}
