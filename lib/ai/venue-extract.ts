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

/**
 * Pull lat/lng straight out of a Google Maps URL when it's in there.
 *
 * Order matters. `!3d<lat>!4d<lng>` inside the `data=` blob is the *place's* own
 * position, whereas `@lat,lng` is only the viewport centre the user happened to
 * be looking at — which can sit streets away, or in another town if they were
 * zoomed out. Prefer the precise one when both are present.
 */
export interface UrlCoords {
  lat: number;
  lng: number;
  /**
   * True only when the numbers are the place's own position (`!3d/!4d`).
   *
   * The distinction decides whether the pin can be reverse-geocoded. Reverse
   * geocoding a viewport centre returns whatever happens to sit at the middle of
   * the screen: the viewport in a Long Hall test URL reverses to "Old Town Cafe"
   * on Chancery Lane, a different business entirely.
   */
  precise: boolean;
}

export function coordsFromUrl(url: string): UrlCoords | null {
  const place = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (place) return { lat: Number(place[1]), lng: Number(place[2]), precise: true };
  const at = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (at) return { lat: Number(at[1]), lng: Number(at[2]), precise: false };
  const q = url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (q) return { lat: Number(q[1]), lng: Number(q[2]), precise: false };
  return null;
}

/**
 * The `?q=` value on a resolved Maps share link.
 *
 * The share button often expands to `maps.google.com?q=Name, Full Address, Eircode`
 * with no coordinates at all. That string is Google's own canonical address for
 * the place, which makes it both a far better OpenStreetMap query than a bare
 * name and strong enough evidence on its own — a name plus a street plus a
 * postcode does not accidentally match a venue on another continent.
 */
export function placeQueryFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("google.")) return null;
    const q = u.searchParams.get("q");
    if (!q) return null;
    const cleaned = q.replace(/\+/g, " ").trim();
    // Bare coordinates are handled by coordsFromUrl, not here.
    if (/^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(cleaned)) return null;
    return cleaned || null;
  } catch {
    return null;
  }
}

/**
 * The address part of a `?q=Name, Street, Town, Eircode` share link.
 *
 * Geocoding the address without the venue name is far more reliable: Nominatim
 * finds "30-32 Westland Row, Dublin 2, D02 DP70" instantly but returns nothing
 * for the same string with "Kennedy's Pub & Restaurant, " on the front.
 */
export function addressPartFromQuery(query: string): string | null {
  const parts = query
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length < 2) return null;
  return parts.slice(1).join(", ");
}

/** Words too common to prove two addresses describe the same place. */
const GENERIC_PLACE_WORDS = new Set([
  "the", "and", "street", "road", "lane", "avenue", "drive", "square", "place",
  "county", "ireland", "united", "kingdom", "states", "america", "north",
  "south", "east", "west", "upper", "lower", "main", "new", "saint", "leinster",
  "munster", "connacht", "ulster", "usa",
]);

/**
 * Does an OpenStreetMap hit actually describe the place the link named?
 *
 * Needed because a search that is not bounded to coordinates roams the planet.
 * A resolved share link for Kennedy's Pub on Westland Row, Dublin published
 * "247A Maple Street, Marlborough, Middlesex County" — a same-named pub in
 * Massachusetts — because a full postal address was treated as self-anchoring.
 * It is not: the anchor has to be checked, by requiring the hit to repeat at
 * least two distinctive words from the query (street, town or postcode).
 */
export function hitAgreesWithQuery(query: string, displayName: string): boolean {
  const tokens = Array.from(
    new Set(
      (query.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []).filter(
        (t) => !GENERIC_PLACE_WORDS.has(t)
      )
    )
  );
  if (tokens.length < 2) return false;
  const hay = displayName.toLowerCase();
  return tokens.filter((t) => hay.includes(t)).length >= 2;
}

/** Do two venue names plausibly refer to the same business? */
export function namesAgree(a: string, b: string): boolean {
  const words = (s: string) =>
    new Set(
      (s.toLowerCase().normalize("NFKD").match(/[a-z0-9]{3,}/g) ?? []).filter(
        (w) => !GENERIC_PLACE_WORDS.has(w)
      )
    );
  const A = words(a);
  const B = words(b);
  if (!A.size || !B.size) return false;
  // Apostrophes differ between sources ("O’Sheas" vs "O’Shea’s"), so compare on
  // prefixes rather than whole words.
  for (const x of A) {
    for (const y of B) {
      if (x === y) return true;
      if (x.length >= 4 && y.length >= 4 && (x.startsWith(y.slice(0, 4)) || y.startsWith(x.slice(0, 4)))) {
        return true;
      }
    }
  }
  return false;
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
      // Share links with no /place/ segment carry it all in ?q= instead, as
      // "Name, Street, Town, Eircode". Only the first segment is the name —
      // returning the whole string would title the page with a postal address.
      const q = placeQueryFromUrl(url);
      if (q) return q.split(",")[0].trim() || null;
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

    return osmHitFrom(hit);
  } catch {
    return null;
  }
}

/** Shape a raw Nominatim row into an OsmHit. */
function osmHitFrom(hit: Record<string, any>): OsmHit {
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
}

/**
 * What OpenStreetMap has at an exact set of coordinates.
 *
 * Searching by name fails for plenty of real venues — O'Shea's Corner in
 * Wicklow is in OpenStreetMap as a pub with a full address, yet no spelling of
 * its name returns it from search. Its map pin finds it first time. Only ever
 * call this with a pin that is the place's own position (`precise`), never a
 * viewport centre, and check the name before trusting the result.
 */
export async function reverseOsm(
  at: { lat: number; lng: number }
): Promise<OsmHit | null> {
  try {
    const url =
      `https://nominatim.openstreetmap.org/reverse?lat=${at.lat}&lon=${at.lng}` +
      `&format=jsonv2&addressdetails=1&extratags=1&zoom=18`;
    const res = await fetch(url, {
      headers: { "User-Agent": OSM_UA, "Accept-Language": "en" },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    const row = await res.json();
    if (!row || row.error || !row.lat) return null;
    return osmHitFrom(row);
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
  // A resolved share link often gives a full postal address in ?q=. Geocoding
  // that is dramatically more reliable than searching a bare venue name.
  const placeQuery = placeQueryFromUrl(url);
  let osm: OsmHit | null = null;
  if (urlCoords || nameHint) {
    // 1. The pin itself, when it's the place's own position. Most trustworthy
    //    thing available — but only adopted if the name agrees, so a slightly
    //    off pin can't hand us the business next door.
    if (urlCoords?.precise && nameHint) {
      const rev = await reverseOsm(urlCoords);
      if (rev && rev.name && namesAgree(nameHint, rev.name)) osm = rev;
    }

    // 2. Google's own "Name, Street, Town, Eircode" string from ?q=.
    if (!osm && placeQuery) {
      const hit = await lookupOsm(placeQuery, urlCoords);
      // Unbounded searches roam the planet, so an unpinned hit has to prove it
      // matches the address that was asked for.
      if (hit && (urlCoords || hitAgreesWithQuery(placeQuery, hit.displayName))) osm = hit;
    }

    // 3. The address without the venue name — Nominatim answers that when it
    //    won't answer the two combined.
    const addressOnly = placeQuery ? addressPartFromQuery(placeQuery) : null;
    if (!osm && addressOnly) {
      const hit = await lookupOsm(addressOnly, urlCoords);
      if (hit && (urlCoords || hitAgreesWithQuery(addressOnly, hit.displayName))) {
        osm = hit;
        notes.push(
          `Address geocoded from the link's own text ("${addressOnly}") rather than matched to a venue on OpenStreetMap — check it names the right building.`
        );
      }
    }

    // 4. The name, but ONLY bounded to a pin. A bare unbounded name search is
    //    what published a Massachusetts address for a Dublin pub; there is no
    //    version of it that is safe.
    if (!osm && nameHint && urlCoords) {
      osm = await lookupOsm(nameHint, urlCoords);
    }

    if (osm) {
      sourcesUsed.push("OpenStreetMap");
      websiteHint = osm.website;
      if (!osm.name) {
        notes.push(`OpenStreetMap placed that address at: ${osm.displayName}. Check it before saving.`);
      } else {
        const agrees = nameHint ? namesAgree(nameHint, osm.name) : false;
        notes.push(
          `OpenStreetMap matched "${osm.name}" (${osm.displayName}). ${
            agrees
              ? "Confirm it's the same venue"
              : "The name doesn't match the link — confirm this is the right place"
          } before saving.`
        );
      }
    } else {
      notes.push(
        urlCoords
          ? "Nothing matching that name on OpenStreetMap near the map pin. Address and hours will be blank unless the venue has its own website."
          : "Nothing on OpenStreetMap for that link, and it carries no coordinates to search around. Address and hours will be blank unless the venue has its own website."
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
    // The venue's own position beats a viewport centre: a URL's `@lat,lng` is
    // wherever the map happened to be pointing and can be a few streets out, so
    // an OpenStreetMap hit for the venue itself is the better pin.
    geoLat: num(parsed.geoLat) ?? (coords?.precise ? coords.lat : null) ?? osm?.lat ?? coords?.lat ?? null,
    geoLng: num(parsed.geoLng) ?? (coords?.precise ? coords.lng : null) ?? osm?.lng ?? coords?.lng ?? null,
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
