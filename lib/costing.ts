/**
 * Recipe costing.
 *
 * The rule that matters: `StockItem.lastPrice` is the price of ONE PACK as it
 * appears on the supplier invoice — €98 for a 5kg box of ribeye, €210 for a
 * 50-litre keg. It is NOT a price per kg or per litre.
 *
 * So a recipe line of 0.2kg ribeye costs
 *     98 / 5 * 0.2 = €3.92
 * and NOT
 *     98 * 0.2 = €19.60
 *
 * Before this file existed the app did the second one, which overstated food
 * cost by exactly the pack size and produced negative GP%.
 *
 * Two things can go wrong and both must be surfaced, never guessed:
 *   1. packSize is unknown  -> we cannot divide, so the cost is unknown
 *   2. the recipe unit can't be converted to the pack unit (kg vs bottle)
 *      -> we cannot convert, so the cost is unknown
 * In both cases we return ok:false with a reason. A wrong GP% on a menu is
 * worse than a missing one — a chef will price a dish off it.
 */

// ─── Unit conversion ──────────────────────────────────────────────────────────
// Everything convertible reduces to a base unit within its own dimension.
// Anything not listed here (unit, case, box, bottle, portion, slice, bunch)
// is countable and only converts to itself.

type Dimension = "mass" | "volume";

const CONVERSIONS: Record<string, { dim: Dimension; toBase: number }> = {
  // mass, base = gram
  kg: { dim: "mass", toBase: 1000 },
  kilo: { dim: "mass", toBase: 1000 },
  kilos: { dim: "mass", toBase: 1000 },
  kilogram: { dim: "mass", toBase: 1000 },
  kilograms: { dim: "mass", toBase: 1000 },
  g: { dim: "mass", toBase: 1 },
  gram: { dim: "mass", toBase: 1 },
  grams: { dim: "mass", toBase: 1 },
  // volume, base = millilitre
  l: { dim: "volume", toBase: 1000 },
  litre: { dim: "volume", toBase: 1000 },
  litres: { dim: "volume", toBase: 1000 },
  liter: { dim: "volume", toBase: 1000 },
  liters: { dim: "volume", toBase: 1000 },
  ml: { dim: "volume", toBase: 1 },
  millilitre: { dim: "volume", toBase: 1 },
  millilitres: { dim: "volume", toBase: 1 },
  cl: { dim: "volume", toBase: 10 },
};

function normaliseUnit(u: string | null | undefined): string {
  return (u ?? "").trim().toLowerCase();
}

/**
 * Factor to multiply a qty in `from` by to express it in `to`.
 * Returns null when the two units aren't comparable.
 */
export function conversionFactor(from: string, to: string): number | null {
  const a = normaliseUnit(from);
  const b = normaliseUnit(to);
  if (!a || !b) return null;
  if (a === b) return 1;

  const ca = CONVERSIONS[a];
  const cb = CONVERSIONS[b];
  if (!ca || !cb) return null; // one side is countable — no safe conversion
  if (ca.dim !== cb.dim) return null; // kg -> litre is not our call to make
  return ca.toBase / cb.toBase;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CostableStockItem {
  unit: string;
  lastPrice?: number | null;
  packSize?: number | null;
  packUnit?: string | null;
}

export interface CostableIngredient {
  qty: number;
  unit: string;
  stockItem?: CostableStockItem | null;
}

export type CostIssue =
  | "no-stock-item" // free-text ingredient, never had a price
  | "no-price" // linked but no invoice has landed yet
  | "no-pack-size" // price is a pack price and we don't know the pack size
  | "unit-mismatch"; // e.g. recipe in kg, stock sold by the bottle

export interface IngredientCost {
  cost: number | null;
  ok: boolean;
  issue: CostIssue | null;
  /** Price of one `packUnit` (or `unit`) — what most people mean by "price per kg". */
  unitPrice: number | null;
}

export interface RecipeCost {
  /** Sum of the ingredients we could cost. Never treat as complete unless `ok`. */
  total: number;
  /** True only when every single ingredient costed cleanly. */
  ok: boolean;
  /** Ingredients we couldn't cost, in the order they were given. */
  issues: { index: number; issue: CostIssue }[];
  perIngredient: IngredientCost[];
}

// ─── Costing ──────────────────────────────────────────────────────────────────

/** Price of one packUnit (i.e. per kg, per litre, per countable unit). */
export function unitPriceOf(item: CostableStockItem | null | undefined): number | null {
  if (!item || item.lastPrice == null) return null;
  const packUnit = normaliseUnit(item.packUnit) || normaliseUnit(item.unit);
  const size = item.packSize;

  // No pack size recorded -> the price is per one `unit`, which is what the
  // field says on the tin. "kg @ €14.50" is per kg; "bottle @ €12" is per
  // bottle. The dangerous case is a pack/keg/bag/case, where the price covers
  // several kg or litres — those units are countable, so a kg recipe line
  // against them fails the conversion below rather than being guessed at.
  if (size == null || size <= 0) return item.lastPrice;
  return item.lastPrice / size;
}

export function costIngredient(ing: CostableIngredient): IngredientCost {
  const item = ing.stockItem;
  if (!item) return { cost: null, ok: false, issue: "no-stock-item", unitPrice: null };
  if (item.lastPrice == null) return { cost: null, ok: false, issue: "no-price", unitPrice: null };

  const targetUnit = normaliseUnit(item.packUnit) || normaliseUnit(item.unit);
  const unitPrice = unitPriceOf(item);
  if (unitPrice == null) return { cost: null, ok: false, issue: "no-pack-size", unitPrice: null };

  const factor = conversionFactor(ing.unit, targetUnit);
  if (factor == null) {
    // A countable purchase unit (pack, keg, case, bag) priced per pack, being
    // drawn on in kg or ml: the pack size is the missing piece, so say that
    // rather than blaming the units.
    const packSizeMissing =
      (item.packSize == null || item.packSize <= 0) &&
      !CONVERSIONS[targetUnit] &&
      !!CONVERSIONS[normaliseUnit(ing.unit)];
    return { cost: null, ok: false, issue: packSizeMissing ? "no-pack-size" : "unit-mismatch", unitPrice };
  }

  return { cost: ing.qty * factor * unitPrice, ok: true, issue: null, unitPrice };
}

export function costRecipe(ingredients: CostableIngredient[]): RecipeCost {
  const perIngredient = ingredients.map(costIngredient);
  const issues = perIngredient
    .map((c, index) => (c.issue ? { index, issue: c.issue } : null))
    .filter((x): x is { index: number; issue: CostIssue } => x !== null);

  return {
    total: perIngredient.reduce((sum, c) => sum + (c.cost ?? 0), 0),
    ok: issues.length === 0,
    issues,
    perIngredient,
  };
}

/** GP% — null when it would be meaningless or misleading. */
export function grossProfitPct(cost: number, sell: number | null | undefined): number | null {
  if (!sell || sell <= 0) return null;
  if (cost <= 0) return null;
  return ((sell - cost) / sell) * 100;
}

export const COST_ISSUE_LABEL: Record<CostIssue, string> = {
  "no-stock-item": "Not linked to a stock item — add it to Stock to cost it",
  "no-price": "No supplier price yet — scan an invoice or set the price in Stock",
  "no-pack-size": "Pack size missing — set it in Stock (e.g. 5 kg per box) to cost this",
  "unit-mismatch": "Recipe unit can't be converted to the purchase unit",
};
