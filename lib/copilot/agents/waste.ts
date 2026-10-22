/**
 * Stock Waste Advisor — what is being binned, why, and what to change.
 *
 * Compares the last 28 days with the 28 before, ranks items by cost, links
 * expiry/spoilage waste back to what was ordered (over-ordering), and looks for
 * a weekday pattern in over-prep waste. Also lists items at or below their
 * reorder level so the manager sees both sides of the stock problem.
 */
import { prisma } from "@/lib/db";
import { conversionFactor, unitPriceOf } from "@/lib/costing";
import { formatMoney } from "@/lib/currency";
import { AGENT_LABELS, type AgentResult, type CopilotScope, type Finding, sortFindings, statusFromFindings } from "../types";
import { WEEKDAY_SHORT } from "../time";

const WINDOW_DAYS = 28;
const DAY_MS = 86_400_000;
const OVERORDER_REASONS = new Set(["expiry", "spoilage"]);

const WEEKDAY_LONG = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];

export interface WasteRecordIn {
  stockItemId: string | null;
  itemName: string;
  quantity: number;
  unit: string;
  unitCost: number | null;
  totalCost: number | null;
  reason: string;
  date: Date;
}

export interface WasteStockItem {
  id: string;
  name: string;
  unit: string;
  lastPrice: number | null;
  packSize: number | null;
  packUnit: string | null;
  reorderLevel: number | null;
  currentStock: number | null;
}

export interface WasteOrderLine {
  stockItemId: string;
  quantity: number;
  at: Date;
}

export interface WasteInput {
  now: Date;
  timezone: string;
  currency: string;
  records: WasteRecordIn[];
  stockItems: WasteStockItem[];
  orderLines: WasteOrderLine[];
}

/** Cost of a wastage row: recorded total → qty × unit cost → stock price. */
export function wasteCost(r: WasteRecordIn, item: WasteStockItem | undefined): number | null {
  if (r.totalCost != null && r.totalCost >= 0) return r.totalCost;
  if (r.unitCost != null && r.unitCost >= 0) return r.quantity * r.unitCost;
  if (!item) return null;
  const perUnit = unitPriceOf(item);
  if (perUnit == null) return null;
  const target = item.packUnit || item.unit;
  const f = conversionFactor(r.unit, target);
  if (f != null) return r.quantity * f * perUnit;
  // Wasted in whole packs (e.g. "1 box") of a pack-priced item.
  if ((r.unit || "").toLowerCase() === (item.unit || "").toLowerCase() && item.lastPrice != null) {
    return r.quantity * item.lastPrice;
  }
  return null;
}

/** Quantity expressed in the item's order unit (what OrderItem.quantity counts). */
export function toOrderUnits(qty: number, unit: string, item: WasteStockItem): number | null {
  const direct = conversionFactor(unit, item.unit);
  if (direct != null) return qty * direct;
  if (item.packSize && item.packSize > 0 && item.packUnit) {
    const f = conversionFactor(unit, item.packUnit);
    if (f != null) return (qty * f) / item.packSize;
  }
  return null;
}

function weekdayOf(d: Date, timeZone: string): number {
  const wd = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(d);
  return WEEKDAY_SHORT.indexOf(wd.slice(0, 3));
}

export function computeWaste(input: WasteInput): Omit<AgentResult, "agent" | "label"> {
  const money = (n: number) => formatMoney(n, input.currency);
  const items = new Map(input.stockItems.map((i) => [i.id, i]));
  const cut = input.now.getTime() - WINDOW_DAYS * DAY_MS;
  const cutPrev = cut - WINDOW_DAYS * DAY_MS;
  const findings: Finding[] = [];

  let cur = 0;
  let prev = 0;
  let uncosted = 0;
  const byItem = new Map<
    string,
    { name: string; stockItemId: string | null; cost: number; reasons: Map<string, number>; count: number; expiryOrderUnits: number | null }
  >();
  const byReason = new Map<string, number>();
  const overPrepByWeekday = new Array(7).fill(0) as number[];
  let overPrepCount = 0;

  for (const r of input.records) {
    const t = r.date.getTime();
    if (t < cutPrev) continue;
    const c = wasteCost(r, r.stockItemId ? items.get(r.stockItemId) : undefined);
    if (t < cut) {
      prev += c ?? 0;
      continue;
    }
    if (c == null) uncosted++;
    cur += c ?? 0;
    const key = r.stockItemId ?? `name:${r.itemName.trim().toLowerCase()}`;
    const e = byItem.get(key) ?? { name: r.itemName, stockItemId: r.stockItemId, cost: 0, reasons: new Map(), count: 0, expiryOrderUnits: 0 };
    e.cost += c ?? 0;
    e.count++;
    if (OVERORDER_REASONS.has(r.reason) && e.expiryOrderUnits != null) {
      const item = r.stockItemId ? items.get(r.stockItemId) : undefined;
      const u = item ? toOrderUnits(r.quantity, r.unit, item) : null;
      e.expiryOrderUnits = u == null ? null : e.expiryOrderUnits + u;
    }
    e.reasons.set(r.reason, (e.reasons.get(r.reason) ?? 0) + (c ?? 0) + 1e-6);
    byItem.set(key, e);
    byReason.set(r.reason, (byReason.get(r.reason) ?? 0) + (c ?? 0));
    if (r.reason === "over-prep") {
      overPrepByWeekday[weekdayOf(r.date, input.timezone)] += c ?? 0;
      overPrepCount++;
    }
  }

  // ── Trend ──────────────────────────────────────────────────────────────────
  const change = prev > 0 ? ((cur - prev) / prev) * 100 : null;
  if (change != null && change >= 25 && cur - prev >= 50) {
    findings.push({
      id: "waste-up",
      severity: "medium",
      title: `Waste up ${Math.round(change)}% on the previous 4 weeks (${money(prev)} → ${money(cur)})`,
      href: "/stock",
    });
  }

  // ── Top items ─────────────────────────────────────────────────────────────
  const top = [...byItem.values()].filter((e) => e.cost > 0).sort((a, b) => b.cost - a.cost).slice(0, 5);
  if (top.length) {
    findings.push({
      id: "waste-top",
      severity: "low",
      title: `Biggest waste in 4 weeks: ${top
        .slice(0, 3)
        .map((e) => `${e.name} ${money(e.cost)}`)
        .join(", ")}`,
      href: "/stock",
      subjects: top.map((e) => {
        const reason = [...e.reasons.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
        return { type: "stockItem", id: e.stockItemId ?? undefined, label: `${e.name}: ${money(e.cost)} (${e.count}×, mostly ${reason})` };
      }),
    });
  }

  // ── Over-ordering: expiry/spoilage vs what was ordered ────────────────────
  const ordered = new Map<string, number>();
  for (const l of input.orderLines) {
    if (l.at.getTime() < cut) continue;
    ordered.set(l.stockItemId, (ordered.get(l.stockItemId) ?? 0) + l.quantity);
  }
  for (const e of byItem.values()) {
    if (!e.stockItemId) continue;
    const expiryCost = [...e.reasons.entries()].filter(([k]) => OVERORDER_REASONS.has(k)).reduce((a, [, v]) => a + v, 0);
    if (expiryCost < 1) continue;
    const item = items.get(e.stockItemId);
    const orderedQty = ordered.get(e.stockItemId);
    if (!item || !orderedQty) continue;
    const packs = e.expiryOrderUnits;
    if (packs == null || packs <= 0) continue;
    const share = packs / orderedQty;
    if (share < 0.1) continue;
    const pct = Math.round(Math.min(share, 1) * 100);
    findings.push({
      id: `overorder-${e.stockItemId}`,
      severity: share >= 0.2 ? "medium" : "low",
      title: `${e.name}: about ${pct}% of what was ordered in 4 weeks was binned (expiry/spoilage), ${money(expiryCost)}`,
      detail: "Order smaller quantities more often, or lower the par level.",
      href: "/stock",
      subjects: [{ type: "stockItem", id: e.stockItemId, label: e.name }],
      draft: {
        kind: "order-note",
        label: "Note for the next order (not sent)",
        text: `${e.name}: ordered ${Math.round(orderedQty * 10) / 10} ${item.unit} in 4 weeks, ~${Math.round(packs * 10) / 10} ${item.unit} wasted. Try ${Math.max(0, Math.round((orderedQty - packs) * 10) / 10)} ${item.unit} over the next 4 weeks.`,
      },
    });
  }

  // ── Over-prep by weekday ──────────────────────────────────────────────────
  const overPrepTotal = overPrepByWeekday.reduce((a, b) => a + b, 0);
  if (overPrepCount >= 3 && overPrepTotal > 0) {
    const peak = overPrepByWeekday.indexOf(Math.max(...overPrepByWeekday));
    const share = overPrepByWeekday[peak] / overPrepTotal;
    if (share >= 0.4) {
      findings.push({
        id: "overprep-weekday",
        severity: "medium",
        title: `${Math.round(share * 100)}% of over-prep waste happens on ${WEEKDAY_LONG[peak]} (${money(overPrepByWeekday[peak])} in 4 weeks)`,
        detail: `Prep to the ${WEEKDAY_LONG[peak].slice(0, -1)} booking forecast rather than a fixed par.`,
        href: "/stock",
      });
    }
  }

  // ── Low stock ─────────────────────────────────────────────────────────────
  const low = input.stockItems.filter((i) => i.reorderLevel != null && i.currentStock != null && i.currentStock <= i.reorderLevel);
  if (low.length) {
    findings.push({
      id: "low-stock",
      severity: "low",
      title: `${low.length} ${low.length === 1 ? "item is" : "items are"} at or below reorder level`,
      detail: "Draft an order from Stock — nothing is ordered automatically.",
      href: "/stock",
      subjects: low.slice(0, 20).map((i) => ({ type: "stockItem", id: i.id, label: `${i.name}: ${i.currentStock} ${i.unit} (reorder at ${i.reorderLevel})` })),
    });
  }

  const sorted = sortFindings(findings);
  const reasons = [...byReason.entries()].sort((a, b) => b[1] - a[1]);
  return {
    status: statusFromFindings(sorted),
    headline:
      cur === 0 && uncosted === 0
        ? "No waste logged in the last 4 weeks." + (low.length ? ` ${low.length} items at reorder level.` : "")
        : `${money(cur)} of waste logged in 4 weeks${change != null ? ` (${change >= 0 ? "+" : ""}${Math.round(change)}% vs the 4 before)` : ""}${
            reasons[0] ? `, mostly ${reasons[0][0]}` : ""
          }.`,
    businessWide: true,
    findings: sorted,
    metrics: {
      wasteCost28d: Math.round(cur * 100) / 100,
      wasteCostPrev28d: Math.round(prev * 100) / 100,
      changePct: change == null ? null : Math.round(change),
      uncostedRecords: uncosted,
      topReason: reasons[0]?.[0] ?? null,
      lowStockItems: low.length,
    },
  };
}

export async function runWaste(scope: CopilotScope): Promise<AgentResult> {
  const { businessId, now } = scope;
  const since = new Date(now.getTime() - 2 * WINDOW_DAYS * DAY_MS);
  const [records, stockItems, orders] = await Promise.all([
    prisma.wastageRecord.findMany({
      where: { businessId, date: { gte: since } },
      select: { stockItemId: true, itemName: true, quantity: true, unit: true, unitCost: true, totalCost: true, reason: true, date: true },
    }),
    prisma.stockItem.findMany({
      where: { businessId },
      select: { id: true, name: true, unit: true, lastPrice: true, packSize: true, packUnit: true, reorderLevel: true, currentStock: true },
    }),
    prisma.supplierOrder.findMany({
      where: { businessId, status: { in: ["sent", "received"] }, createdAt: { gte: since } },
      select: { createdAt: true, receivedAt: true, sentAt: true, items: { select: { stockItemId: true, quantity: true } } },
    }),
  ]);
  const orderLines = orders.flatMap((o) =>
    o.items.map((i) => ({ stockItemId: i.stockItemId, quantity: i.quantity, at: o.receivedAt ?? o.sentAt ?? o.createdAt })),
  );
  const out = computeWaste({ now, timezone: scope.timezone, currency: scope.currency, records, stockItems, orderLines });
  return { agent: "waste", label: AGENT_LABELS.waste, ...out };
}
