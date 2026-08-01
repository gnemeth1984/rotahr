// Shared types + safety rules for the public venue page (rotahr.com/v/<slug>).
//
// SECURITY NOTE: everything in this module feeds a page served to anonymous
// visitors. Only fields explicitly listed here may ever reach it. Never widen a
// Prisma `select` for the public page without adding the field here first.

export interface OpeningHoursEntry {
  day: number; // 0=Sun .. 6=Sat
  closed: boolean;
  open: string; // "HH:mm"
  close: string; // "HH:mm"
}

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** schema.org day URIs, indexed to match DAY_NAMES. */
export const SCHEMA_DAYS = [
  "https://schema.org/Sunday",
  "https://schema.org/Monday",
  "https://schema.org/Tuesday",
  "https://schema.org/Wednesday",
  "https://schema.org/Thursday",
  "https://schema.org/Friday",
  "https://schema.org/Saturday",
];

export function defaultOpeningHours(): OpeningHoursEntry[] {
  return Array.from({ length: 7 }, (_, day) => ({
    day,
    closed: day === 0,
    open: "12:00",
    close: "23:00",
  }));
}

/**
 * Coerce whatever is stored in the JSON column into a safe, complete 7-day array.
 * Tolerates nulls, partial data and bad types from older records.
 */
export function normaliseOpeningHours(raw: unknown): OpeningHoursEntry[] {
  const fallback = defaultOpeningHours();
  if (!Array.isArray(raw)) return fallback;

  const byDay = new Map<number, OpeningHoursEntry>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const day = Number(o.day);
    if (!Number.isInteger(day) || day < 0 || day > 6) continue;
    byDay.set(day, {
      day,
      closed: Boolean(o.closed),
      open: typeof o.open === "string" && /^\d{2}:\d{2}$/.test(o.open) ? o.open : "12:00",
      close: typeof o.close === "string" && /^\d{2}:\d{2}$/.test(o.close) ? o.close : "23:00",
    });
  }
  return fallback.map((d) => byDay.get(d.day) ?? d);
}

/**
 * Categories of MenuSpecial that may appear publicly.
 *
 * ONLY "special" is guest-facing. Everything else on the Menu Specials board is
 * written for staff and must never reach the public page:
 *  - "announcement" — staff briefings ("all staff read the allergen sheet, see
 *    Marco"). Often names employees.
 *  - "change" — kitchen changes ("we swapped the garnish").
 *  - "86'd"  — an item has run out; an internal kitchen signal.
 *
 * Managers can additionally hide any individual special via `hideFromPublic`.
 */
export const PUBLIC_SPECIAL_CATEGORIES = ["special"];

/** Venue types we can map onto a more specific schema.org type. */
const SCHEMA_TYPE_BY_VENUE: Record<string, string> = {
  restaurant: "Restaurant",
  cafe: "CafeOrCoffeeShop",
  bar: "BarOrPub",
  pub: "BarOrPub",
  hotel: "Hotel",
};

export function schemaTypeFor(venueType?: string | null): string {
  if (!venueType) return "Restaurant";
  return SCHEMA_TYPE_BY_VENUE[venueType.toLowerCase()] ?? "Restaurant";
}

/** Turn a business name into a URL-safe slug candidate. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents (Cafe with accent -> cafe)
    .replace(/&/g, " and ")
    .replace(/['’‘"“”]/g, "") // christy's -> christys, not christy-s
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * Slugs that would collide with real routes on rotahr.com, or that we want to
 * keep back. Checked case-insensitively by the settings API.
 */
export const RESERVED_SLUGS = new Set([
  "api", "admin", "app", "auth", "login", "logout", "signin", "signup", "register",
  "blog", "landing", "pitch", "partners", "privacy", "terms", "menu", "compare",
  "dashboard", "settings", "rotahr", "www", "static", "public", "assets", "images",
  "v", "new", "edit", "delete", "help", "support", "contact", "about", "pricing",
]);

export function validateSlug(slug: string): { ok: true } | { ok: false; error: string } {
  if (!slug) return { ok: false, error: "Enter a page address." };
  if (slug.length < 3) return { ok: false, error: "Page address must be at least 3 characters." };
  if (slug.length > 60) return { ok: false, error: "Page address must be 60 characters or fewer." };
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return { ok: false, error: "Use lowercase letters, numbers and hyphens only." };
  }
  if (slug.startsWith("-") || slug.endsWith("-")) {
    return { ok: false, error: "Page address can't start or end with a hyphen." };
  }
  if (slug.includes("--")) return { ok: false, error: "Page address can't contain two hyphens in a row." };
  if (RESERVED_SLUGS.has(slug)) return { ok: false, error: "That page address is reserved. Try another." };
  return { ok: true };
}

/** Route an image through the public proxy, since the blob store is private. */
export function publicImageSrc(url?: string | null): string | null {
  if (!url) return null;
  if (!url.includes("blob.vercel-storage.com")) return url; // already public/external
  return `/api/public/venue-image?url=${encodeURIComponent(url)}`;
}

export function formatPrice(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-IE", {
      style: "currency",
      currency: currency || "EUR",
      minimumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}
