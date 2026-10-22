/**
 * Margin Guard — when a supplier price moves, which dishes lose margin, and
 * what would the menu price need to be to hold the target GP?
 *
 * GP% is calculated exactly like the Recipes page (lib/costing.ts): on the
 * menu sell price, and only when every ingredient costs cleanly. A partially
 * costed recipe is reported as "can't cost", never as a GP number.
 *
 * Price history comes from StockPriceChange (lib/stock/price-history.ts). The
 * cost "before" a change is the same recipe re-costed with the oldest price in
 * the look-back window, so several invoices in a row read as one move.
 */
import { prisma } from "@/lib/db";
import { costRecipe, grossProfitPct, type CostableIngredient, type CostableStockItem } from "@/lib/costing";
import { formatMoney } from "@/lib/currency";
import { AGENT_LABELS, type AgentResult, type CopilotScope, type Finding, sortFindings, statusFromFindings } from "../types";
import { isMissingTable } from "../db-errors";

export const DEFAULT_TARGET_GP = 70;
const LOOKBACK_DAYS = 30;

export interface MarginStockItem extends CostableStockItem {
  id: string;
  name: string;
}

export interface MarginDish {
  id: string;
  name: string;
  sellPrice: number | null;
  costPrice: number | null;
  ingredients: { qty: number; unit: string; stockItemId: string | null; stockItem: MarginStockItem | null }[];
}

export interface MarginPriceChange {
  stockItemId: string;
  oldPrice: number | null;
  newPrice: number | null;
  packSize: number | null;
  createdAt: Date;
}

export interface MarginInput {
  dishes: MarginDish[];
  changes: MarginPriceChange[];
  targetGpPct: number;
  currency: string;
}

/** Sell price (gross) that gives `targetGp`% on `cost`, rounded up to 0.50. */
export function priceForTargetGp(cost: number, targetGp: number): number | null {
  if (cost <= 0 || targetGp <= 0 || targetGp >= 100) return null;
  const raw = cost / (1 - targetGp / 100);
  return Math.ceil(raw * 2 - 1e-9) / 2;
}

interface DishCost {
  cost: number | null;
  gp: number | null;
  reason?: "no-sell-price" | "recipe-incomplete" | "no-cost";
}

function costDish(dish: MarginDish, override?: Map<string, Partial<CostableStockItem>>): DishCost {
  let cost: number | null = null;
  if (dish.ingredients.length > 0) {
    const ings: CostableIngredient[] = dish.ingredients.map((i) => {
      const o = i.stockItemId ? override?.get(i.stockItemId) : undefined;
      return { qty: i.qty, unit: i.unit, stockItem: i.stockItem ? { ...i.stockItem, ...(o ?? {}) } : null };
    });
    const r = costRecipe(ings);
    if (!r.ok) return { cost: null, gp: null, reason: "recipe-incomplete" };
    cost = r.total;
  } else if (dish.costPrice && dish.costPrice > 0) {
    cost = dish.costPrice;
  } else {
    return { cost: null, gp: null, reason: "no-cost" };
  }
  if (!dish.sellPrice || dish.sellPrice <= 0) return { cost, gp: null, reason: "no-sell-price" };
  return { cost, gp: grossProfitPct(cost, dish.sellPrice) };
}

const r1 = (n: number) => Math.round(n * 10) / 10;

export function computeMargin(input: MarginInput): Omit<AgentResult, "agent" | "label"> {
  const money = (n: number) => formatMoney(n, input.currency);
  const target = input.targetGpPct;
  const findings: Finding[] = [];

  // Net move per stock item across the window: oldest "old" → newest "new".
  const byItem = new Map<string, { first: MarginPriceChange; last: MarginPriceChange }>();
  for (const c of [...input.changes].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())) {
    const cur = byItem.get(c.stockItemId);
    if (!cur) byItem.set(c.stockItemId, { first: c, last: c });
    else cur.last = c;
  }

  const current = new Map(input.dishes.map((d) => [d.id, costDish(d)]));
  const explained = new Set<string>(); // dishes already covered by a price-change finding
  let rises = 0;

  for (const [stockItemId, { first, last }] of byItem) {
    if (first.oldPrice == null || last.newPrice == null || first.oldPrice <= 0) continue;
    const pct = ((last.newPrice - first.oldPrice) / first.oldPrice) * 100;
    if (Math.abs(pct) < 1) continue;

    const using = input.dishes.filter((d) => d.ingredients.some((i) => i.stockItemId === stockItemId));
    const item = using.flatMap((d) => d.ingredients).find((i) => i.stockItemId === stockItemId)?.stockItem;
    const itemName = item?.name ?? "A stock item";

    if (pct < 0) {
      if (using.length)
        findings.push({
          id: `price-drop-${stockItemId}`,
          severity: "low",
          title: `${itemName} is ${r1(-pct)}% cheaper (${money(first.oldPrice)} → ${money(last.newPrice)} a pack)`,
          detail: `Used in ${using.length} ${using.length === 1 ? "dish" : "dishes"}. Margin improves; no action needed.`,
          href: "/stock",
          subjects: [{ type: "stockItem", id: stockItemId, label: itemName }],
        });
      continue;
    }
    rises++;
    if (!using.length) continue;

    const before = new Map<string, Partial<CostableStockItem>>([
      [stockItemId, { lastPrice: first.oldPrice, ...(first.packSize ? { packSize: first.packSize } : {}) }],
    ]);
    const impacts: { dish: MarginDish; gpBefore: number; gpNow: number; cost: number; suggested: number | null }[] = [];
    for (const d of using) {
      const now = current.get(d.id)!;
      const was = costDish(d, before);
      if (now.gp == null || was.gp == null || now.cost == null) continue;
      impacts.push({
        dish: d,
        gpBefore: was.gp,
        gpNow: now.gp,
        cost: now.cost,
        suggested: now.gp < target ? priceForTargetGp(now.cost, target) : null,
      });
    }
    if (!impacts.length) continue;
    impacts.sort((a, b) => a.gpNow - a.gpBefore - (b.gpNow - b.gpBefore));
    const worstDrop = impacts[0].gpBefore - impacts[0].gpNow;
    const belowNow = impacts.filter((i) => i.gpNow < target);
    const crossed = belowNow.filter((i) => i.gpBefore >= target);
    for (const i of impacts) explained.add(i.dish.id);

    findings.push({
      id: `price-rise-${stockItemId}`,
      severity: crossed.length ? "high" : belowNow.length || worstDrop >= 2 ? "medium" : "low",
      title: `${itemName} up ${r1(pct)}% (${money(first.oldPrice)} → ${money(last.newPrice)} a pack): ${impacts.length} ${
        impacts.length === 1 ? "dish loses" : "dishes lose"
      } up to ${r1(worstDrop)} GP points`,
      detail: belowNow.length
        ? `${belowNow.length} now below your ${target}% GP target. Options: reprice, trim the portion, swap supplier, or push a higher-margin special.`
        : `All still at or above your ${target}% GP target.`,
      href: "/recipes",
      subjects: impacts.map((i) => ({
        type: "dish",
        id: i.dish.id,
        label: `${i.dish.name}: GP ${r1(i.gpBefore)}% → ${r1(i.gpNow)}%${i.suggested ? ` · ${money(i.suggested)} holds ${target}%` : ""}`,
      })),
      ...(belowNow.length && belowNow[0].suggested
        ? {
            draft: {
              kind: "price" as const,
              label: "Suggested menu prices (not applied)",
              text: belowNow
                .filter((i) => i.suggested)
                .map((i) => `${i.dish.name}: ${money(i.dish.sellPrice ?? 0)} → ${money(i.suggested!)}`)
                .join("\n"),
            },
          }
        : {}),
    });
  }

  // Dishes below target that no recent price change explains.
  const below = input.dishes
    .filter((d) => !explained.has(d.id))
    .map((d) => ({ d, c: current.get(d.id)! }))
    .filter(({ c }) => c.gp != null && c.cost != null && c.gp < target)
    .sort((a, b) => (a.c.gp as number) - (b.c.gp as number));
  if (below.length) {
    findings.push({
      id: "below-target",
      severity: below.some(({ c }) => (c.gp as number) < target - 10) ? "medium" : "low",
      title: `${below.length} ${below.length === 1 ? "dish is" : "dishes are"} below your ${target}% GP target`,
      detail: `Lowest is ${r1(below[0].c.gp as number)}%.`,
      href: "/recipes",
      subjects: below.slice(0, 20).map(({ d, c }) => {
        const s = priceForTargetGp(c.cost as number, target);
        return { type: "dish", id: d.id, label: `${d.name}: GP ${r1(c.gp as number)}%${s ? ` · ${money(s)} holds ${target}%` : ""}` };
      }),
      draft: {
        kind: "price",
        label: "Prices that would hit target (not applied)",
        text: below
          .slice(0, 20)
          .map(({ d, c }) => {
            const s = priceForTargetGp(c.cost as number, target);
            return s ? `${d.name}: ${money(d.sellPrice ?? 0)} → ${money(s)}` : null;
          })
          .filter(Boolean)
          .join("\n"),
      },
    });
  }

  const uncostable = input.dishes.filter((d) => current.get(d.id)!.reason === "recipe-incomplete");
  if (uncostable.length) {
    findings.push({
      id: "uncostable",
      severity: "low",
      title: `${uncostable.length} ${uncostable.length === 1 ? "recipe can't" : "recipes can't"} be costed yet (missing price, pack size or unit)`,
      detail: "Margin Guard can't watch these until every ingredient has a price.",
      href: "/recipes",
      subjects: uncostable.slice(0, 20).map((d) => ({ type: "dish", id: d.id, label: d.name })),
    });
  }

  const gps = [...current.values()].map((c) => c.gp).filter((g): g is number => g != null);
  const sorted = sortFindings(findings);
  const costed = gps.length;
  return {
    status: statusFromFindings(sorted),
    headline:
      input.dishes.length === 0
        ? "No active dishes yet — add recipes to start tracking margin."
        : rises
          ? `${rises} supplier price ${rises === 1 ? "rise" : "rises"} in the last ${LOOKBACK_DAYS} days. ${below.length} other ${below.length === 1 ? "dish" : "dishes"} below target.`
          : below.length
            ? `No supplier price rises in ${LOOKBACK_DAYS} days; ${below.length} ${below.length === 1 ? "dish" : "dishes"} below ${target}% GP.`
            : `Margins on target (${target}% GP) across ${costed} costed ${costed === 1 ? "dish" : "dishes"}.`,
    businessWide: true,
    findings: sorted,
    metrics: {
      targetGpPct: target,
      activeDishes: input.dishes.length,
      costedDishes: costed,
      averageGpPct: costed ? r1(gps.reduce((a, b) => a + b, 0) / costed) : null,
      priceRises: rises,
      belowTarget: below.length,
      uncostable: uncostable.length,
    },
  };
}

export async function loadTargetGp(businessId: string): Promise<number> {
  try {
    const s = await prisma.copilotSettings.findUnique({ where: { businessId }, select: { targetGpPct: true } });
    return s?.targetGpPct ?? DEFAULT_TARGET_GP;
  } catch (err) {
    if (isMissingTable(err)) return DEFAULT_TARGET_GP;
    throw err;
  }
}

export async function runMargin(scope: CopilotScope): Promise<AgentResult> {
  const { businessId, now } = scope;
  const stockSelect = { id: true, name: true, unit: true, lastPrice: true, packSize: true, packUnit: true } as const;
  const [dishes, targetGpPct] = await Promise.all([
    prisma.dish.findMany({
      where: { businessId, active: true },
      select: {
        id: true,
        name: true,
        sellPrice: true,
        costPrice: true,
        ingredients: { select: { qty: true, unit: true, stockItemId: true, stockItem: { select: stockSelect } } },
      },
    }),
    loadTargetGp(businessId),
  ]);

  let changes: MarginPriceChange[] = [];
  try {
    changes = await prisma.stockPriceChange.findMany({
      where: { businessId, createdAt: { gte: new Date(now.getTime() - LOOKBACK_DAYS * 86_400_000) } },
      select: { stockItemId: true, oldPrice: true, newPrice: true, packSize: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
  } catch (err) {
    if (!isMissingTable(err)) throw err;
  }

  const out = computeMargin({ dishes, changes, targetGpPct, currency: scope.currency });
  return { agent: "margin", label: AGENT_LABELS.margin, ...out };
}
