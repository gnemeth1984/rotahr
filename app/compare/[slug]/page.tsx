import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { competitors, getCompetitor, ROTAHR_PRICING } from "@/lib/seo/competitors";
import { jsonLdProps, breadcrumbSchema, SITE_URL } from "@/lib/seo/structured-data";

// Statically render all comparison pages at build time — they're the highest
// commercial-intent pages on the site, so they should be instant and cacheable.
export function generateStaticParams() {
  return competitors.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const c = getCompetitor(slug);
  if (!c) return { title: "Not found" };

  // Title targets the two phrases people actually type: "X alternative" and
  // "Rotahr vs X".
  return {
    // Kept under 60 characters so it isn't truncated in the SERP, while still
    // carrying both phrases people search: "X alternative" and "Rotahr vs X".
    title: `${c.name} Alternative: Rotahr vs ${c.name} (2026)`,
    description: `An honest comparison of Rotahr and ${c.name} for pubs, cafés and restaurants: pricing model, what each does well, and where ${c.name} is the better choice.`,
    alternates: { canonical: `/compare/${c.slug}` },
    openGraph: {
      title: `Rotahr vs ${c.name} — honest comparison`,
      description: `Where ${c.name} wins, where Rotahr wins, and how the pricing actually works.`,
      url: `/compare/${c.slug}`,
      type: "article",
    },
  };
}

// The opening line claims how the competitor charges, so it has to follow the
// data rather than assume per-user. Getting a rival's pricing model wrong in
// the first sentence is the fastest way to lose a reader who already uses them.
const PRICING_PHRASE: Record<string, string> = {
  "per-user": "priced per user",
  "per-location": "priced per location",
  flat: "sold at a flat rate",
  "on-request": "priced on request",
};

const CHECK = <span className="text-emerald-400 font-bold">✓</span>;
const CROSS = <span className="text-rose-400 font-bold">✕</span>;

// Only the differences that are actually load-bearing for a small venue.
const ALL_IN_ONE = [
  "Staff rota & shift swaps",
  "Clock in / out with break tracking",
  "HACCP food safety records",
  "Table bookings & floor plan",
  "Receipt scanning & bookkeeping",
  "Stock & recipe costing",
  "Customer list & offers",
];

export default async function ComparePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const c = getCompetitor(slug);
  if (!c) notFound();

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: c.faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  const others = competitors.filter((x) => x.slug !== c.slug);

  return (
    <main className="min-h-screen bg-[#0A1427] text-white">
      <script
        {...jsonLdProps([
          faqSchema,
          breadcrumbSchema([
            { name: "Rotahr", path: "/landing" },
            { name: "Compare", path: "/compare" },
            { name: `vs ${c.name}`, path: `/compare/${c.slug}` },
          ]),
        ])}
      />

      <div className="max-w-4xl mx-auto px-6 py-16">
        <nav className="text-sm text-slate-400 mb-8">
          <Link href="/landing" className="hover:text-white">Rotahr</Link>
          <span className="mx-2">/</span>
          <Link href="/compare" className="hover:text-white">Compare</Link>
          <span className="mx-2">/</span>
          <span className="text-slate-300">vs {c.name}</span>
        </nav>

        <h1 className="text-4xl md:text-5xl font-bold mb-5 leading-tight">
          Rotahr vs {c.name}
        </h1>
        {/* Lead with the answer. AI assistants quote the first passage that
            resolves the heading, so the opening paragraph states the Rotahr vs
            {c.name} difference outright instead of describing the competitor
            first. */}
        <p className="text-lg text-slate-200 mb-4 max-w-2xl">
          Rotahr and {c.name} both handle staff scheduling, but they solve
          different problems: Rotahr is one flat-priced app that also covers
          bookings, food safety records, stock and payroll for a single venue,
          while {c.name} is a dedicated workforce platform{" "}
          {PRICING_PHRASE[c.pricingModel]} and bolted to other tools for the
          rest.
        </p>
        <p className="text-base text-slate-400 mb-4 max-w-2xl">
          {c.positioning}
        </p>
        <p className="text-lg text-slate-300 mb-10 max-w-2xl">
          Below is a straight comparison, including the cases where {c.name} is
          the better choice. If that&apos;s you, we&apos;d rather you knew now
          than found out after paying us.
        </p>

        {/* The honest summary up top — buyers skim */}
        <div className="rounded-2xl bg-white/5 border border-white/10 p-6 mb-12">
          <h2 className="text-xs font-semibold tracking-widest uppercase text-[#FF6B35] mb-3">
            Short version
          </h2>
          <p className="text-slate-200 text-lg leading-relaxed">{c.verdict}</p>
        </div>

        {/* Pricing — the real structural difference */}
        <h2 className="text-2xl font-bold mb-4">What each one costs</h2>
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div className="rounded-2xl border border-[#FF6B35]/40 bg-[#FF6B35]/5 p-6">
            <p className="text-sm text-slate-400 mb-1">Rotahr</p>
            <p className="text-3xl font-bold mb-3">
              €{ROTAHR_PRICING.starter}
              <span className="text-base font-normal text-slate-400">/mo</span>
            </p>
            <p className="text-sm text-slate-300">
              Flat monthly, VAT included. Up to 15 staff; €{ROTAHR_PRICING.pro} up
              to 30. Hiring doesn&apos;t change the bill.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <p className="text-sm text-slate-400 mb-1">{c.name}</p>
            <p className="text-lg font-semibold mb-3 capitalize">
              {c.pricingModel.replace("-", " ")}
            </p>
            <p className="text-sm text-slate-300">{c.pricingSummary}</p>
          </div>
        </div>
        {c.exampleCost12 && (
          <p className="text-sm text-slate-400 mb-2">
            <strong className="text-slate-300">Rough cost at 12 staff:</strong>{" "}
            {c.exampleCost12}
          </p>
        )}
        <p className="text-xs text-slate-500 mb-12">
          {c.name} pricing taken from{" "}
          <a
            href={c.pricingSource}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="underline hover:text-slate-300"
          >
            their own pricing page
          </a>
          , checked {c.pricingChecked}. Vendors change prices — verify before you
          buy. We don&apos;t quote third-party aggregators because they&apos;re
          often years out of date.
        </p>

        {/* Where they win — first, deliberately */}
        <h2 className="text-2xl font-bold mb-2">Where {c.name} is better</h2>
        <p className="text-slate-400 mb-5 text-sm">
          No point pretending otherwise.
        </p>
        <ul className="space-y-3 mb-12">
          {c.whereTheyWin.map((w) => (
            <li key={w} className="flex gap-3 text-slate-200">
              <span className="text-emerald-400 mt-0.5">✓</span>
              <span>{w}</span>
            </li>
          ))}
        </ul>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 mb-12">
          <h3 className="font-semibold mb-2">Pick {c.name} if…</h3>
          <p className="text-slate-300">{c.pickThemIf}</p>
        </div>

        {/* Gaps */}
        <h2 className="text-2xl font-bold mb-5">
          Where {c.name} leaves gaps for a small venue
        </h2>
        <ul className="space-y-3 mb-12">
          {c.gaps.map((g) => (
            <li key={g} className="flex gap-3 text-slate-200">
              <span className="text-rose-400 mt-0.5">✕</span>
              <span>{g}</span>
            </li>
          ))}
        </ul>

        {/* The actual differentiator */}
        <h2 className="text-2xl font-bold mb-2">The real difference</h2>
        <p className="text-slate-300 mb-6 max-w-2xl">
          Most tools here do the rota well. The question is what happens to
          everything else — the temperature checks, the delivery notes, the
          bookings, the bag of receipts. Rotahr was built by a chef who was doing
          all of it by hand.
        </p>
        <div className="rounded-2xl border border-white/10 overflow-hidden mb-12">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white/5">
                <th className="text-left px-5 py-3 font-medium text-slate-400">
                  Included as standard
                </th>
                <th className="px-4 py-3 text-center font-semibold text-[#FF6B35]">
                  Rotahr
                </th>
                <th className="px-4 py-3 text-center font-semibold text-slate-300">
                  {c.short}
                </th>
              </tr>
            </thead>
            <tbody>
              {ALL_IN_ONE.map((f, i) => {
                // First three rows are scheduling/attendance — every tool here
                // does those. The rest are hospitality ops, which none of them
                // cover. Kept explicit rather than clever so it stays truthful.
                const theyHaveIt = i < 2;
                return (
                  <tr key={f} className="border-t border-white/5">
                    <td className="px-5 py-3 text-slate-200">{f}</td>
                    <td className="px-4 py-3 text-center">{CHECK}</td>
                    <td className="px-4 py-3 text-center">
                      {theyHaveIt ? CHECK : CROSS}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-500 mb-12">
          Based on each vendor&apos;s publicly marketed feature set as of{" "}
          {c.pricingChecked}. {c.name} may offer some of these through
          integrations or partners rather than natively.
        </p>

        {/* FAQ */}
        <h2 className="text-2xl font-bold mb-6">Common questions</h2>
        <div className="space-y-6 mb-12">
          {c.faqs.map((f) => (
            <div key={f.q}>
              <h3 className="font-semibold text-lg mb-2">{f.q}</h3>
              <p className="text-slate-300">{f.a}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="rounded-2xl bg-gradient-to-r from-[#FF6B35] to-[#E8365D] p-8 text-center mb-12">
          <h2 className="text-2xl font-bold mb-3">Have a look yourself</h2>
          <p className="mb-6 text-white/90">
            Live demo, nothing to sign up for. Make your own mind up.
          </p>
          <Link
            href="/try"
            className="inline-block bg-white text-[#0F1C35] font-semibold px-7 py-3 rounded-xl hover:bg-slate-100 transition-colors"
          >
            Open the demo
          </Link>
        </div>

        {/* Internal linking — spreads crawl equity across the comparison set */}
        <h2 className="text-lg font-semibold mb-4">Other comparisons</h2>
        <div className="flex flex-wrap gap-2">
          {others.map((o) => (
            <Link
              key={o.slug}
              href={`/compare/${o.slug}`}
              className="text-sm px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-slate-300 hover:text-white hover:border-white/25 transition-colors"
            >
              Rotahr vs {o.name}
            </Link>
          ))}
          <Link
            href="/compare"
            className="text-sm px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-slate-300 hover:text-white hover:border-white/25 transition-colors"
          >
            All side by side
          </Link>
        </div>
      </div>
    </main>
  );
}
