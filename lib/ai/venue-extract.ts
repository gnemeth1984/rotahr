// Turn a public URL (Google Maps listing, Facebook page, venue website) into a
// draft public-page record for Gabor to review.
//
// Rule that matters: this only ever reports what it actually found. These pages
// go live on rotahr.com under a real business's name, so an invented phone
// number or made-up opening hours is worse than a blank field.
//
// Three sources, merged in priority order:
//   1. The URL itself. Facebook and Google Maps both refuse ordinary fetches
//      (HTTP 400), so we retry as Googlebot, which they still serve. Even then
//      Facebook only hands over a name and a category — everything else is
//      behind a login now.
//   2. OpenStreetMap (Nominatim). Free, no API key, and for pubs/cafes it often
//      has address, phone, website, coordinates and opening hours. Only used to
//      fill gaps, and always flagged for review since a name match can easily be
//      the wrong branch.
//   3. The venue's own website, if step 1 or 2 turned one up. Usually the
//      richest source of all.

import OpenAI from "openai";
import type { OpeningHoursEntry } from "@/lib/public-page/types";

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export interface ExtractedVenue {
  name: string | null;
  tagline: string | null;
  about: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  facebook: string | null;
  instagram: string | null;
  venueType: string | null;
  cuisine: string | null;
  geoLat: number | null;
  geoLng: number | null;
  openingHours: OpeningHoursEntry[] | null;
  notesForReview: string[];
  sourcesUsed: string[];
}

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";
const BOT_UA = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
const OSM_UA = "Rotahr/1.0 (venue directory; https://rotahr.com)";

const EMPTY: ExtractedVenue = {
  name: null,
  tagline: null,
  about: null,
  address: null,
  phone: null,
  email: null,
  website: null,
  facebook: null,
  instagram: null,
  venueType: null,
  cuisine: null,
  geoLat: null,
  geoLng: null,
  openingHours: null,
  notesForReview: [],
  sourcesUsed: [],
};

/** Strip a fetched HTML document down to readable text the model can work with. */
export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;|&rsquo;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&ndash;|&mdash;/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

/** og: / twitter: meta tags survive on pages whose body is JS-rendered. */
export function metaTags(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /<meta[^>]+(?:property|name)=["']([^"']+)["'][^>]+content=["']([^"']*)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const key = m[1].toLowerCase();
    if (key.startsWith("og:") || key.startsWith("twitter:") || key === "description") {
      if (!out[key]) out[key] = m[2];
    }
  }
  return out;
}

/** Pull lat/lng straight out of a Google Maps URL when it's in there. */
export function coordsFromUrl(url: string): { lat: number; lng: number } | null {
  const at = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (at) return { lat: Number(at[1]), lng: Number(at[2]) };
  const q = url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (q) return { lat: Number(q[1]), lng: Number(q[2]) };
  return null;
}

/** Best-effort venue name from a Facebook/Maps URL slug, for the OSM lookup. */
export function nameGuessFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("facebook.com")) {
      const seg = u.pathname.split("/").filter(Boolean)[0];
      if (!seg || /^(pages|profile\.php|people)$/.test(seg)) return null;
      return seg.replace(/[-_.]+/g, " ").replace(/\d{6,}/g, "").trim() || null;
    }
    if (u.hostname.includes("google.")) {
      const m = u.pathname.match(/\/place\/([^/@]+)/);
      if (m) return decodeURIComponent(m[1]).replace(/\+/g, " ").trim() || null;
    }
    return null;
  } catch {
    return null;
  }
}

export interface Fetched {
  text: string;
  meta: Record<string, string>;
  ok: boolean;
  /** Raw HTML, kept so callers can read mailto:/tel: hrefs that htmlToText drops. */
  html?: string;
}

export async function fetchPage(url: string): Promise<Fetched> {
  // Facebook and Google Maps answer 400 to an ordinary browser UA from a server,
  // but still serve Googlebot. Try the honest UA first, then fall back.
  for (const ua of [BROWSER_UA, BOT_UA]) {
    try {
      const res = await fetch(url, {
        redirect: "follow",
        headers: { "User-Agent": ua, "Accept-Language": "en-IE,en;q=0.9" },
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) continue;
      const html = await res.text();
      return {
        text: htmlToText(html).slice(0, 30000),
        meta: metaTags(html),
        ok: true,
        html: html.slice(0, 400000),
      };
    } catch {
      // try the next UA
    }
  }
  return { text: "", meta: {}, ok: false };
}

/** "Mo-Fr 07:30-17:00; Sa 08:30-17:00" -> OpeningHoursEntry[] */
export function parseOsmHours(spec: string): OpeningHoursEntry[] | null {
  const DAYS: Record<string, number> = { su: 0, mo: 1, tu: 2, we: 3, th: 4, fr: 5, sa: 6 };
  const result = new Map<number, OpeningHoursEntry>();

  for (const rawPart of spec.split(";")) {
    const part = rawPart.trim();
    if (!part) continue;
    if (/24\/7/i.test(part)) {
      for (let d = 0; d < 7; d++) result.set(d, { day: d, closed: false, open: "00:00", close: "23:59" });
      continue;
    }

    const m = part.match(/^([A-Za-z,\-]+)\s+(.+)$/);
    if (!m) return null;
    const dayPart = m[1];
    const timePart = m[2].trim();

    const days: number[] = [];
    for (const chunk of dayPart.split(",")) {
      const range = chunk.split("-").map((s) => DAYS[s.trim().slice(0, 2).toLowerCase()]);
      if (range.some((d) => d === undefined)) return null;
      if (range.length === 1) days.push(range[0]);
      else {
        for (let d = range[0]; ; d = (d + 1) % 7) {
          days.push(d);
          if (d === range[1]) break;
          if (days.length > 7) return null;
        }
      }
    }

    if (/^off|closed$/i.test(timePart)) {
      for (const d of days) result.set(d, { day: d, closed: true, open: "00:00", close: "00:00" });
      continue;
    }

    // Only the first time range per day — our model stores one open/close pair.
    const t = timePart.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
    if (!t) return null;
    const open = `${t[1].padStart(2, "0")}:${t[2]}`;
    const close = `${t[3].padStart(2, "0")}:${t[4]}`;
    for (const d of days) result.set(d, { day: d, closed: false, open, close });
  }

  if (!result.size) return null;
  return Array.from({ length: 7 }, (_, d) => result.get(d) ?? { day: d, closed: true, open: "00:00", close: "00:00" });
}

interface OsmHit {
  name: string;
  displayName: string;
  address: string;
  lat: number;
  lng: number;
  phone: string | null;
  website: string | null;
  hours: OpeningHoursEntry[] | null;
  category: string | null;
}

/** Great-circle distance in km, for sanity-checking a name match against a pin. */
export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Look the venue up on OpenStreetMap. Free, keyless, and good on Irish pubs.
 *
 * `near` matters more than it looks. Venue names are not unique — searching
 * "The Long Hall" unbounded returns a bar in Manhattan, and a Dublin pub was
 * published with a New York address because of it. When the pasted URL carries
 * coordinates we bias the search to that area and reject anything implausibly
 * far from the pin.
 */
export async function lookupOsm(
  query: string,
  near?: { lat: number; lng: number } | null
): Promise<OsmHit | null> {
  try {
    // ~55km box around the pin: generous enough for a vaguely-placed marker,
    // tight enough to exclude a same-named venue in another country.
    const box = near
      ? `&viewbox=${near.lng - 0.5},${near.lat + 0.5},${near.lng + 0.5},${near.lat - 0.5}&bounded=1`
      : "";
    const url =
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}` +
      `&format=jsonv2&addressdetails=1&extratags=1&limit=1${box}`;
    const res = await fetch(url, {
      headers: { "User-Agent": OSM_UA, "Accept-Language": "en" },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    const rows = await res.json();
    const hit = Array.isArray(rows) ? rows[0] : null;
    if (!hit) return null;

    // A bounded search can still return an edge case, so verify the result is
    // actually near the pin rather than trusting the viewbox.
    if (near) {
      const d = distanceKm(near, { lat: Number(hit.lat), lng: Number(hit.lon) });
      if (!Number.isFinite(d) || d > 60) return null;
    }

    const a = hit.address || {};
    const ex = hit.extratags || {};
    const line = [
      [a.house_number, a.road].filter(Boolean).join(" "),
      a.village || a.town || a.city || a.city_district,
      a.county,
      a.postcode,
    ]
      .filter(Boolean)
      .join(", ");

    return {
      name: hit.name || "",
      displayName: hit.display_name || "",
      address: line || hit.display_name || "",
      lat: Number(hit.lat),
      lng: Number(hit.lon),
      phone: ex.phone || ex["contact:phone"] || null,
      website: ex.website || ex["contact:website"] || null,
      hours: ex.opening_hours ? parseOsmHours(ex.opening_hours) : null,
      category: hit.type || hit.category || null,
    };
  } catch {
    return null;
  }
}

const SYSTEM = `
You extract factual business details for a hospitality venue directory page.

CRITICAL RULES:
- Only report details that literally appear in the supplied source text. Never guess, never infer, never fill a plausible-looking value. A null is always better than a wrong fact — these pages are published publicly under the real business's name.
- Do not invent opening hours, phone numbers, emails or addresses. Copy them exactly as written.
- "about" must be 1-3 sentences of plain description built ONLY from facts in the sources (what kind of venue it is, where it is, what it is known for). No marketing adjectives you cannot support, no claims about food quality, no prices, no menu items unless explicitly listed.
- "tagline" is one short line, max 90 characters, also fact-based.
- venueType must be one of: restaurant, cafe, bar, pub, hotel, other.
- openingHours: array of { day, closed, open, close } where day 0=Sunday..6=Saturday, times "HH:mm" 24-hour. Include only days you can determine.
- notesForReview: short strings flagging anything ambiguous, contradictory across sources, or worth a human check.

Return ONLY JSON.
`.trim();

export async function extractVenueFromUrl(url: string): Promise<ExtractedVenue> {
  const sources: { label: string; text: string }[] = [];
  const notes: string[] = [];
  const sourcesUsed: string[] = [];
  const isFacebook = /facebook\.com/i.test(url);
  const isMaps = /google\.[a-z.]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps/i.test(url);

  // --- 1. the URL the user pasted ---------------------------------------
  const primary = await fetchPage(url);
  let nameHint: string | null = null;
  let websiteHint: string | null = null;

  if (primary.ok) {
    const metaLines = Object.entries(primary.meta)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n");
    if (primary.text.length > 150 || metaLines) {
      sources.push({ label: `Pasted URL (${url})`, text: `${metaLines}\n\n${primary.text}`.trim() });
      sourcesUsed.push(isFacebook ? "Facebook page" : isMaps ? "Google Maps" : "Pasted page");
    }
    nameHint = primary.meta["og:title"] || null;
  }

  if (!nameHint) nameHint = nameGuessFromUrl(url);

  if (isFacebook) {
    notes.push(
      "Facebook only exposes the page name publicly now — address, phone and hours are behind a login, so they were looked up elsewhere. Check them."
    );
  }
  if (isMaps && !primary.ok) {
    notes.push("Google Maps blocked the fetch. Details below came from OpenStreetMap — verify them.");
  }

  // --- 2. OpenStreetMap gap-filler ---------------------------------------
  const urlCoords = coordsFromUrl(url);
  let osm: OsmHit | null = null;
  if (nameHint) {
    osm = await lookupOsm(nameHint, urlCoords);
    if (osm) {
      sourcesUsed.push("OpenStreetMap");
      websiteHint = osm.website;
      const nameMatches = osm.name.toLowerCase().includes(nameHint.toLowerCase().split(" ")[0] ?? "");
      notes.push(
        `OpenStreetMap matched "${osm.name}" (${osm.displayName}). ${
          nameMatches ? "Confirm it's the same venue" : "The name doesn't match exactly — confirm this is the right place"
        } before saving.`
      );
    } else if (urlCoords) {
      notes.push(
        "Nothing matching that name on OpenStreetMap near the map pin. Address and hours will be blank unless the venue has its own website."
      );
    }
  }

  // --- 3. the venue's own website ----------------------------------------
  const siteUrl = websiteHint && !/facebook\.com|instagram\.com/i.test(websiteHint) ? websiteHint : null;
  if (siteUrl) {
    const site = await fetchPage(siteUrl);
    if (site.ok && site.text.length > 200) {
      const metaLines = Object.entries(site.meta)
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n");
      sources.push({ label: `Venue website (${siteUrl})`, text: `${metaLines}\n\n${site.text}`.trim() });
      sourcesUsed.push("Venue website");
    }
  }

  if (!sources.length && !osm) {
    return {
      ...EMPTY,
      facebook: isFacebook ? url : null,
      notesForReview: [
        "Couldn't get anything readable from that URL and nothing matched on OpenStreetMap. Facebook and Google Maps both hide venue details from non-logged-in visitors now — try the venue's own website, or fill the details in by hand.",
      ],
    };
  }

  // --- ask the model to reconcile the sources ----------------------------
  let parsed: Partial<ExtractedVenue> = {};
  if (sources.length) {
    const openai = getOpenAI();
    const body = sources.map((s) => `### ${s.label}\n${s.text}`).join("\n\n");
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: `Sources:\n\n${body}\n\nReturn JSON with keys: name, tagline, about, address, phone, email, website, facebook, instagram, venueType, cuisine, geoLat, geoLng, openingHours, notesForReview. Use null for anything not stated in the sources.`,
        },
      ],
    });
    try {
      parsed = JSON.parse(completion.choices[0]?.message?.content || "{}");
    } catch {
      notes.push("The AI response couldn't be read — the fields below came from the raw sources only.");
    }
  }

  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const coords = urlCoords;

  // The model happily returns { closed: true, open: null } — coerce every entry
  // into the strict { day, closed, open, close } shape the save endpoint accepts.
  const cleanHours = (raw: unknown): OpeningHoursEntry[] | null => {
    if (!Array.isArray(raw) || !raw.length) return null;
    const out: OpeningHoursEntry[] = [];
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const day = Number(o.day);
      if (!Number.isInteger(day) || day < 0 || day > 6) continue;
      const time = (v: unknown, fallback: string) =>
        typeof v === "string" && /^\d{1,2}:\d{2}$/.test(v) ? v.padStart(5, "0") : fallback;
      out.push({
        day,
        closed: Boolean(o.closed),
        open: time(o.open, "00:00"),
        close: time(o.close, "00:00"),
      });
    }
    out.sort((a, b) => a.day - b.day);
    return out.length ? out : null;
  };

  const modelHours = cleanHours(parsed.openingHours);

  // Page data wins; OSM only fills what's still blank.
  const result: ExtractedVenue = {
    name: str(parsed.name) ?? nameHint ?? osm?.name ?? null,
    tagline: str(parsed.tagline),
    about: str(parsed.about),
    address: str(parsed.address) ?? osm?.address ?? null,
    phone: str(parsed.phone) ?? osm?.phone ?? null,
    email: str(parsed.email),
    website: str(parsed.website) ?? siteUrl,
    facebook: str(parsed.facebook) ?? (isFacebook ? url : null),
    instagram: str(parsed.instagram),
    venueType: str(parsed.venueType),
    cuisine: str(parsed.cuisine),
    geoLat: num(parsed.geoLat) ?? coords?.lat ?? osm?.lat ?? null,
    geoLng: num(parsed.geoLng) ?? coords?.lng ?? osm?.lng ?? null,
    openingHours: modelHours ?? osm?.hours ?? null,
    notesForReview: notes,
    sourcesUsed: Array.from(new Set(sourcesUsed)),
  };

  if (Array.isArray(parsed.notesForReview)) {
    for (const n of parsed.notesForReview) if (typeof n === "string") result.notesForReview.push(n);
  }
  if (!modelHours && osm?.hours) {
    result.notesForReview.push("Opening hours came from OpenStreetMap and may be out of date — worth confirming.");
  }
  if (!result.openingHours) {
    result.notesForReview.push("No opening hours found anywhere — add them by hand or the page stays out of Google.");
  }
  if (!result.address) {
    result.notesForReview.push("No address found — needed before the page can be indexed.");
  }
  result.notesForReview = result.notesForReview.slice(0, 8);

  return result;
}
