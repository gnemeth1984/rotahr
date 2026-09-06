/**
 * Lead Finder — OpenStreetMap venue search.
 *
 * Finds restaurants, bars, cafes and pubs that have NO website, anywhere in
 * the world, using only free public services:
 *
 *   Nominatim  free-text place name  ->  an OSM area to search inside
 *   Overpass   that area             ->  venues with their tags
 *
 * Both are volunteer-funded and WILL block us if we hammer them. So:
 *   - Nominatim is capped at one request per second and results are cached
 *     in-process for an hour. It also needs a real User-Agent naming us.
 *   - Overpass queries carry an explicit timeout and a hard result cap, and
 *     fall back to a mirror on 429/504.
 *
 * OSM data is ODbL. Anything that displays these results has to carry
 * "(c) OpenStreetMap contributors". See ATTRIBUTION below.
 *
 * WHAT COUNTS AS A LEAD (Gabor's rules, 2026-09-06):
 *   exclude  any website tag at all
 *   require  a phone number OR a usable street address
 *   exclude  chains and franchises
 *   show     facebook / instagram / email as signals, never exclude on them
 *
 * The false positive rate is real and accepted: OSM is volunteer-maintained,
 * so "no website tag" often means "nobody has added it yet", not "this venue
 * has no website". Treat the output as a calling list to qualify, not a
 * verified fact about the venue.
 *
 * Pure module. No Prisma, no next/server. Safe to unit test.
 */

export const ATTRIBUTION = "© OpenStreetMap contributors";

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

/** Nominatim's usage policy asks for a real UA with a contact address. */
const USER_AGENT =
  "Rotahr/1.0 (hospitality scheduling; https://rotahr.com; sales@rotahr.com)";

/** Hard ceiling. Overpass is a shared free service, do not go fishing. */
export const MAX_RESULTS = 300;

export const VENUE_TYPES = [
  "restaurant",
  "bar",
  "cafe",
  "pub",
  "fast_food",
] as const;
export type VenueType = (typeof VENUE_TYPES)[number];

export interface LeadCandidate {
  osmType: string;
  osmId: string;
  osmKey: string;
  name: string;
  category: string;
  phone: string | null;
  email: string | null;
  address: string;
  city: string;
  region: string;
  country: string;
  lat: number | null;
  lng: number | null;
  facebook: string | null;
  instagram: string | null;
  /** Human readable list of what this venue is missing, for the results table. */
  missing: string[];
  /** Higher is a better calling prospect. Phone beats address-only. */
  score: number;
}

export interface SearchOutcome {
  place: string;
  /** What Nominatim actually resolved the place box to. */
  resolvedPlace: string;
  country: string;
  /** Set when we could not get a boundary and fell back to a radius search. */
  radiusKm: number | null;
  totalFound: number;
  candidates: LeadCandidate[];
  dropped: {
    hasWebsite: number;
    chain: number;
    noContact: number;
    unnamed: number;
  };
  attribution: string;
}

// ─── Chains ──────────────────────────────────────────────────────────────────

/**
 * Names that are chains anywhere they appear. Not exhaustive and never will
 * be. The structural tags (brand, operator, franchise) catch far more than
 * this list does; the list is only for chains a mapper tagged sloppily.
 */
const CHAIN_NAMES = [
  "mcdonald", "burger king", "kfc", "subway", "starbucks", "costa coffee",
  "costa", "domino", "papa john", "pizza hut", "nando", "pret a manger",
  "pret", "greggs", "insomnia coffee", "insomnia", "supermac", "eddie rocket",
  "apache pizza", "four star pizza", "butlers chocolate", "wagamama",
  "tgi friday", "hard rock cafe", "five guys", "taco bell", "wendy",
  "dunkin", "tim hortons", "chipotle", "panera", "caffe nero", "cafe nero",
  "leon", "itsu", "wetherspoon", "harvester", "toby carvery", "pizza express",
  "zizzi", "ask italian", "bella italia", "cafe rouge", "byron", "gbk",
  "gourmet burger kitchen", "yo! sushi", "wasabi", "eat.", "pizzahut",
  "papa murphy", "jersey mike", "arby", "sonic drive", "whataburger",
  "in-n-out", "shake shack", "popeyes", "church's chicken", "hardee",
  "carl's jr", "jack in the box", "del taco", "panda express", "quiznos",
  "boston pizza", "a&w", "harvey's", "swiss chalet", "mary brown",
  "hungry jack", "red rooster", "guzman y gomez", "grill'd", "zambrero",
];

function looksLikeChainName(name: string): boolean {
  const n = name.toLowerCase();
  return CHAIN_NAMES.some((c) => n.includes(c));
}

// ─── Nominatim ───────────────────────────────────────────────────────────────

interface GeoHit {
  displayName: string;
  lat: number;
  lon: number;
  countryCode: string;
  /** Overpass area id, when the place resolved to a boundary we can use. */
  areaId: number | null;
}

const geoCache = new Map<string, { at: number; hit: GeoHit | null }>();
const GEO_TTL_MS = 60 * 60 * 1000;

let lastNominatimAt = 0;

/** Nominatim allows at most 1 req/s. Serialise ourselves rather than get banned. */
async function nominatimThrottle() {
  const wait = 1100 - (Date.now() - lastNominatimAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastNominatimAt = Date.now();
}

export async function geocodePlace(place: string): Promise<GeoHit | null> {
  const key = place.trim().toLowerCase();
  if (!key) return null;

  const cached = geoCache.get(key);
  if (cached && Date.now() - cached.at < GEO_TTL_MS) return cached.hit;

  await nominatimThrottle();

  const url = `${NOMINATIM}?q=${encodeURIComponent(place)}&format=jsonv2&limit=1&addressdetails=1`;
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(
      res.status === 429
        ? "OpenStreetMap's place lookup is rate limiting us. Wait a minute and try again."
        : `Place lookup failed (${res.status}).`,
    );
  }

  const rows = (await res.json()) as any[];
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) {
    geoCache.set(key, { at: Date.now(), hit: null });
    return null;
  }

  // Overpass area ids: relations are 3600000000 + id, ways 2400000000 + id.
  // A node (a single point, eg a small village marker) has no area at all,
  // so those fall back to a radius search.
  let areaId: number | null = null;
  const osmId = Number(row.osm_id);
  if (row.osm_type === "relation" && Number.isFinite(osmId)) {
    areaId = 3600000000 + osmId;
  } else if (row.osm_type === "way" && Number.isFinite(osmId)) {
    areaId = 2400000000 + osmId;
  }

  const hit: GeoHit = {
    displayName: String(row.display_name ?? place),
    lat: Number(row.lat),
    lon: Number(row.lon),
    countryCode: String(row.address?.country_code ?? "").toLowerCase(),
    areaId,
  };

  geoCache.set(key, { at: Date.now(), hit });
  return hit;
}

// ─── Overpass ────────────────────────────────────────────────────────────────

function amenityFilter(types: VenueType[]): string {
  return `["amenity"~"^(${types.join("|")})$"]`;
}

/**
 * Search inside an administrative boundary. Better than a circle for a city,
 * because it follows the real edge of the place.
 *
 * Only works when Overpass actually HAS an area for that relation. It builds
 * areas for a subset of OSM objects (mostly admin boundaries), so plenty of
 * small towns have none at all - Clonakilty, Co. Cork is a live example:
 * area(3614584068) and area["name"="Clonakilty"] both match an empty set
 * while a radius search around the same point finds 43 venues. That is why
 * findLeads always falls back to radius on an empty area result.
 */
function areaQuery(areaId: number, types: VenueType[], limit: number): string {
  return `[out:json][timeout:60];\narea(${areaId})->.a;\n(\n  nwr${amenityFilter(types)}(area.a);\n);\nout body center ${limit};`;
}

/** Circle around the geocoded point. Works anywhere on earth. */
function radiusQuery(
  geo: GeoHit,
  types: VenueType[],
  radiusKm: number,
  limit: number,
): string {
  return `[out:json][timeout:60];\n(\n  nwr${amenityFilter(types)}(around:${Math.round(
    radiusKm * 1000,
  )},${geo.lat},${geo.lon});\n);\nout body center ${limit};`;
}

async function runOverpass(query: string): Promise<any[]> {
  let lastErr: Error | null = null;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": USER_AGENT,
        },
        body: `data=${encodeURIComponent(query)}`,
        cache: "no-store",
      });

      if (res.status === 429 || res.status === 504 || res.status === 503) {
        lastErr = new Error(
          "OpenStreetMap's search servers are busy right now. Try again in a minute.",
        );
        continue; // try the mirror
      }
      if (!res.ok) {
        lastErr = new Error(`Venue search failed (${res.status}).`);
        continue;
      }

      const json = (await res.json()) as any;
      return Array.isArray(json?.elements) ? json.elements : [];
    } catch (e: any) {
      lastErr = new Error(e?.message || "Venue search failed.");
    }
  }

  throw lastErr ?? new Error("Venue search failed.");
}

// ─── Filtering ───────────────────────────────────────────────────────────────

const WEBSITE_TAGS = [
  "website",
  "contact:website",
  "url",
  "contact:url",
  "brand:website",
  "website:menu",
];

const CHAIN_TAGS = ["brand", "brand:wikidata", "operator", "franchise", "operator:wikidata"];

function firstTag(tags: Record<string, string>, keys: string[]): string | null {
  for (const k of keys) {
    const v = tags[k];
    if (v && String(v).trim()) return String(v).trim();
  }
  return null;
}

function buildAddress(tags: Record<string, string>): string {
  const parts = [
    [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" "),
    tags["addr:city"] || tags["addr:town"] || tags["addr:village"],
    tags["addr:postcode"],
  ].filter((p) => p && String(p).trim());
  return parts.join(", ");
}

/**
 * Turn raw Overpass elements into leads, applying Gabor's rules.
 *
 * Exported separately from the network call so it can be tested without
 * hitting OSM at all.
 */
export function filterElements(
  elements: any[],
  ctx: { region: string; country: string },
): { candidates: LeadCandidate[]; dropped: SearchOutcome["dropped"] } {
  const dropped = { hasWebsite: 0, chain: 0, noContact: 0, unnamed: 0 };

  // First pass: count names so a local chain (same name 3+ times in one town)
  // can be spotted even when nobody tagged it as a brand.
  const nameCounts = new Map<string, number>();
  for (const el of elements) {
    const n = String(el?.tags?.name ?? "").trim().toLowerCase();
    if (n) nameCounts.set(n, (nameCounts.get(n) ?? 0) + 1);
  }

  const candidates: LeadCandidate[] = [];

  for (const el of elements) {
    const tags: Record<string, string> = el?.tags ?? {};
    const name = String(tags.name ?? "").trim();

    if (!name) {
      dropped.unnamed++;
      continue;
    }

    // Rule 1: no website, of any kind.
    if (firstTag(tags, WEBSITE_TAGS)) {
      dropped.hasWebsite++;
      continue;
    }

    // Rule 2: no chains or franchises.
    const structuralChain = CHAIN_TAGS.some((k) => tags[k] && String(tags[k]).trim());
    const repeatedLocally = (nameCounts.get(name.toLowerCase()) ?? 0) >= 3;
    if (structuralChain || looksLikeChainName(name) || repeatedLocally) {
      dropped.chain++;
      continue;
    }

    // Rule 3: reachable. A phone, or an address good enough to walk into.
    const phone = firstTag(tags, ["phone", "contact:phone", "contact:mobile", "mobile"]);
    const address = buildAddress(tags);
    const hasUsableAddress =
      Boolean(tags["addr:street"]) &&
      Boolean(
        tags["addr:housenumber"] ||
          tags["addr:city"] ||
          tags["addr:town"] ||
          tags["addr:village"],
      );

    if (!phone && !hasUsableAddress) {
      dropped.noContact++;
      continue;
    }

    // Signals. Displayed, never a reason to drop a row.
    const facebook = firstTag(tags, ["contact:facebook", "facebook"]);
    const instagram = firstTag(tags, ["contact:instagram", "instagram"]);
    const email = firstTag(tags, ["email", "contact:email"]);

    const missing: string[] = ["No website"];
    if (!facebook) missing.push("No Facebook");
    if (!instagram) missing.push("No Instagram");
    if (!phone) missing.push("No phone");
    if (!tags["opening_hours"]) missing.push("No opening hours");

    // Best-first: a phone is the whole point, an email is a bonus, an
    // address alone means a cold walk-in.
    let score = 0;
    if (phone) score += 100;
    if (email) score += 20;
    if (address) score += 10;
    if (!facebook && !instagram) score += 15; // genuinely invisible online
    if (tags["opening_hours"]) score += 5;

    const osmType = String(el.type ?? "node");
    const osmId = String(el.id ?? "");

    candidates.push({
      osmType,
      osmId,
      osmKey: `${osmType}/${osmId}`,
      name,
      category: String(tags.amenity ?? "restaurant"),
      phone,
      email,
      address,
      city:
        tags["addr:city"] ||
        tags["addr:town"] ||
        tags["addr:village"] ||
        "",
      region: ctx.region,
      country: ctx.country,
      lat: Number.isFinite(el.lat) ? el.lat : (el.center?.lat ?? null),
      lng: Number.isFinite(el.lon) ? el.lon : (el.center?.lon ?? null),
      facebook,
      instagram,
      missing,
      score,
    });
  }

  candidates.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return { candidates, dropped };
}

// ─── Entry point ─────────────────────────────────────────────────────────────

export async function findLeads(opts: {
  place: string;
  types?: VenueType[];
  radiusKm?: number;
  limit?: number;
}): Promise<SearchOutcome> {
  const place = (opts.place ?? "").trim();
  if (place.length < 2) throw new Error("Type a town, city or area to search.");

  const types = (opts.types?.length ? opts.types : [...VENUE_TYPES]).filter(
    (t): t is VenueType => (VENUE_TYPES as readonly string[]).includes(t),
  );
  if (!types.length) throw new Error("Pick at least one venue type.");

  const limit = Math.min(Math.max(opts.limit ?? MAX_RESULTS, 1), MAX_RESULTS);
  const radiusKm = Math.min(Math.max(opts.radiusKm ?? 8, 1), 30);

  const geo = await geocodePlace(place);
  if (!geo) {
    throw new Error(
      `OpenStreetMap does not know a place called "${place}". Try adding the county or country, eg "Galway, Ireland".`,
    );
  }

  // Area first when we have one - it follows the real edge of the place.
  // Fall back to a radius the moment it comes back empty, because plenty of
  // towns have no Overpass area at all (see areaQuery's note).
  let elements: any[] = [];
  let usedRadiusKm: number | null = null;

  if (geo.areaId) {
    elements = await runOverpass(areaQuery(geo.areaId, types, limit));
  }
  if (!elements.length) {
    elements = await runOverpass(radiusQuery(geo, types, radiusKm, limit));
    usedRadiusKm = radiusKm;
  }

  // Nominatim's display_name is "Town, County, Country" - the second-to-last
  // part is a decent region label, and good enough for a calling list.
  const parts = geo.displayName.split(",").map((p) => p.trim());
  const region = parts.length >= 2 ? parts[parts.length - 2] : "";

  const { candidates, dropped } = filterElements(elements, {
    region,
    country: geo.countryCode,
  });

  return {
    place,
    resolvedPlace: geo.displayName,
    country: geo.countryCode,
    radiusKm: usedRadiusKm,
    totalFound: elements.length,
    candidates,
    dropped,
    attribution: ATTRIBUTION,
  };
}
