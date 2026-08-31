import { prisma } from "@/lib/prisma";

/**
 * Loyalty configuration.
 *
 * Tiers are rows (LoyaltyTier) rather than an enum so a venue can rename them
 * and move the thresholds without a migration. Every business gets the same
 * four defaults on first use; nothing is seeded until the venue opens the
 * loyalty page or a transaction is recorded, so we never write config rows for
 * the 150+ businesses that will never use the CRM.
 */

export interface TierDef {
  key: string;
  name: string;
  minVisits: number;
  minSpend: number;
  perks: string;
  colour: string;
  sortOrder: number;
}

export const DEFAULT_TIERS: TierDef[] = [
  {
    key: "bronze",
    name: "Bronze",
    minVisits: 0,
    minSpend: 0,
    perks: "Points on every visit\nBirthday greeting",
    colour: "amber",
    sortOrder: 0,
  },
  {
    key: "silver",
    name: "Silver",
    minVisits: 5,
    minSpend: 0,
    perks: "Points on every visit\nPriority on waitlist\nComplimentary tea or coffee",
    colour: "slate",
    sortOrder: 1,
  },
  {
    key: "gold",
    name: "Gold",
    minVisits: 10,
    minSpend: 0,
    perks: "Points on every visit\nPreferred table held to the last minute\nComplimentary dessert on birthday",
    colour: "yellow",
    sortOrder: 2,
  },
  {
    key: "vip",
    name: "VIP",
    minVisits: 0,
    minSpend: 500,
    perks: "Everything in Gold\nDirect line to the manager\nFirst refusal on event nights",
    colour: "purple",
    sortOrder: 3,
  },
];

export const DEFAULT_SETTINGS = {
  enabled: true,
  pointsPerCurrency: 1,
  pointValue: 0.05,
  vipSpendThreshold: 500,
  autoUpgrade: true,
};

export type LoyaltyConfig = {
  settings: {
    enabled: boolean;
    pointsPerCurrency: number;
    pointValue: number;
    vipSpendThreshold: number;
    autoUpgrade: boolean;
  };
  tiers: TierDef[];
};

/** Read config, seeding the four default tiers and settings row on first use. */
export async function ensureLoyaltyConfig(businessId: string): Promise<LoyaltyConfig> {
  const [settings, tiers] = await Promise.all([
    prisma.loyaltySettings.findUnique({ where: { businessId } }),
    prisma.loyaltyTier.findMany({ where: { businessId }, orderBy: { sortOrder: "asc" } }),
  ]);

  let liveSettings = settings;
  if (!liveSettings) {
    liveSettings = await prisma.loyaltySettings.create({
      data: { businessId, ...DEFAULT_SETTINGS },
    });
  }

  let liveTiers = tiers;
  if (liveTiers.length === 0) {
    await prisma.loyaltyTier.createMany({
      data: DEFAULT_TIERS.map((t) => ({ businessId, ...t })),
      skipDuplicates: true,
    });
    liveTiers = await prisma.loyaltyTier.findMany({
      where: { businessId },
      orderBy: { sortOrder: "asc" },
    });
  }

  return {
    settings: {
      enabled: liveSettings.enabled,
      pointsPerCurrency: liveSettings.pointsPerCurrency,
      pointValue: liveSettings.pointValue,
      vipSpendThreshold: liveSettings.vipSpendThreshold,
      autoUpgrade: liveSettings.autoUpgrade,
    },
    tiers: liveTiers.map((t) => ({
      key: t.key,
      name: t.name,
      minVisits: t.minVisits,
      minSpend: t.minSpend,
      perks: t.perks ?? "",
      colour: t.colour,
      sortOrder: t.sortOrder,
    })),
  };
}

/** Read config without writing anything. Used on read-only paths. */
export async function readLoyaltyConfig(businessId: string): Promise<LoyaltyConfig> {
  const [settings, tiers] = await Promise.all([
    prisma.loyaltySettings.findUnique({ where: { businessId } }),
    prisma.loyaltyTier.findMany({ where: { businessId }, orderBy: { sortOrder: "asc" } }),
  ]);

  return {
    settings: settings
      ? {
          enabled: settings.enabled,
          pointsPerCurrency: settings.pointsPerCurrency,
          pointValue: settings.pointValue,
          vipSpendThreshold: settings.vipSpendThreshold,
          autoUpgrade: settings.autoUpgrade,
        }
      : { ...DEFAULT_SETTINGS },
    tiers:
      tiers.length > 0
        ? tiers.map((t) => ({
            key: t.key,
            name: t.name,
            minVisits: t.minVisits,
            minSpend: t.minSpend,
            perks: t.perks ?? "",
            colour: t.colour,
            sortOrder: t.sortOrder,
          }))
        : DEFAULT_TIERS,
  };
}

/**
 * Which tier a guest qualifies for. The highest tier whose visit AND spend
 * floors are both met wins; ties break on sortOrder. A tier with minSpend 0 and
 * minVisits 0 is the floor, so there is always an answer.
 */
export function qualifyingTier(
  visitCount: number,
  totalSpend: number,
  tiers: TierDef[],
  vipSpendThreshold: number
): string {
  const ordered = [...tiers].sort((a, b) => a.sortOrder - b.sortOrder);

  // The spend threshold is a separate promise from the tier table ("spend over
  // X and you are VIP"), so it can promote past the tier's own minSpend.
  const vip = ordered.find((t) => t.key === "vip");
  if (vip && vipSpendThreshold > 0 && totalSpend >= vipSpendThreshold) return vip.key;

  let best = ordered[0]?.key ?? "bronze";
  for (const t of ordered) {
    if (visitCount >= t.minVisits && totalSpend >= t.minSpend) best = t.key;
  }
  return best;
}

export function pointsForSpend(spend: number, pointsPerCurrency: number): number {
  if (!Number.isFinite(spend) || spend <= 0) return 0;
  return Math.max(0, Math.floor(spend * (pointsPerCurrency || 1)));
}

export function tierName(key: string, tiers: TierDef[]): string {
  return tiers.find((t) => t.key === key)?.name ?? key;
}
