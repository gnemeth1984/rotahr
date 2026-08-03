/**
 * Demo POS provider.
 *
 * Used only by the seeded demo businesses so a visitor lands on a dashboard that
 * shows what Rotahr looks like with a till connected, instead of an empty
 * "No POS connected" box. It never calls an external API and is always clearly
 * labelled as sample data in the UI — we do not want anyone to mistake it for a
 * real Square/Lightspeed sync.
 */

export type DemoDaySnapshot = {
  totalRevenue: number;
  totalCovers: number;
  totalTransactions: number;
  hourlyData: Array<{ hour: number; revenue: number; transactions: number }>;
  topItems: Array<{ name: string; count: number; revenue: number }>;
};

/** Deterministic per-day jitter so numbers move day to day but never jump around on refresh. */
function daySeed(date: Date) {
  const d = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86_400_000;
  return ((Math.sin(d) + 1) / 2); // 0..1
}

/** Service-hour shape of a typical gastropub trading day. */
const HOUR_WEIGHTS: Array<[number, number]> = [
  [11, 0.02], [12, 0.07], [13, 0.11], [14, 0.06], [15, 0.03],
  [16, 0.03], [17, 0.06], [18, 0.11], [19, 0.15], [20, 0.14],
  [21, 0.11], [22, 0.07], [23, 0.04],
];

const ITEMS: Array<[string, number]> = [
  ["Guinness (pint)", 6.20],
  ["Ribeye Steak", 32.00],
  ["Fish & Chips", 19.50],
  ["Heineken (pint)", 6.80],
  ["House Burger", 18.00],
  ["Chicken Supreme", 24.00],
  ["House Red (glass)", 8.50],
  ["Seafood Chowder", 9.50],
  ["Sticky Toffee Pudding", 8.00],
  ["Americano", 3.50],
];

/**
 * Build a plausible day of trade. `scale` lets a small café and a 3-venue group
 * produce sensibly different numbers from the same shape.
 */
export function demoDayData(date: Date, scale = 1): DemoDaySnapshot {
  const seed = daySeed(date);
  const dow = date.getUTCDay(); // 0 Sun … 6 Sat
  // Weekends trade harder, Mondays are quiet.
  const dowFactor = [1.05, 0.72, 0.8, 0.88, 1.0, 1.28, 1.35][dow];
  // Sized so labour cost against the seeded rota lands around 26-30% — the band a
  // well-run venue actually operates in. Too low and the demo looks fake; too high
  // and the dashboard greets every visitor with a red "labour above 35%" warning.
  const base = 7000 * scale * dowFactor * (0.9 + seed * 0.2);

  const hourlyData = HOUR_WEIGHTS.map(([hour, w], i) => {
    const wobble = 0.88 + ((Math.sin(seed * 100 + i) + 1) / 2) * 0.24;
    const revenue = Math.round(base * w * wobble * 100) / 100;
    return {
      hour,
      revenue,
      transactions: Math.max(1, Math.round(revenue / (28 + seed * 8))),
    };
  });

  const totalRevenue = Math.round(hourlyData.reduce((s, h) => s + h.revenue, 0) * 100) / 100;
  const totalTransactions = hourlyData.reduce((s, h) => s + h.transactions, 0);
  const totalCovers = Math.round(totalTransactions * (1.7 + seed * 0.5));

  // Top items are ordered by revenue and sum to roughly 55% of the day's take,
  // which is about what a real top-10 report looks like.
  const itemBudget = totalRevenue * 0.55;
  let remaining = itemBudget;
  const topItems = ITEMS.map(([name, price], i) => {
    const share = [0.2, 0.16, 0.13, 0.11, 0.09, 0.08, 0.07, 0.06, 0.05, 0.05][i];
    const revenue = Math.round(itemBudget * share * 100) / 100;
    remaining -= revenue;
    return { name, count: Math.max(1, Math.round(revenue / price)), revenue };
  }).sort((a, b) => b.revenue - a.revenue);

  return { totalRevenue, totalCovers, totalTransactions, hourlyData, topItems };
}
