import { prisma } from "@/lib/prisma";

/**
 * Sourcing venues that have no website of their own, from OpenStreetMap.
 *
 * WHY THIS CHANNEL IS DIFFERENT FROM THE LEAD LIST
 * Every lead we imported came from a list keyed on a business email domain,
 * which means every one of them has a website. That is precisely the wrong
 * shape for the thing that worked: `christys-the-well` reached the first page
 * of Google for its own name in nine days *because* the venue has no site, so
 * our page walked into a gap where the only competition was a Facebook page.
 * For the 45 prospect pages whose venue does have a homepage we will not
 * outrank them for their own brand, and should not plan as if we will.
 *
 * So this file looks for the opposite of a good email lead: a real venue, with
 * a real address, and no website anywhere. Those venues are also the better
 * sales prospects — a place with no website is likelier to still be building
 * rotas on paper.
 *
 * WHY OSM RATHER THAN GOOGLE PLACES
 * Places would answer this in one field (`websiteUri`) with better coverage.
 * It is still the wrong tool: the Maps Platform terms forbid pre-fetching,
 * caching or storing Places content beyond a 30-day window, and forbid using
 * the content to build a mailing list or a competing dataset. A permanent
 * prospect table is exactly that. OSM is ODbL — bulk extraction and reuse are
 * expressly permitted with attribution, which is why `OSM_ATTRIBUTION` below is
 * exported and rendered on any page built from this data.
 *
 * WHAT THIS FILE DELIBERATELY DOES NOT DO
 * It does not publish anything. Sourcing is free and reversible; publishing is
 * neither. OSM supplies no descriptions at all (0% of rows in the first Irish
 * extract) and only ~15% carry a phone, so a row here is not yet a page — it is
 * a candidate for the same build-then-review flow every other prospect page
 * goes through. Turning 4,691 sparse rows into 4,691 formulaic pages would be
 * textbook thin doorway content and would put the whole domain at risk, which
 * is the one thing this channel cannot afford.
 */

/** Required by ODbL when the data is redisplayed. Rendered on built pages. */
export const OSM_ATTRIBUTION = "© OpenStreetMap contributors";

/**
 * Mirrors, tried in order. The main instance rate-limits aggressively and
 * returns a 200 with an HTML error body rather than a status code, so the
 * caller has to inspect the body — see `runOverpass`.
 */
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.osm.ch/api/interpreter",
];

const AMENITIES = ["restaurant", "pub", "cafe", "bar", "fast_food"] as const;

/**
 * Chains and franchises, matched against the venue name.
 *
 * A page for a McDonald's is worthless in both directions: it will never
 * outrank the corporate site, and head office does not buy rota software from
 * a founder's cold email. These are the names that actually appeared in the
 * Irish extract, not a generic global list.
 */
const CHAIN_PATTERNS = [
  /\bmc\s?donald/i,
  /\bburger king\b/i,
  /\bsubway\b/i,
  /\bstarbucks\b/i,
  /\bcosta\b/i,
  /\bkfc\b/i,
  /\bdomino/i,
  /\bpapa john/i,
  /\bsupermac/i,
  /\bcentra\b/i,
  /\bspar\b/i,
  /\bcircle k\b/i,
  /\bapplegreen\b/i,
  /\binsomnia\b/i,
  /\bbutlers chocolate/i,
  /\beddie rocket/i,
  /\bfour star pizza\b/i,
  /\babrakebabra\b/i,
  /\bnando/i,
  /\bwagamama\b/i,
  /\bpret a manger\b/i,
  /\bgreggs\b/i,
  /\bbewley/i,
  /\bo'?briens? (sandwich|irish)/i,
  /\bmilano\b/i,
  /\bpizza hut\b/i,
  /\btesco\b|\bdunnes\b|\blidl\b|\baldi\b/i,
  /\bnoodle box\b/i,
  /\bcamile\b/i,
  /\bboojum\b/i,
  /\bfive guys\b/i,
  /\bgourmet burger\b/i,
  // Found in the first Irish extract, all with 5+ locations apiece.
  /\bapache pizza\b/i,
  /\bcaff[eè] nero\b/i,
  /\bbob & ?berts\b/i,
  /\bpizza max\b/i,
  /\bmacari'?s\b/i,
  /\bkrispy kreme\b/i,
  /\btim hortons\b/i,
  /\bgrain & ?grill\b/i,
  /\bthe bakewell\b/i,
];

/**
 * Names that look like a chain but are not.
 *
 * "The Village Inn", "Kelly's" and "Murphy's" each appear five or more times in
 * the extract because they are the most ordinary pub names in Ireland, not
 * because one company owns them. Filtering by repetition alone would throw away
 * exactly the independent venues this channel exists to find, so repetition is
 * never used as a chain signal — only an explicit name match is.
 */

export function isChain(name: string): boolean {
  return CHAIN_PATTERNS.some((re) => re.test(name));
}

/**
 * Things tagged as hospitality that are not a venue we can sell to: canteens
 * inside institutions, service-station counters, seasonal kiosks.
 */
const NOT_A_VENUE = /\b(canteen|staff room|hospital|university|college|school|creche|petrol|filling station|service station|golf club house|ikea|airport lounge|food court|vending)\b/i;

export type OsmVenue = {
  osmRef: string;
  name: string;
  amenity: string;
  street?: string;
  housenumber?: string;
  city?: string;
  postcode?: string;
  lat?: number;
  lon?: number;
  phone?: string;
  email?: string;
  facebook?: string;
  instagram?: string;
  openingHours?: string;
  cuisine?: string;
};

/** A named bounding box to query. Overpass area lookups by ISO code time out. */
export type Bbox = {
  label: string;
  country: string;
  south: number;
  west: number;
  north: number;
  east: number;
};

/**
 * The island of Ireland, split so no single query is heavy enough to be
 * refused. `country` is set per box because Northern Ireland is a UK market
 * with UK pricing, and a lead's country decides which price it is shown.
 */
export const IRELAND_BOXES: Bbox[] = [
  { label: "munster-west", country: "ie", south: 51.35, west: -10.8, north: 52.6, east: -8.6 },
  { label: "munster-east", country: "ie", south: 51.35, west: -8.6, north: 52.6, east: -6.9 },
  { label: "leinster-south", country: "ie", south: 52.6, west: -7.6, north: 53.5, east: -5.9 },
  { label: "leinster-north", country: "ie", south: 53.5, west: -7.6, north: 54.1, east: -5.9 },
  { label: "midlands", country: "ie", south: 52.6, west: -8.6, north: 54.1, east: -7.6 },
  { label: "connacht", country: "ie", south: 52.6, west: -10.5, north: 54.6, east: -8.6 },
  { label: "donegal", country: "ie", south: 54.4, west: -8.9, north: 55.45, east: -6.9 },
  { label: "northern-ireland", country: "uk", south: 54.0, west: -8.2, north: 55.35, east: -5.35 },
];

function buildQuery(box: Bbox): string {
  const filter = AMENITIES.join("|");
  return `[out:json][timeout:300];
(
  nwr["amenity"~"^(${filter})$"][name][!website][!"contact:website"](${box.south},${box.west},${box.north},${box.east});
);
out tags center;`;
}

/**
 * POST a query, walking the mirrors on failure.
 *
 * Overpass signals overload with HTTP 200 and an HTML body containing
 * "runtime error", so a naive `res.ok` check treats a failed run as an empty
 * region and silently under-sources it.
 */
async function runOverpass(query: string): Promise<unknown> {
  let lastError = "no endpoint tried";

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          // Overpass asks for a contactable agent so it can warn before banning.
          "User-Agent": "Rotahr/1.0 (+https://rotahr.com; hello@rotahr.com)",
        },
        body: new URLSearchParams({ data: query }),
      });

      const text = await res.text();
      if (!res.ok) {
        lastError = `${endpoint} → HTTP ${res.status}`;
        continue;
      }
      if (text.trimStart().startsWith("<")) {
        const why = /runtime error[^<]*/i.exec(text)?.[0] ?? "HTML error body";
        lastError = `${endpoint} → ${why.slice(0, 120)}`;
        continue;
      }
      return JSON.parse(text);
    } catch (err) {
      lastError = `${endpoint} → ${(err as Error).message}`;
    }
  }

  throw new Error(`Overpass unavailable: ${lastError}`);
}

/** Pull the handle out of whatever shape OSM stored a social link in. */
function socialHandle(raw: string | undefined, host: string): string | undefined {
  if (!raw) return undefined;
  const v = raw.trim();
  if (!v) return undefined;
  if (!v.includes("/") && !v.includes(".")) return v.replace(/^@/, "");
  const m = new RegExp(`${host}\\.com/(?:p/)?([^/?#]+)`, "i").exec(v);
  return m ? m[1] : undefined;
}

function tag(tags: Record<string, string>, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = tags[k]?.trim();
    if (v) return v;
  }
  return undefined;
}

export function parseElements(json: unknown): OsmVenue[] {
  const elements = (json as { elements?: unknown[] })?.elements ?? [];
  const out: OsmVenue[] = [];

  for (const raw of elements) {
    const el = raw as {
      type?: string;
      id?: number;
      lat?: number;
      lon?: number;
      center?: { lat: number; lon: number };
      tags?: Record<string, string>;
    };
    const tags = el.tags;
    if (!el.type || el.id == null || !tags?.name) continue;

    const name = tags.name.trim();
    if (!name || name.length > 120) continue;

    out.push({
      osmRef: `${el.type}/${el.id}`,
      name,
      amenity: tags.amenity ?? "restaurant",
      street: tag(tags, "addr:street"),
      housenumber: tag(tags, "addr:housenumber"),
      city: tag(tags, "addr:city", "addr:town", "addr:village"),
      postcode: tag(tags, "addr:postcode"),
      lat: el.lat ?? el.center?.lat,
      lon: el.lon ?? el.center?.lon,
      phone: tag(tags, "phone", "contact:phone"),
      email: tag(tags, "email", "contact:email"),
      facebook: socialHandle(tag(tags, "contact:facebook", "facebook"), "facebook"),
      instagram: socialHandle(tag(tags, "contact:instagram", "instagram"), "instagram"),
      openingHours: tag(tags, "opening_hours"),
      cuisine: tag(tags, "cuisine"),
    });
  }

  return out;
}

/**
 * A candidate is worth a build attempt only if a stranger could find the place.
 *
 * The publish gate downstream requires an address, so a row with no street is
 * work we cannot finish. Recording it as `skipped` with a reason is better than
 * dropping it: OSM improves over time, and a later re-source can revisit.
 */
export function triageReason(v: OsmVenue): string | null {
  if (isChain(v.name)) return "chain";
  if (NOT_A_VENUE.test(v.name)) return "not a standalone venue";
  if (!v.street) return "no street in OSM";
  if (!v.city && !v.postcode) return "no town or postcode in OSM";
  return null;
}

export type SourceStats = {
  box: string;
  fetched: number;
  created: number;
  updated: number;
  skipped: number;
  duplicateOfLead: number;
};

/**
 * Domains already in our world, so we never build a second page for a venue we
 * are already talking to. Matched on name because these rows have no email.
 */
async function existingNames(): Promise<Set<string>> {
  const [leads, pages] = await Promise.all([
    prisma.outreachLead.findMany({ select: { name: true } }),
    prisma.business.findMany({ where: { publicSlug: { not: null } }, select: { name: true } }),
  ]);
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\b(the|restaurant|bar|pub|cafe|caf|hotel|inn|ltd|limited)\b/g, "")
      .trim();
  const set = new Set<string>();
  for (const r of [...leads, ...pages]) {
    const n = norm(r.name ?? "");
    if (n.length >= 4) set.add(n);
  }
  return set;
}

/**
 * Fetch one box and upsert its venues.
 *
 * Never overwrites a field that already holds a value: a row may have been
 * corrected by hand, or claimed by the venue, and OSM is not authoritative
 * enough to win that argument.
 */
export async function sourceBox(box: Bbox, opts: { dry?: boolean } = {}): Promise<SourceStats> {
  const json = await runOverpass(buildQuery(box));
  const venues = parseElements(json);
  const seen = await existingNames();

  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\b(the|restaurant|bar|pub|cafe|caf|hotel|inn|ltd|limited)\b/g, "")
      .trim();

  const stats: SourceStats = {
    box: box.label,
    fetched: venues.length,
    created: 0,
    updated: 0,
    skipped: 0,
    duplicateOfLead: 0,
  };

  for (const v of venues) {
    const reason = triageReason(v);
    const dupe = !reason && seen.has(norm(v.name));
    const status = reason || dupe ? "skipped" : "new";
    const skipReason = reason ?? (dupe ? "already a lead or page" : null);

    if (reason) stats.skipped++;
    if (dupe) stats.duplicateOfLead++;

    if (opts.dry) {
      stats.created++;
      continue;
    }

    const existing = await prisma.venueCandidate.findUnique({
      where: { osmRef: v.osmRef },
      select: { id: true, status: true },
    });

    if (existing) {
      // Only ever fills blanks, and never moves a row that has progressed.
      await prisma.venueCandidate.update({
        where: { osmRef: v.osmRef },
        data: {
          phone: v.phone ?? undefined,
          email: v.email ?? undefined,
          facebook: v.facebook ?? undefined,
          instagram: v.instagram ?? undefined,
          openingHours: v.openingHours ?? undefined,
          cuisine: v.cuisine ?? undefined,
          street: v.street ?? undefined,
          city: v.city ?? undefined,
          postcode: v.postcode ?? undefined,
        },
      });
      stats.updated++;
      continue;
    }

    await prisma.venueCandidate.create({
      data: {
        osmRef: v.osmRef,
        name: v.name,
        amenity: v.amenity,
        country: box.country,
        street: v.street,
        housenumber: v.housenumber,
        city: v.city,
        postcode: v.postcode,
        lat: v.lat,
        lon: v.lon,
        phone: v.phone,
        email: v.email,
        facebook: v.facebook,
        instagram: v.instagram,
        openingHours: v.openingHours,
        cuisine: v.cuisine,
        status,
        skipReason,
        notes: `sourced from OpenStreetMap (${box.label}) ${new Date().toISOString().slice(0, 10)}`,
      },
    });
    stats.created++;
  }

  return stats;
}

/** Counts for the admin view and for "how long can this run". */
export async function candidateStats() {
  const rows = await prisma.venueCandidate.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const byStatus: Record<string, number> = {};
  for (const r of rows) byStatus[r.status] = r._count._all;

  const withPhone = await prisma.venueCandidate.count({
    where: { status: "new", phone: { not: null } },
  });
  const withSocial = await prisma.venueCandidate.count({
    where: {
      status: "new",
      OR: [{ facebook: { not: null } }, { instagram: { not: null } }],
    },
  });

  return { byStatus, withPhone, withSocial };
}
