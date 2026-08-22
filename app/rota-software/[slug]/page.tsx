import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { locations, getLocation } from "@/lib/seo/locations";
import { competitors } from "@/lib/seo/competitors";
import {
  jsonLdProps,
  breadcrumbSchema,
  SITE_URL,
} from "@/lib/seo/structured-data";

export function generateStaticParams() {
  return locations.map((l) => ({ slug: l.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const l = getLocation(slug);
  if (!l) return { title: "Not found" };

  return {
    title: `Rota Software for ${l.city} Pubs, Cafés & Restaurants | Rotahr`,
    description: `Staff rota, clock-in, HACCP records and bookings in one app for ${l.city} hospitality venues. Flat €59/month, VAT included. Built by a chef.`,
    alternates: { canonical: `/rota-software/${l.slug}` },
    openGraph: {
      title: `Rota software for ${l.city} hospitality`,
      description: `One app for the rota, food safety, bookings and the books. Flat monthly pricing.`,
      url: `/rota-software/${l.slug}`,
    },
  };
}

const MODULES = [
  { name: "Rota & shifts", desc: "Build it once. Staff see it on their phone. Swaps come to you, not a group chat." },
  { name: "Clock in & out", desc: "On the phone, at the venue. Hours land straight into payroll, with Irish break rules built in." },
  { name: "HACCP records", desc: "Temperature checks, deliveries and cleaning lists. Print the lot for an inspector in one tap." },
  { name: "Bookings & floor plan", desc: "Your real table layout on screen. See what's free tonight at a glance." },
  { name: "Receipts & books", desc: "Photograph a receipt and it reads itself. Costs, VAT and P&L without the shoebox." },
  { name: "Stock & recipes", desc: "Know what a dish actually costs when supplier prices move." },
];

export default async function LocationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const l = getLocation(slug);
  if (!l) notFound();

  const others = locations.filter((x) => x.slug !== l.slug);

  // LocalBusiness would be wrong here — Rotahr is software sold into these
  // areas, not a business located in them. Service with an areaServed is the
  // accurate shape.
  const serviceSchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: `Rota and venue management software for ${l.city} hospitality`,
    serviceType: "Hospitality workforce and venue management software",
    provider: { "@id": `${SITE_URL}/#organization` },
    areaServed: {
      "@type": "AdministrativeArea",
      name: `${l.county}, ${l.country}`,
    },
    url: `${SITE_URL}/rota-software/${l.slug}`,
  };

  return (
    <main className="min-h-screen bg-[#0A1427] text-white">
      <script
        {...jsonLdProps([
          serviceSchema,
          breadcrumbSchema([
            { name: "Rotahr", path: "/" },
            { name: `Rota software ${l.city}`, path: `/rota-software/${l.slug}` },
          ]),
        ])}
      />

      <div className="max-w-4xl mx-auto px-6 py-16">
        <nav className="text-sm text-slate-400 mb-8">
          <Link href="/" className="hover:text-white">Rotahr</Link>
          <span className="mx-2">/</span>
          <span className="text-slate-300">Rota software {l.city}</span>
        </nav>

        <h1 className="text-4xl md:text-5xl font-bold mb-5 leading-tight">
          Rota software for {l.city} pubs, cafés and restaurants
        </h1>
        {/* Answer first: state what the page is about in a sentence that can be
            quoted on its own, then the local colour. */}
        <p className="text-lg text-slate-200 mb-6 max-w-2xl">
          Rotahr is rota software for {l.city} pubs, cafés and restaurants that
          handles the rota, clock-in, food safety records, bookings and receipts
          in one app — flat €59 a month, VAT included, no per-staff pricing.
        </p>
        <p className="text-base text-slate-400 mb-10 max-w-2xl">{l.intro}</p>

        <div className="flex flex-wrap gap-3 mb-14">
          <Link
            href="/try"
            className="bg-gradient-to-r from-[#FF6B35] to-[#E8365D] font-semibold px-6 py-3 rounded-xl hover:opacity-90 transition-opacity"
          >
            Try the live demo
          </Link>
          <Link
            href="/#pricing"
            className="border border-white/15 px-6 py-3 rounded-xl hover:bg-white/5 transition-colors"
          >
            See pricing
          </Link>
        </div>

        <h2 className="text-2xl font-bold mb-6">
          What {l.city} venues are actually dealing with
        </h2>
        <ul className="space-y-4 mb-14">
          {l.localPoints.map((p) => (
            <li key={p} className="flex gap-3 text-slate-200">
              <span className="text-[#FF6B35] mt-1">—</span>
              <span>{p}</span>
            </li>
          ))}
        </ul>

        <h2 className="text-2xl font-bold mb-6">What&apos;s included</h2>
        <div className="grid sm:grid-cols-2 gap-4 mb-14">
          {MODULES.map((m) => (
            <div
              key={m.name}
              className="rounded-2xl border border-white/10 bg-white/5 p-5"
            >
              <h3 className="font-semibold mb-2">{m.name}</h3>
              <p className="text-sm text-slate-400">{m.desc}</p>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 mb-14">
          <h2 className="text-xl font-bold mb-3">
            Serving venues across {l.county}
          </h2>
          <p className="text-slate-300 mb-4">
            Rotahr is used by independent venues in and around{" "}
            {l.areas.slice(0, -1).join(", ")} and {l.areas.slice(-1)[0]}. It runs
            in the browser and on iOS and Android, so there&apos;s nothing to
            install on a back-office machine.
          </p>
          <p className="text-sm text-slate-400">
            Prices in euro, VAT included, with Irish public holiday and break
            entitlement rules built in.
          </p>
        </div>

        <div className="rounded-2xl bg-gradient-to-r from-[#FF6B35] to-[#E8365D] p-8 text-center mb-14">
          <h2 className="text-2xl font-bold mb-3">Have a look yourself</h2>
          <p className="mb-6 text-white/90">
            Live demo, nothing to sign up for. First month free if you keep it.
          </p>
          <Link
            href="/try"
            className="inline-block bg-white text-[#0F1C35] font-semibold px-7 py-3 rounded-xl hover:bg-slate-100 transition-colors"
          >
            Open the demo
          </Link>
        </div>

        <h2 className="text-lg font-semibold mb-4">Other areas</h2>
        <div className="flex flex-wrap gap-2 mb-10">
          {others.map((o) => (
            <Link
              key={o.slug}
              href={`/rota-software/${o.slug}`}
              className="text-sm px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-slate-300 hover:text-white hover:border-white/25 transition-colors"
            >
              {o.city}
            </Link>
          ))}
        </div>

        <h2 className="text-lg font-semibold mb-4">Comparing options?</h2>
        <div className="flex flex-wrap gap-2">
          {competitors.slice(0, 4).map((o) => (
            <Link
              key={o.slug}
              href={`/compare/${o.slug}`}
              className="text-sm px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-slate-300 hover:text-white hover:border-white/25 transition-colors"
            >
              Rotahr vs {o.name}
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
