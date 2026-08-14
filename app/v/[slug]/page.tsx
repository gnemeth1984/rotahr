import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getPublicVenue } from "@/lib/public-page/data";
import {
  DAY_NAMES,
  SCHEMA_DAYS,
  schemaTypeFor,
  publicImageSrc,
  formatPrice,
} from "@/lib/public-page/types";
import { BookingForm } from "./_booking-form";
import { ClaimBanner } from "./_claim-banner";

export const revalidate = 300; // 5 min — venue edits appear quickly, DB stays quiet

const ACCENT = "#e8365d";
const SITE = "https://rotahr.com";

const CATEGORY_LABELS: Record<string, string> = {
  starter: "Starters",
  main: "Mains",
  dessert: "Desserts",
  sides: "Sides",
  drinks: "Drinks",
  other: "More",
};
const CATEGORY_ORDER = ["starter", "main", "sides", "dessert", "drinks", "other"];

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const venue = await getPublicVenue(params.slug);
  if (!venue) return { title: "Not found" };

  const descBits = [venue.tagline, venue.cuisine, venue.address].filter(Boolean);
  const description =
    venue.about?.slice(0, 155) ||
    descBits.join(" · ").slice(0, 155) ||
    `${venue.name} — menu, opening hours and table bookings.`;

  return {
    title: `${venue.name}${venue.tagline ? ` — ${venue.tagline}` : ""}`,
    description,
    alternates: { canonical: `${SITE}/v/${venue.slug}` },
    robots: venue.noIndex ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: {
      title: venue.name,
      description,
      url: `${SITE}/v/${venue.slug}`,
      type: "website",
      images: venue.heroImage ? [`${SITE}${publicImageSrc(venue.heroImage)}`] : undefined,
    },
    twitter: {
      card: venue.heroImage ? "summary_large_image" : "summary",
      title: venue.name,
      description,
    },
  };
}

export default async function PublicVenuePage({ params }: { params: { slug: string } }) {
  const venue = await getPublicVenue(params.slug);
  if (!venue) notFound();

  const hero = publicImageSrc(venue.heroImage);
  const todayIdx = new Date().getDay();

  const grouped = CATEGORY_ORDER.map((cat) => ({
    key: cat,
    label: CATEGORY_LABELS[cat] ?? cat,
    items: venue.dishes.filter((d) => d.category === cat),
  })).filter((g) => g.items.length > 0);

  const uncategorised = venue.dishes.filter((d) => !CATEGORY_ORDER.includes(d.category));
  if (uncategorised.length) {
    grouped.push({ key: "misc", label: "More", items: uncategorised });
  }

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": schemaTypeFor(venue.venueType),
    name: venue.name,
    url: `${SITE}/v/${venue.slug}`,
    ...(venue.about ? { description: venue.about } : {}),
    ...(venue.cuisine ? { servesCuisine: venue.cuisine } : {}),
    ...(venue.phone ? { telephone: venue.phone } : {}),
    ...(venue.email ? { email: venue.email } : {}),
    ...(hero ? { image: `${SITE}${hero}` } : {}),
    ...(venue.address ? { address: { "@type": "PostalAddress", streetAddress: venue.address } } : {}),
    ...(venue.geoLat != null && venue.geoLng != null
      ? { geo: { "@type": "GeoCoordinates", latitude: venue.geoLat, longitude: venue.geoLng } }
      : {}),
    ...(venue.showBooking ? { acceptsReservations: `${SITE}/v/${venue.slug}#book` } : {}),
    openingHoursSpecification: venue.openingHours
      .filter((h) => !h.closed)
      .map((h) => ({
        "@type": "OpeningHoursSpecification",
        dayOfWeek: SCHEMA_DAYS[h.day],
        opens: h.open,
        closes: h.close,
      })),
    ...(venue.website || venue.instagram || venue.facebook
      ? { sameAs: [venue.website, venue.instagram, venue.facebook].filter(Boolean) }
      : {}),
  };

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <header className="relative overflow-hidden bg-slate-900">
        {hero && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={hero}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-45"
          />
        )}
        <div className="relative mx-auto max-w-4xl px-5 py-20 text-center sm:py-28">
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl">{venue.name}</h1>
          {venue.tagline && (
            <p className="mx-auto mt-4 max-w-2xl text-lg text-white/85 sm:text-xl">{venue.tagline}</p>
          )}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-sm text-white/70">
            {venue.cuisine && <span className="rounded-full bg-white/10 px-3 py-1">{venue.cuisine}</span>}
            {venue.venueType && (
              <span className="rounded-full bg-white/10 px-3 py-1 capitalize">{venue.venueType}</span>
            )}
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {venue.showBooking && (
              <a
                href="#book"
                style={{ backgroundColor: ACCENT }}
                className="rounded-lg px-6 py-3 font-semibold text-white transition hover:opacity-90"
              >
                Book a table
              </a>
            )}
            {venue.bookingUrl && !venue.showBooking && (
              <a
                href={venue.bookingUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ backgroundColor: ACCENT }}
                className="rounded-lg px-6 py-3 font-semibold text-white transition hover:opacity-90"
              >
                Book a table
              </a>
            )}
            {venue.phone && (
              <a
                href={`tel:${venue.phone.replace(/\s+/g, "")}`}
                className="rounded-lg border border-white/25 bg-white/5 px-6 py-3 font-semibold text-white backdrop-blur transition hover:bg-white/15"
              >
                Call {venue.phone}
              </a>
            )}
          </div>
        </div>
      </header>

      {/* ── About ────────────────────────────────────────────────────── */}
      {venue.about && (
        <section className="mx-auto max-w-3xl px-5 py-14">
          <p className="whitespace-pre-line text-center text-lg leading-relaxed text-slate-700">
            {venue.about}
          </p>
        </section>
      )}

      {/* ── Specials ─────────────────────────────────────────────────── */}
      {venue.specials.length > 0 && (
        <section className="border-y border-slate-200 bg-slate-50 py-14">
          <div className="mx-auto max-w-5xl px-5">
            <h2 className="text-center text-3xl font-bold">What&apos;s on</h2>
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {venue.specials.map((s) => {
                const img = publicImageSrc(s.image);
                return (
                  <article
                    key={s.id}
                    className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                  >
                    {img && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img} alt={s.title} className="h-44 w-full object-cover" />
                    )}
                    <div className="p-5">
                      <span
                        className="text-xs font-semibold uppercase tracking-wide"
                        style={{ color: ACCENT }}
                      >
                        {s.category === "announcement" ? "News" : "Special"}
                      </span>
                      <h3 className="mt-1.5 text-lg font-semibold">{s.title}</h3>
                      {s.description && (
                        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-600">
                          {s.description}
                        </p>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── Menu ─────────────────────────────────────────────────────── */}
      {grouped.length > 0 && (
        <section className="mx-auto max-w-4xl px-5 py-14">
          <h2 className="text-center text-3xl font-bold">Menu</h2>
          <div className="mt-10 space-y-12">
            {grouped.map((group) => (
              <div key={group.key}>
                <h3 className="border-b border-slate-200 pb-2 text-xl font-semibold tracking-tight">
                  {group.label}
                </h3>
                <ul className="mt-5 space-y-5">
                  {group.items.map((dish) => {
                    const img = publicImageSrc(dish.image);
                    return (
                      <li key={dish.id} className="flex gap-4">
                        {img && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={img}
                            alt={dish.name}
                            className="h-20 w-20 flex-shrink-0 rounded-xl object-cover"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-4">
                            <h4 className="font-semibold">{dish.name}</h4>
                            {dish.price != null && (
                              <span className="flex-shrink-0 font-medium text-slate-700">
                                {formatPrice(dish.price, venue.currency)}
                              </span>
                            )}
                          </div>
                          {dish.description && (
                            <p className="mt-1 text-sm leading-relaxed text-slate-600">
                              {dish.description}
                            </p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
          <p className="mt-10 text-center text-xs text-slate-500">
            Menu subject to change. Please tell us about any allergies when you book.
          </p>
        </section>
      )}

      {/* ── Hours + contact ──────────────────────────────────────────── */}
      <section className="border-t border-slate-200 bg-slate-50 py-14">
        <div className="mx-auto grid max-w-4xl gap-10 px-5 sm:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold">Opening hours</h2>
            <ul className="mt-5 space-y-2">
              {venue.openingHours.map((h) => (
                <li
                  key={h.day}
                  className={`flex justify-between rounded-lg px-3 py-2 text-sm ${
                    h.day === todayIdx ? "bg-white font-semibold shadow-sm" : "text-slate-600"
                  }`}
                >
                  <span>{DAY_NAMES[h.day]}</span>
                  <span>{h.closed ? "Closed" : `${h.open} – ${h.close}`}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-2xl font-bold">Find us</h2>
            <div className="mt-5 space-y-3 text-sm text-slate-700">
              {venue.address && (
                <p className="whitespace-pre-line">
                  {venue.address}
                  <br />
                  <a
                    className="font-medium underline decoration-slate-300 underline-offset-4"
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      `${venue.name} ${venue.address}`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Get directions
                  </a>
                </p>
              )}
              {venue.phone && (
                <p>
                  <a className="underline decoration-slate-300 underline-offset-4" href={`tel:${venue.phone.replace(/\s+/g, "")}`}>
                    {venue.phone}
                  </a>
                </p>
              )}
              {venue.email && (
                <p>
                  {/* Subject prefilled with the venue name — a blank mailto made
                      every enquiry start with typing out the business name. */}
                  <a
                    className="underline decoration-slate-300 underline-offset-4"
                    href={`mailto:${venue.email}?subject=${encodeURIComponent(`Enquiry — ${venue.name}`)}`}
                  >
                    {venue.email}
                  </a>
                </p>
              )}
              <div className="flex flex-wrap gap-3 pt-2">
                {venue.website && (
                  <a className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium transition hover:border-slate-400" href={venue.website} target="_blank" rel="noopener noreferrer">
                    Website
                  </a>
                )}
                {venue.instagram && (
                  <a className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium transition hover:border-slate-400" href={venue.instagram} target="_blank" rel="noopener noreferrer">
                    Instagram
                  </a>
                )}
                {venue.facebook && (
                  <a className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium transition hover:border-slate-400" href={venue.facebook} target="_blank" rel="noopener noreferrer">
                    Facebook
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Booking ──────────────────────────────────────────────────── */}
      {venue.showBooking && (
        <section id="book" className="mx-auto max-w-2xl scroll-mt-8 px-5 py-16">
          <h2 className="text-center text-3xl font-bold">Book a table</h2>
          <p className="mt-3 text-center text-slate-600">
            Send us a request and we&apos;ll confirm shortly.
          </p>
          <div className="mt-8">
            <BookingForm slug={venue.slug} accent={ACCENT} />
          </div>
        </section>
      )}

      {/* ── Claim ────────────────────────────────────────────────────── */}
      {/* Prospect pages only: gives the real owner a route to take the page
          over, which previously did not exist anywhere in the product. */}
      {venue.isProspect && (
        <ClaimBanner
          slug={venue.slug}
          venueName={venue.name}
          hasContact={Boolean(venue.email)}
        />
      )}

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-200 py-10 text-center">
        <p className="text-sm text-slate-500">
          © {new Date().getFullYear()} {venue.name}
        </p>
        <p className="mt-2 text-xs text-slate-400">
          Powered by{" "}
          <Link href="/landing" className="font-medium text-slate-500 underline decoration-slate-300 underline-offset-4">
            Rotahr
          </Link>
        </p>
      </footer>
    </main>
  );
}
