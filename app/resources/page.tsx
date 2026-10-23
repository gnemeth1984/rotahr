import Link from "next/link";
import type { Metadata } from "next";
import { competitors } from "@/lib/seo/competitors";
import { locations } from "@/lib/seo/locations";
import { industries } from "@/lib/seo/industries";
import { freeTemplates } from "@/lib/templates";
import {
  jsonLdProps,
  breadcrumbSchema,
  SITE_URL,
} from "@/lib/seo/structured-data";

export const metadata: Metadata = {
  title: "Hospitality Resources — Guides, Tools & Templates | Rotahr",
  description:
    "Every free resource Rotahr publishes for restaurant, bar, cafe and hotel operators in one place: calculators, comparison guides, local rota rules, free templates and the blog.",
  alternates: { canonical: "/resources" },
  openGraph: {
    title: "Hospitality resources — guides, tools & templates",
    description:
      "Calculators, comparison guides, local rota rules, free templates and the blog — everything Rotahr publishes, in one place.",
    url: "/resources",
  },
};

const TOOLS = [
  {
    slug: "labour-cost-percentage",
    name: "Labour cost percentage calculator",
    blurb: "Check your wage cost against revenue in one line.",
  },
  {
    slug: "overtime-cost-calculator",
    name: "Overtime cost calculator",
    blurb: "See what unplanned overtime actually costs over a month and a year.",
  },
  {
    slug: "break-compliance-checker",
    name: "Break compliance checker",
    blurb: "Check a shift's break against Irish or UK statutory minimums.",
  },
];

export default function ResourcesHubPage() {
  const itemList = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Rotahr hospitality resources",
    url: `${SITE_URL}/resources`,
    hasPart: [
      { "@type": "WebPage", name: "Free templates", url: `${SITE_URL}/templates` },
      { "@type": "WebPage", name: "Rotahr vs other rota software", url: `${SITE_URL}/compare` },
      { "@type": "WebPage", name: "Free calculators", url: `${SITE_URL}/tools` },
      { "@type": "WebPage", name: "ROI calculator", url: `${SITE_URL}/roi-calculator` },
      { "@type": "WebPage", name: "Industries", url: `${SITE_URL}/industries` },
      { "@type": "WebPage", name: "Blog", url: `${SITE_URL}/blog` },
    ],
  };

  return (
    <main className="min-h-screen bg-[#0A1427] text-white">
      <script
        {...jsonLdProps([
          itemList,
          breadcrumbSchema([
            { name: "Rotahr", path: "/" },
            { name: "Resources", path: "/resources" },
          ]),
        ])}
      />

      <div className="max-w-5xl mx-auto px-6 py-16">
        <nav className="text-sm text-slate-400 mb-8">
          <Link href="/" className="hover:text-white">
            Rotahr
          </Link>
          <span className="mx-2">/</span>
          <span className="text-slate-300">Resources</span>
        </nav>

        <h1 className="text-4xl md:text-5xl font-bold mb-5 leading-tight">
          Hospitality resources
        </h1>
        <p className="text-lg text-slate-200 mb-12 max-w-2xl">
          Everything we publish for restaurant, bar, café and hotel operators —
          free calculators, honest comparisons against other rota software,
          what the rules actually are where you run your venue, free paperwork
          templates, and the blog. Everything is free; the templates just ask for an email address.
        </p>

        {/* Calculators */}
        <section className="mb-16">
          <div className="flex items-baseline justify-between mb-1">
            <h2 className="text-2xl font-bold">Free calculators</h2>
            <Link href="/tools" className="text-sm text-[#FF6B35] hover:underline">
              See all tools →
            </Link>
          </div>
          <p className="text-sm text-slate-400 mb-5 max-w-2xl leading-relaxed">
            Quick, no-signup math on the numbers that actually move a venue's
            labour line.
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            {TOOLS.map((t) => (
              <Link
                key={t.slug}
                href={`/tools/${t.slug}`}
                className="rounded-2xl border border-white/10 bg-white/5 p-5 hover:border-white/25 transition-colors"
              >
                <h3 className="font-semibold mb-1">{t.name}</h3>
                <p className="text-sm text-slate-400">{t.blurb}</p>
              </Link>
            ))}
            <Link
              href="/roi-calculator"
              className="rounded-2xl border border-white/10 bg-white/5 p-5 hover:border-white/25 transition-colors"
            >
              <h3 className="font-semibold mb-1">ROI calculator</h3>
              <p className="text-sm text-slate-400">
                What you're paying across separate rota, bookkeeping,
                reservations and payroll tools vs. one Rotahr plan.
              </p>
            </Link>
          </div>
        </section>

        {/* Compare */}
        <section className="mb-16">
          <div className="flex items-baseline justify-between mb-1">
            <h2 className="text-2xl font-bold">Comparing rota software</h2>
            <Link href="/compare" className="text-sm text-[#FF6B35] hover:underline">
              Full comparison table →
            </Link>
          </div>
          <p className="text-sm text-slate-400 mb-5 max-w-2xl leading-relaxed">
            Where each competitor genuinely wins, where they don't, and
            published pricing — not marketing copy.
          </p>
          <div className="flex flex-wrap gap-2">
            {competitors.map((c) => (
              <Link
                key={c.slug}
                href={`/compare/${c.slug}`}
                className="text-sm px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-slate-300 hover:text-white hover:border-white/25 transition-colors"
              >
                Rotahr vs {c.name}
              </Link>
            ))}
          </div>
        </section>

        {/* Industries */}
        <section className="mb-16">
          <div className="flex items-baseline justify-between mb-1">
            <h2 className="text-2xl font-bold">By type of venue</h2>
            <Link href="/industries" className="text-sm text-[#FF6B35] hover:underline">
              See all industries →
            </Link>
          </div>
          <p className="text-sm text-slate-400 mb-5 max-w-2xl leading-relaxed">
            How Rotahr fits restaurants, bars, hotels, cafes and caterers
            specifically — not a generic pitch with the noun swapped.
          </p>
          <div className="flex flex-wrap gap-2">
            {industries.map((i) => (
              <Link
                key={i.slug}
                href={`/industries/${i.slug}`}
                className="text-sm px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-slate-300 hover:text-white hover:border-white/25 transition-colors"
              >
                {i.name}
              </Link>
            ))}
          </div>
        </section>

        {/* Locations */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-1">By area</h2>
          <p className="text-sm text-slate-400 mb-5 max-w-2xl leading-relaxed">
            Local break rules, food-safety schemes and the trade patterns that
            actually shape a rota in each city.
          </p>
          <h3 className="text-sm font-semibold text-slate-300 mb-2">Ireland</h3>
          <div className="flex flex-wrap gap-2 mb-5">
            {locations
              .filter((l) => l.country === "Ireland")
              .map((l) => (
                <Link
                  key={l.slug}
                  href={`/rota-software/${l.slug}`}
                  className="text-sm px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-slate-300 hover:text-white hover:border-white/25 transition-colors"
                >
                  {l.city}
                </Link>
              ))}
          </div>
          <h3 className="text-sm font-semibold text-slate-300 mb-2">UK</h3>
          <div className="flex flex-wrap gap-2">
            {locations
              .filter((l) => l.country === "UK")
              .map((l) => (
                <Link
                  key={l.slug}
                  href={`/rota-software/${l.slug}`}
                  className="text-sm px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-slate-300 hover:text-white hover:border-white/25 transition-colors"
                >
                  {l.city}
                </Link>
              ))}
          </div>
        </section>

        {/* Templates */}
        <section className="mb-16">
          <div className="flex items-baseline justify-between mb-1">
            <h2 className="text-2xl font-bold">Free templates</h2>
            <Link href="/templates" className="text-sm text-[#FF6B35] hover:underline">
              All {freeTemplates.length} templates →
            </Link>
          </div>
          <p className="text-sm text-slate-400 leading-relaxed max-w-2xl">
            Printable PDF and editable Excel paperwork — temperature logs,
            rotas, opening and closing checklists, cleaning schedules, stock
            counts and more. Free with just an email address.
          </p>
        </section>

        {/* Blog */}
        <section className="mb-6">
          <div className="flex items-baseline justify-between mb-1">
            <h2 className="text-2xl font-bold">Blog</h2>
            <Link href="/blog" className="text-sm text-[#FF6B35] hover:underline">
              Read the blog →
            </Link>
          </div>
          <p className="text-sm text-slate-400 leading-relaxed max-w-2xl">
            Practical writing on scheduling, labour cost control, compliance,
            payroll and running hospitality teams.
          </p>
        </section>
      </div>
    </main>
  );
}
