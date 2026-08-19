// Search-intent helpers for the public venue page (rotahr.com/v/<slug>).
//
// Search Console shows these pages surface almost entirely for NAVIGATIONAL
// queries — "<venue> menu", "<venue> opening hours", "<venue> phone number",
// "<venue> <town>" — sitting at position 8-19. The old title was
// `${name} — ${tagline}`, which carried none of those intent words and no town,
// and often duplicated the name ("Dewdrop Bistro — Dewdrop Bistro in Ross
// Carbery"). These builders put the intent words and the locality in the title
// instead, and only ever promise what the page can actually show.

/** Irish counties, for stripping "Co. Kerry" style parts out of an address. */
const COUNTIES = new Set([
  "carlow", "cavan", "clare", "cork", "donegal", "dublin", "galway", "kerry",
  "kildare", "kilkenny", "laois", "leitrim", "limerick", "longford", "louth",
  "mayo", "meath", "monaghan", "offaly", "roscommon", "sligo", "tipperary",
  "waterford", "westmeath", "wexford", "wicklow", "antrim", "armagh", "down",
  "fermanagh", "londonderry", "derry", "tyrone",
]);

const EIRCODE = /^(eircode\s*)?[a-z]\d{2}\s?[a-z0-9]{4}$/i;

/**
 * Best-effort town from a free-text address.
 *
 * Addresses in this corpus are consistently
 * `street[, suburb], TOWN, Co. COUNTY[, Ireland][, EIRCODE]`, so the town is
 * the last part once the country, eircode and county are removed.
 */
export function localityFromAddress(address?: string | null): string | null {
  if (!address) return null;

  const parts = address
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => !EIRCODE.test(p))
    .filter((p) => !/^(ireland|Éire|eire|uk|united kingdom)$/i.test(p))
    // "Co. Kerry" / "County Kerry" is never the town.
    .filter((p) => !/^(co\.?|county)\s+/i.test(p));

  if (!parts.length) return null;

  // A bare county name ("Baltimore, Cork, Ireland") is a weaker locality than
  // the town before it — drop it, but only while something better survives.
  const trimmed = [...parts];
  while (trimmed.length > 1 && COUNTIES.has(trimmed[trimmed.length - 1].toLowerCase())) {
    trimmed.pop();
  }

  const town = trimmed[trimmed.length - 1];
  // Guard against a street sneaking through on a one-line address.
  if (/\d/.test(town) && trimmed.length === 1) return null;
  return town || null;
}

/**
 * Drop a tagline that just restates the name, or that is obviously scraped
 * boilerplate ("Connect with X on Facebook"), so it never reaches a title tag.
 */
export function usableTagline(name: string, tagline?: string | null): string | null {
  if (!tagline) return null;
  const t = tagline.trim();
  if (!t) return null;
  if (/^(connect with|follow|visit us on|find us on|like us on)\b/i.test(t)) return null;

  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const n = norm(name);
  // "Dewdrop Bistro in Ross Carbery" against name "Dewdrop Bistro".
  if (n && norm(t).startsWith(n)) return null;
  return t;
}

export interface PageFacts {
  name: string;
  locality: string | null;
  hasMenu: boolean;
  hasHours: boolean;
  hasPhone: boolean;
}

/**
 * Title built from what the searcher typed, not from marketing copy.
 * Kept near 60 characters so it survives in the SERP.
 */
export function buildTitle({ name, locality, hasMenu, hasHours, hasPhone }: PageFacts): string {
  const bits: string[] = [];
  if (hasMenu) bits.push("Menu");
  if (hasHours) bits.push("Opening Hours");
  // Only offer "Contact" when there is nothing stronger to lead with, so the
  // title does not become a list of four things.
  if (hasPhone && bits.length < 2) bits.push("Contact");

  const intent = bits.length ? bits.join(" & ") : "Address & Contact";
  const base = `${name} — ${intent}`;
  return locality ? `${base} | ${locality}` : base;
}

/**
 * Description that answers the query in the first clause. Never claims a menu
 * or opening hours the page cannot show.
 */
export function buildDescription(
  facts: PageFacts & {
    venueType?: string | null;
    cuisine?: string | null;
    phone?: string | null;
    about?: string | null;
    canBook?: boolean;
  }
): string {
  const { name, locality, cuisine, venueType, hasMenu, hasHours, hasPhone, phone } = facts;

  const kind = [cuisine, venueType].filter(Boolean).join(" ") || null;
  const lead = [
    name,
    kind ? `is ${article(kind)} ${kind}` : null,
    locality ? `in ${locality}` : null,
  ]
    .filter(Boolean)
    .join(" ");

  const offers: string[] = [];
  if (hasHours) offers.push("opening hours");
  if (hasMenu) offers.push("menu");
  if (hasPhone) offers.push("phone number");
  // "directions" always applies — every page carries a Google Maps link.
  offers.push("directions");

  const sentences = [
    `${lead}.`,
    `Find ${listify(offers)}${facts.canBook ? ", and book a table online" : ""}.`,
  ];

  // Only fall back to the about copy when it adds something beyond the above.
  let out = sentences.join(" ");
  if (out.length < 110 && facts.about) {
    out = `${out} ${sentence(facts.about)}`;
  }
  if (!hasHours && hasPhone && phone) {
    out = `${out} Call ${phone} to confirm opening times.`;
  }
  return clamp(out, 158);
}

/** "a" / "an" — cuisines like "Irish" and "Asian street food" read wrong with "a". */
function article(word: string): string {
  return /^[aeiou]/i.test(word.trim()) ? "an" : "a";
}

/** Ensure a fragment ends in a full stop so clauses do not run together. */
function sentence(text: string): string {
  const t = text.trim();
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

function listify(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function clamp(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const stop = cut.lastIndexOf(" ");
  return `${(stop > max * 0.6 ? cut.slice(0, stop) : cut).replace(/[,.;:]$/, "")}…`;
}
