import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * POS snapshot persistence.
 *
 * A snapshot is one till feed's takings for one venue on one day. The unique
 * key is (businessId, venueId, date) with NULLS NOT DISTINCT, but Prisma's
 * compound-unique inputs don't accept null, so writes go through here instead
 * of `posSnapshot.upsert({ where: { businessId_venueId_date } })`.
 */

export type SnapshotData = {
  provider: string;
  totalRevenue: number;
  totalCovers: number;
  totalTransactions: number;
  hourlyData?: Prisma.InputJsonValue | null;
  topItems?: Prisma.InputJsonValue | null;
  rawMeta?: Prisma.InputJsonValue | null;
};

function json(v: Prisma.InputJsonValue | null | undefined) {
  return v === null || v === undefined ? Prisma.JsonNull : v;
}

export async function upsertPosSnapshot(
  businessId: string,
  venueId: string | null,
  date: Date,
  data: SnapshotData
) {
  const fields = {
    provider: data.provider,
    totalRevenue: data.totalRevenue,
    totalCovers: data.totalCovers,
    totalTransactions: data.totalTransactions,
    hourlyData: json(data.hourlyData),
    topItems: json(data.topItems),
    rawMeta: json(data.rawMeta),
  };

  for (let attempt = 0; attempt < 2; attempt++) {
    const existing = await prisma.posSnapshot.findFirst({
      where: { businessId, venueId, date },
      select: { id: true },
    });
    if (existing) {
      return prisma.posSnapshot.update({ where: { id: existing.id }, data: fields });
    }
    try {
      return await prisma.posSnapshot.create({
        data: { businessId, venueId, date, ...fields },
      });
    } catch (err) {
      // Lost a race with a concurrent sync for the same key — update theirs.
      if (
        attempt === 0 &&
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        continue;
      }
      throw err;
    }
  }
  throw new Error("upsertPosSnapshot: unreachable");
}

/**
 * Move a connection's snapshots to a new venue.
 *
 * Today onwards always moves (today's row is still being written by sync, and
 * leaving it behind would double-count the day once the next sync lands on the
 * new venue). Older rows move only when `includeHistory` is set. A day that
 * already has a row under the target venue is left alone rather than merged.
 */
export async function reassignSnapshots(
  businessId: string,
  provider: string,
  toVenueId: string | null,
  includeHistory: boolean
): Promise<number> {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const clash = await prisma.posSnapshot.findMany({
    where: { businessId, venueId: toVenueId },
    select: { date: true },
  });

  const date: Prisma.DateTimeFilter = {};
  if (!includeHistory) date.gte = today;
  if (clash.length) date.notIn = clash.map((c) => c.date);

  // "venueId differs from target" has to spell out NULL explicitly: SQL's
  // venueId <> 'x' is never true for a NULL venueId.
  const differs: Prisma.PosSnapshotWhereInput =
    toVenueId === null
      ? { venueId: { not: null } }
      : { OR: [{ venueId: null }, { venueId: { not: toVenueId } }] };

  const res = await prisma.posSnapshot.updateMany({
    where: { businessId, provider, ...differs, ...(Object.keys(date).length ? { date } : {}) },
    data: { venueId: toVenueId },
  });
  return res.count;
}

/**
 * Takings for one day: one venue's row, or every row for the business summed.
 * Hourly buckets and top items are merged so a multi-site day reads as one.
 */
export async function getDaySnapshot(
  businessId: string,
  date: Date,
  venueId?: string | null
) {
  const rows = await prisma.posSnapshot.findMany({
    where: { businessId, date, ...(venueId !== undefined ? { venueId } : {}) },
    orderBy: { updatedAt: "desc" },
  });
  if (rows.length === 0) return null;
  if (rows.length === 1) return rows[0];

  const hourly = new Map<number, { hour: number; revenue: number; transactions: number }>();
  const items = new Map<string, { name: string; count: number; revenue: number }>();
  for (const r of rows) {
    for (const h of (Array.isArray(r.hourlyData) ? r.hourlyData : []) as any[]) {
      const cur = hourly.get(h.hour) ?? { hour: h.hour, revenue: 0, transactions: 0 };
      cur.revenue += Number(h.revenue) || 0;
      cur.transactions += Number(h.transactions) || 0;
      hourly.set(h.hour, cur);
    }
    for (const it of (Array.isArray(r.topItems) ? r.topItems : []) as any[]) {
      const cur = items.get(it.name) ?? { name: it.name, count: 0, revenue: 0 };
      cur.count += Number(it.count) || 0;
      cur.revenue += Number(it.revenue) || 0;
      items.set(it.name, cur);
    }
  }
  const base = rows[0];
  return {
    ...base,
    id: `agg:${businessId}:${date.toISOString().slice(0, 10)}`,
    venueId: null,
    totalRevenue: rows.reduce((s, r) => s + r.totalRevenue, 0),
    totalCovers: rows.reduce((s, r) => s + r.totalCovers, 0),
    totalTransactions: rows.reduce((s, r) => s + r.totalTransactions, 0),
    hourlyData: [...hourly.values()].sort((a, b) => a.hour - b.hour),
    topItems: [...items.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 10),
    venueCount: rows.length,
  };
}
