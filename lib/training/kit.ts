/**
 * Shared building blocks for the in-house courses.
 *
 * courses.ts owns the course list, grading and the allergen content. Anything a
 * second or third course also needs lives here instead, so course content files
 * (fire.ts and the ones after it) can import the shapes without importing
 * courses.ts and creating a cycle.
 */

export interface Lesson {
  id: string;
  title: string;
  /** Paragraphs. Plain text — rendered as <p>. */
  body: string[];
  /** Optional bullet list rendered under the body. */
  bullets?: string[];
  /**
   * Rendered as a highlighted box. Use for the one thing they must not get
   * wrong in that lesson.
   */
  keyPoint?: string;
}

export interface QuizQuestion {
  id: string;
  /** "single" = one correct option. "multi" = zero or more. */
  kind: "single" | "multi";
  prompt: string;
  /** Extra context under the prompt. */
  note?: string;
  options: string[];
  /** Indexes into options. Server-side only — never sent to the client. */
  correct: number[];
  /** Shown on the result page. */
  why: string;
}

/** Deterministic shuffle so a given seed always yields the same paper. */
export function shuffled<T>(items: T[], seed: number): T[] {
  const out = [...items];
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 16807) % 2147483647;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// --------------------------------------------------------------------------- //
// The venue's own equipment, as a course sees it
// --------------------------------------------------------------------------- //

/**
 * Asset categories that carry a real fire risk in a hospitality building.
 * Cooking is the obvious one; extraction (hvac) is the one that burns buildings
 * down because the grease sits where nobody looks; electrical because a
 * distribution board or a failing motor is the classic overnight ignition.
 */
const FIRE_RISK_CATEGORIES = new Set(["cooking", "hvac", "electrical"]);

/** Names that mean "hot oil" whatever category somebody filed them under. */
const FRYER_PATTERN = /fry|frier|fryer|chip\b/i;

export interface CourseAsset {
  id: string;
  name: string;
  category: string;
  location: string | null;
  status: string;
  /** ISO date or null. */
  nextServiceDate: string | null;
  /** Service date recorded and already in the past. */
  serviceOverdue: boolean;
  /** Carries a fire risk worth naming in the lesson. */
  fireRisk: boolean;
  /** Holds hot oil — the highest-consequence item in most kitchens. */
  fryer: boolean;
}

/** Narrow a Prisma Asset row into what a course uses. */
export function toCourseAsset(row: any): CourseAsset {
  const next = row.nextServiceDate ? new Date(row.nextServiceDate) : null;
  const category = row.category ?? "other";
  const name = row.name ?? "";
  const fryer = FRYER_PATTERN.test(name);
  return {
    id: row.id,
    name,
    category,
    location: row.location ?? null,
    status: row.status ?? "active",
    nextServiceDate: next ? next.toISOString() : null,
    // Compared against the start of today rather than the exact clock, so a
    // paper rebuilt twenty minutes later during grading is identical.
    serviceOverdue: Boolean(next && next.getTime() < new Date().setHours(0, 0, 0, 0)),
    fireRisk: FIRE_RISK_CATEGORIES.has(category) || fryer,
    fryer,
  };
}

// --------------------------------------------------------------------------- //
// The venue's own stock list, as a course sees it
// --------------------------------------------------------------------------- //

/**
 * A pack weight at or above this is worth planning rather than just picking up.
 * It is NOT a legal limit and it is not the guideline maximum — published
 * guidance charts sit higher than this. It is the point at which the manual
 * handling course stops calling something "a box" and starts calling it a load.
 */
const HEAVY_KG = 10;

/** Reads "5kg", "2.5 kg", "10L", "500ml", "100 gm" out of an item name. */
const WEIGHT_IN_NAME = /(\d+(?:[.,]\d+)?)\s*(kgs?|kilos?|gms?|g|litres?|liters?|ltrs?|l|mls?)\b/i;

export interface CourseStock {
  id: string;
  name: string;
  unit: string;
  category: string;
  /** Weight of one pack in kg, when the venue actually recorded one. */
  kg: number | null;
  /** Volume of one pack in litres, when the venue actually recorded one. */
  litres: number | null;
  /** A keg — heavy, awkward, and the classic cellar injury. */
  keg: boolean;
  /** Worth a team lift, a trolley or a decant. */
  heavy: boolean;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Narrow a Prisma StockItem row into what a course uses.
 *
 * Weights are only ever READ, never guessed. First choice is the recorded pack
 * size; failing that, a figure the venue typed into the item name itself. If
 * neither exists the course says so rather than inventing a number.
 */
export function toCourseStock(row: any): CourseStock {
  const name: string = row.name ?? "";
  const unit: string = (row.unit ?? "unit").toLowerCase();
  let kg: number | null = null;
  let litres: number | null = null;

  const packSize = typeof row.packSize === "number" ? row.packSize : null;
  const packUnit = (row.packUnit ?? "").toString().trim().toLowerCase();
  if (packSize && packSize > 0) {
    if (packUnit === "kg") kg = packSize;
    else if (packUnit === "g") kg = packSize / 1000;
    else if (packUnit === "litre" || packUnit === "liter" || packUnit === "l") litres = packSize;
    else if (packUnit === "ml") litres = packSize / 1000;
  }

  if (kg === null && litres === null) {
    const m = WEIGHT_IN_NAME.exec(name);
    if (m) {
      const value = Number(m[1].replace(",", "."));
      const u = m[2].toLowerCase();
      if (Number.isFinite(value) && value > 0) {
        if (u.startsWith("kg") || u.startsWith("kilo")) kg = value;
        else if (u === "g" || u.startsWith("gm")) kg = value / 1000;
        else if (u === "l" || u.startsWith("litre") || u.startsWith("liter") || u.startsWith("ltr"))
          litres = value;
        else if (u.startsWith("ml")) litres = value / 1000;
      }
    }
  }

  const keg = unit === "keg" || /\bkegs?\b/i.test(name) || /\bcask\b/i.test(name);
  // A litre of anything a kitchen buys weighs about a kilo, so volume counts
  // toward the same threshold. Kegs are heavy before anything is in them.
  const heavy =
    keg || (kg !== null && kg >= HEAVY_KG) || (litres !== null && litres >= HEAVY_KG);

  return {
    id: row.id,
    name,
    unit: row.unit ?? "unit",
    category: row.category ?? "general",
    kg: kg === null ? null : round1(kg),
    litres: litres === null ? null : round1(litres),
    keg,
    heavy,
  };
}

/** "20 kg", "50 L", or null when the venue never recorded a figure. */
export function stockWeight(item: CourseStock): string | null {
  if (item.kg !== null) return `${item.kg} kg`;
  if (item.litres !== null) return `${item.litres} L`;
  return null;
}

export function niceDate(iso: string | null): string {
  if (!iso) return "no date recorded";
  return new Date(iso).toLocaleDateString("en-IE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
