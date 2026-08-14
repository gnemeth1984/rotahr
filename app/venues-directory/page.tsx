import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { listDirectoryVenues } from "@/lib/public-page/data";

/**
 * Public directory of every live venue page.
 *
 * Why this exists: the 81 pages under /v/<slug> were in the sitemap and linked
 * from nowhere. Sitemap-only URLs get crawled weakly and most were probably not
 * indexed. This page is the crawl path in.
 *
 * Lives at /venues-directory rather than /venues because /venues is already the
 * signed-in venue management screen under app/(app), and two routes cannot own
 * the same path.
 */

const SITE = "https://rotahr.com";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Venue directory — restaurants, bars, cafés and hotels | Rotahr",
  description:
    "Browse every venue with a Rotahr page. Menus, opening hours, daily specials and table booking requests, updated by the venues themselves.",
  alternates: { canonical: `${SITE}/venues-directory` },
  openGraph: {
    title: "Venue directory | Rotahr",
    description:
      "Browse every venue with a Rotahr page — menus, opening hours, specials and bookings.",
    url: `${SITE}/venues-directory`,
    type: "website",
  },
};

/**
 * next/image throws on a host missing from next.config remotePatterns, and one
 * throw here would take down the whole directory rather than one card. Hero
 * images are uploaded to Vercel Blob today, but a page built from a scraped
 * source could carry any host, so anything unrecognised falls back to the
 * gradient instead.
 */
function isRenderableImage(url: string | null): url is string {
  if (!url) return false;
  if (url.startsWith("/")) return true;
  try {
    const { protocol, hostname } = new URL(url);
    if (protocol !== "https:") return false;
    return (
      hostname.endsWith(".public.blob.vercel-storage.com") ||
      hostname.endsWith(".vercel-storage.com") ||
      hostname.endsWith(".googleusercontent.com")
    );
  } catch {
    return false;
  }
}

const IE_COUNTIES = [
  "Antrim", "Armagh", "Carlow", "Cavan", "Clare", "Cork", "Derry", "Donegal",
  "Down", "Dublin", "Fermanagh", "Galway", "Kerry", "Kildare", "Kilkenny",
  "Laois", "Leitrim", "Limerick", "Longford", "Louth", "Mayo", "Meath",
  "Monaghan", "Offaly", "Roscommon", "Sligo", "Tipperary", "Tyrone",
  "Waterford", "Westmeath", "Wexford", "Wicklow",
];

const UK_PLACES = [
  "London", "Manchester", "Birmingham", "Leeds", "Liverpool", "Bristol",
  "Sheffield", "Newcastle", "Nottingham", "Leicester", "Brighton", "Oxford",
  "Cambridge", "Bath", "York", "Edinburgh", "Glasgow", "Aberdeen", "Dundee",
  "Cardiff", "Swansea", "Belfast", "Norwich", "Exeter", "Plymouth", "Reading",
  "Southampton", "Portsmouth", "Cornwall", "Devon", "Kent", "Surrey", "Essex",
  "Yorkshire",
];

/**
 * Group heading for an address, e.g. "Castleisland, Co. Kerry V93 XED7" -> Kerry.
 *
 * Naive "last comma-separated part" grouping produced 60+ groups of one, because
 * most addresses end in an Eircode or UK postcode — the directory listed "V92
 * EY60" and "D02 AK20" as if they were places. So the county or city is searched
 * for anywhere in the string instead, and postcodes are discarded rather than
 * treated as location names.
 */
function region(address: string | null): string {
  if (!address) return "Elsewhere";

  const cleaned = address
    // Eircode: one letter, two digits, then a 4-character routing key.
    .replace(/\b[A-Z]\d{2}\s?[A-Z0-9]{4}\b/gi, " ")
    // UK outward/inward postcode.
    .replace(/\b[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}\b/gi, " ")
    .replace(/\beircode\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Dublin postal districts ("D02", "Dublin 6") are all Dublin.
  if (/\bD\d{2}\b/i.test(address) || /\bdublin\b/i.test(cleaned)) return "Dublin";

  // Towns written without their county, which would otherwise each become a
  // group of one next to the county they belong in.
  const TOWN_COUNTY: Record<string, string> = {
    Killarney: "Kerry", Tralee: "Kerry", Dingle: "Kerry", Kenmare: "Kerry",
    Castleisland: "Kerry", Listowel: "Kerry", Kinsale: "Cork", Clonakilty: "Cork",
    Midleton: "Cork", Youghal: "Cork", Bantry: "Cork", Ennis: "Clare",
    Doolin: "Clare", Lahinch: "Clare", Westport: "Mayo", Clifden: "Galway",
    Athlone: "Westmeath", Kilkenny: "Kilkenny", Bray: "Wicklow",
    Greystones: "Wicklow", Dundalk: "Louth", Drogheda: "Louth",
    Navan: "Meath", Naas: "Kildare", Sligo: "Sligo", Tramore: "Waterford",
    Dungarvan: "Waterford", Clonmel: "Tipperary", Cashel: "Tipperary",
  };
  for (const [town, county] of Object.entries(TOWN_COUNTY)) {
    if (new RegExp(`\\b${town}\\b`, "i").test(cleaned)) return county;
  }

  for (const county of IE_COUNTIES) {
    if (new RegExp(`\\b${county}\\b`, "i").test(cleaned)) return county;
  }
  for (const place of UK_PLACES) {
    if (new RegExp(`\\b${place}\\b`, "i").test(cleaned)) return place;
  }

  // Nothing recognised: fall back to the last meaningful part, skipping a
  // trailing country name which tells a reader nothing useful.
  const parts = cleaned.split(",").map((p) => p.trim()).filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i--) {
    if (/^(ireland|Éire|united kingdom|uk|england|scotland|wales)$/i.test(parts[i])) continue;
    if (parts[i].length > 1) return parts[i];
  }
  return "Elsewhere";
}

export default async function VenueDirectoryPage() {
  const venues = await listDirectoryVenues();

  // Group by region so the page reads as a directory rather than one long list,
  // and so "restaurants in Co. Kerry" style queries have matching text on it.
  const groups = new Map<string, typeof venues>();
  for (const v of venues) {
    const key = region(v.address);
    const list = groups.get(key) ?? [];
    list.push(v);
    groups.set(key, list);
  }
  const ordered = [...groups.entries()].sort((a, b) => {
    // Biggest groups first, "Elsewhere" always last.
    if (a[0] === "Elsewhere") return 1;
    if (b[0] === "Elsewhere") return -1;
    return b[1].length - a[1].length || a[0].localeCompare(b[0]);
  });

  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Venues on Rotahr",
    numberOfItems: venues.length,
    itemListElement: venues.map((v, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${SITE}/v/${v.slug}`,
      name: v.name,
    })),
  };

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }}
      />

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="border-b border-slate-200 bg-[#0f1c35] text-white">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <Link
            href="/landing"
            className="mb-8 inline-flex items-center gap-2 text-lg font-bold text-[#ff6b35] transition-opacity hover:opacity-80"
          >
            ← Rotahr
          </Link>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            Venue directory
          </h1>
          <p className="mt-4 max-w-2xl leading-relaxed text-slate-300">
            {venues.length} restaurants, bars, cafés and hotels with a page on
            Rotahr. Menus, opening hours and daily specials come straight from
            the venue — no reviews, no rankings, no booking fees.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/list"
              className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #ff6b35, #e8365d)" }}
            >
              List your venue — free
            </Link>
            <Link
              href="/features"
              className="rounded-xl border border-white/20 px-5 py-2.5 text-sm font-semibold text-white transition hover:border-white/40"
            >
              What Rotahr does
            </Link>
          </div>
        </div>
      </header>

      {/* ── Directory ──────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-5xl px-6 py-14">
        {venues.length === 0 ? (
          <p className="text-slate-600">
            No venue pages are live yet.{" "}
            <Link href="/list" className="text-orange-700 underline">
              Add the first one
            </Link>
            .
          </p>
        ) : (
          <>
            {/* Jump links: a long page needs them, and they give the crawler a
                second pass over the region names. */}
            {ordered.length > 1 && (
              <nav aria-label="Regions" className="mb-12 flex flex-wrap gap-2">
                {ordered.map(([name, list]) => (
                  <a
                    key={name}
                    href={`#${encodeURIComponent(name.toLowerCase().replace(/\s+/g, "-"))}`}
                    className="rounded-full border border-slate-300 px-3.5 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-500"
                  >
                    {name}{" "}
                    <span className="text-slate-400">{list.length}</span>
                  </a>
                ))}
              </nav>
            )}

            <div className="space-y-14">
              {ordered.map(([name, list]) => (
                <section
                  key={name}
                  id={encodeURIComponent(name.toLowerCase().replace(/\s+/g, "-"))}
                  className="scroll-mt-8"
                >
                  <h2 className="mb-6 border-b border-slate-200 pb-3 text-xl font-bold">
                    {name}{" "}
                    <span className="font-normal text-slate-400">
                      ({list.length})
                    </span>
                  </h2>

                  <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {list.map((v) => (
                      <li key={v.slug}>
                        <Link
                          href={`/v/${v.slug}`}
                          className="group block h-full overflow-hidden rounded-2xl border border-slate-200 transition hover:border-slate-400 hover:shadow-sm"
                        >
                          {isRenderableImage(v.heroImage) ? (
                            <div className="relative h-36 w-full bg-slate-100">
                              <Image
                                src={v.heroImage}
                                alt={v.name}
                                fill
                                sizes="(max-width: 640px) 100vw, 33vw"
                                className="object-cover"
                              />
                            </div>
                          ) : (
                            <div
                              className="h-36 w-full"
                              style={{
                                background:
                                  "linear-gradient(135deg, #0f1c35, #24324f)",
                              }}
                            />
                          )}
                          <div className="p-4">
                            <h3 className="font-semibold leading-snug group-hover:underline">
                              {v.name}
                            </h3>
                            {v.address && (
                              <p className="mt-1.5 text-sm text-slate-500">
                                {v.address}
                              </p>
                            )}
                            {v.tagline && (
                              <p className="mt-2 line-clamp-2 text-sm text-slate-600">
                                {v.tagline}
                              </p>
                            )}
                            {(v.venueType || v.cuisine) && (
                              <div className="mt-3 flex flex-wrap gap-1.5">
                                {[v.venueType, v.cuisine]
                                  .filter(Boolean)
                                  .map((t) => (
                                    <span
                                      key={t as string}
                                      className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium capitalize text-slate-600"
                                    >
                                      {t}
                                    </span>
                                  ))}
                              </div>
                            )}
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-200 py-12 text-center">
        <p className="mx-auto max-w-xl px-6 text-sm leading-relaxed text-slate-500">
          Some pages here were built from publicly available information for
          venues that aren&apos;t Rotahr customers yet. If one is yours, you can
          claim it or have it removed from the page itself.
        </p>
        <p className="mt-5 text-sm">
          <Link href="/landing" className="text-orange-700 underline">
            Rotahr — one app to run your entire venue
          </Link>
        </p>
      </footer>
    </main>
  );
}
