import Link from "next/link";
import type { Metadata } from "next";
import { industries } from "@/lib/seo/industries";
import { AcquisitionBanner } from "@/components/marketing/AcquisitionBanner";
import {
  jsonLdProps,
  breadcrumbSchema,
  softwareApplicationSchema,
  SITE_URL,
} from "@/lib/seo/structured-data";

export const metadata: Metadata = {
  title: "Rotahr by Industry — Restaurants, Bars, Hotels, Cafes",
  description:
    "Rotahr for restaurants, bars, hotels, cafes and catering companies — the rota, HACCP, bookings and bookkeeping modules each type of venue actually uses, in one app.",
  alternates: { canonical: "/industries" },
  openGraph: {
    title: "Rotahr by industry",
    description:
      "What Rotahr looks like for a restaurant, a bar, a hotel, a cafe or a catering company.",
    url: "/industries",
  },
};

export default function IndustriesIndexPage() {
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Rotahr by industry",
    itemListElement: industries.map((ind, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: ind.name,
      url: `${SITE_URL}/industries/${ind.slug}`,
    })),
  };

  return (
    <>
    <AcquisitionBanner />
    <main className="min-h-screen bg-[#0A1427] text-white">
      <script
        {...jsonLdProps([
          softwareApplicationSchema(),
          itemList,
          breadcrumbSchema([
            { name: "Rotahr", path: "/" },
            { name: "Industries", path: "/industries" },
          ]),
        ])}
      />

      <div className="max-w-4xl mx-auto px-6 py-16">
        <nav className="text-sm text-slate-400 mb-8">
          <Link href="/" className="hover:text-white">Rotahr</Link>
          <span className="mx-2">/</span>
          <span className="text-slate-300">Industries</span>
        </nav>

        <h1 className="text-4xl md:text-5xl font-bold mb-5 leading-tight">
          Built for your type of venue
        </h1>
        <p className="text-lg text-slate-200 mb-12 max-w-2xl">
          The same nine modules, used differently by a restaurant, a bar, a
          hotel, a cafe or a catering company. Pick your venue type to see
          which parts of Rotahr matter most for how you actually run.
        </p>

        <div className="grid sm:grid-cols-2 gap-4 mb-16">
          {industries.map((ind) => (
            <Link
              key={ind.slug}
              href={`/industries/${ind.slug}`}
              className="rounded-2xl border border-white/10 bg-white/5 p-6 hover:border-white/25 transition-colors"
            >
              <h2 className="font-semibold text-lg mb-2">{ind.name}</h2>
              <p className="text-sm text-slate-300 leading-relaxed mb-3">
                {ind.answer}
              </p>
              <span className="text-sm text-[#FF6B35]">Read more →</span>
            </Link>
          ))}
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/auth/register"
            className="bg-gradient-to-r from-[#FF6B35] to-[#E8365D] font-semibold px-6 py-3 rounded-xl hover:opacity-90 transition-opacity"
          >
            Start free 3-month trial
          </Link>
          <Link
            href="/try"
            className="border border-white/15 px-6 py-3 rounded-xl hover:bg-white/5 transition-colors"
          >
            Try live demo
          </Link>
        </div>
      </div>
    </main>
    </>
  );
}
