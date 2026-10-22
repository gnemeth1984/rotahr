/**
 * StockItem.lastPrice history.
 *
 * Every path that changes a stock item's pack price goes through
 * `updateStockItemTracked()` (or calls `recordPriceChange()` after its own
 * write) so Margin Guard can say "Ribeye went from €98 to €112 a box on
 * Tuesday; these four dishes lost 3–6 points of GP".
 *
 * Two rules:
 *  1. Tenant-checked. The item is looked up by id AND businessId before it is
 *     written. Several receipt/delivery routes used to update by bare id taken
 *     from the request body, which let one tenant write another's stock.
 *  2. History never breaks the write. If the history insert fails (e.g. the
 *     StockPriceChange table has not been migrated yet in an environment) the
 *     stock update still stands and the failure is logged.
 */
import type { Prisma, StockItem } from "@prisma/client";
import { prisma } from "@/lib/db";

export type PriceSource = "stock-edit" | "receipt" | "delivery-note" | "statement" | "order";

type Db = typeof prisma | Prisma.TransactionClient;

const EPS = 0.0001;

/** True when a pack price actually moved (null → number counts as a change). */
export function priceChanged(oldPrice: number | null | undefined, newPrice: number | null | undefined): boolean {
  const a = oldPrice ?? null;
  const b = newPrice ?? null;
  if (a === null && b === null) return false;
  if (a === null || b === null) return true;
  return Math.abs(a - b) > EPS;
}

export interface PriceChangeInput {
  businessId: string;
  stockItemId: string;
  oldPrice: number | null | undefined;
  newPrice: number | null | undefined;
  packSize?: number | null;
  source: PriceSource;
  changedById?: string | null;
}

/** Inserts one history row if the price moved. Never throws. */
export async function recordPriceChange(input: PriceChangeInput, db: Db = prisma): Promise<boolean> {
  if (!priceChanged(input.oldPrice, input.newPrice)) return false;
  try {
    await db.stockPriceChange.create({
      data: {
        businessId: input.businessId,
        stockItemId: input.stockItemId,
        oldPrice: input.oldPrice ?? null,
        newPrice: input.newPrice ?? null,
        packSize: input.packSize ?? null,
        source: input.source,
        changedById: input.changedById ?? null,
      },
    });
    return true;
  } catch (err) {
    console.warn("[price-history] could not record price change:", (err as Error)?.message);
    return false;
  }
}

/**
 * Update a stock item that belongs to `businessId`, recording a price change
 * when `data.lastPrice` moves it. Returns null when the item is not this
 * tenant's (caller should treat that as not found).
 */
export async function updateStockItemTracked(
  businessId: string,
  stockItemId: string,
  data: Prisma.StockItemUncheckedUpdateInput,
  opts: { source: PriceSource; changedById?: string | null; include?: Prisma.StockItemInclude },
  db: Db = prisma,
): Promise<StockItem | null> {
  const before = await db.stockItem.findFirst({
    where: { id: stockItemId, businessId },
    select: { id: true, lastPrice: true, packSize: true },
  });
  if (!before) return null;

  // Never let the caller move the row to another tenant.
  const { businessId: _ignored, ...safe } = data as Record<string, unknown>;

  const updated = await db.stockItem.update({
    where: { id: before.id },
    data: safe as Prisma.StockItemUncheckedUpdateInput,
    ...(opts.include ? { include: opts.include } : {}),
  });

  if ("lastPrice" in safe) {
    await recordPriceChange(
      {
        businessId,
        stockItemId: before.id,
        oldPrice: before.lastPrice,
        newPrice: updated.lastPrice,
        packSize: updated.packSize ?? before.packSize,
        source: opts.source,
        changedById: opts.changedById,
      },
      db,
    );
  }
  return updated;
}
