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

export function niceDate(iso: string | null): string {
  if (!iso) return "no date recorded";
  return new Date(iso).toLocaleDateString("en-IE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
