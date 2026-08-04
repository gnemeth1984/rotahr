import Link from "next/link";
import type { Metadata } from "next";
import { features } from "@/lib/seo/features";
import { locations } from "@/lib/seo/locations";
import { competitors } from "@/lib/seo/competitors";
import {
  jsonLdProps,
  breadcrumbSchema,
  softwareApplicationSchema,
  SITE_URL,
} from "@/lib/seo/structured-data";

export const metadata: Metadata = {
  title: "Rotahr Features — Every Module Explained",
  description:
    "Rota scheduling, clock-in and payroll hours, HACCP food safety records, table bookings, bookkeeping, recipe costing and guest CRM — what each module actually does, and what it doesn't.",
  alternates: { canonical: "/features" },
  openGraph: {
    title: "Rotahr features — every module explained",
    description:
      "Seven modules, one app. What each one does, who it's for, and where its limits are.",
    url: "/features",
  },
};

export default function FeaturesIndexPage() {
  // ItemList so the module set is machine-readable as a collection rather than
  // seven pages Google has to infer a relationship between.
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Rotahr modules",
    itemListElement: features.map((f, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: f.name,
      url: `${SITE_URL}/features/${f.slug}`,
    })),
  };

  return (
    <main className="min-h-screen bg-[#0A1427] text-white">
      <script
        {...jsonLdProps([
          softwareApplicationSchema(),
          itemList,
          breadcrumbSchema([
            { name: "Rotahr", path: "/landing" },
            { name: "Features", path: "/features" },
          ]),
        ])}
      />

      <div className="max-w-4xl mx-auto px-6 py-16">
        <nav className="text-sm text-slate-400 mb-8">
          <Link href="/landing" className="hover:text-white">Rotahr</Link>
          <span className="mx-2">/</span>
          <span className="text-slate-300">Features</span>
        </nav>

        <h1 className="text-4xl md:text-5xl font-bold mb-5 leading-tight">
          Everything Rotahr does, module by module
        </h1>
        <p className="text-lg text-slate-200 mb-6 max-w-2xl">
          Rotahr is seven modules in one app — scheduling, clock-in and payroll
          hours, HACCP food safety, table bookings, bookkeeping, recipe costing
          and guest CRM — sharing one set of staff, venues and data, so the same
          delivery never gets entered three times.
        </p>
        <p className="text-base text-slate-300 mb-12 max-w-2xl leading-relaxed">
          Each page below covers what the module actually does, who it&apos;s the
          deciding factor for, and where its limits are. The limits are on the
          page on purpose — it&apos;s faster for both of us than finding out in
          week three.
        </p>

        <div className="grid sm:grid-cols-2 gap-4 mb-16">
          {features.map((f) => (
            <Link
              key={f.slug}
              href={`/features/${f.slug}`}
              className="rounded-2xl border border-white/10 bg-white/5 p-6 hover:border-white/25 transition-colors"
            >
              <h2 className="font-semibold text-lg mb-2">{f.name}</h2>
              <p className="text-sm text-slate-300 leading-relaxed mb-3">
                {f.answer}
              </p>
              <span className="text-sm text-[#FF6B35]">Read more →</span>
            </Link>
          ))}
        </div>

        <div className="rounded-2xl bg-gradient-to-r from-[#FF6B35] to-[#E8365D] p-8 text-center mb-16">
          <h2 className="text-2xl font-bold mb-3">Easier to just look</h2>
          <p className="mb-6 text-white/90">
            A full demo venue with real data in every module. Nothing to sign up for.
          </p>
          <Link
            href="/try"
            className="inline-block bg-white text-[#0F1C35] font-semibold px-7 py-3 rounded-xl hover:bg-slate-100 transition-colors"
          >
            Open the demo
          </Link>
        </div>

        <h2 className="text-lg font-semibold mb-4">Comparing options?</h2>
        <div className="flex flex-wrap gap-2 mb-12">
          {competitors.map((o) => (
            <Link
              key={o.slug}
              href={`/compare/${o.slug}`}
              className="text-sm px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-slate-300 hover:text-white hover:border-white/25 transition-colors"
            >
              Rotahr vs {o.name}
            </Link>
          ))}
        </div>

        <h2 className="text-lg font-semibold mb-4">By area</h2>
        <div className="flex flex-wrap gap-2">
          {locations.map((l) => (
            <Link
              key={l.slug}
              href={`/rota-software/${l.slug}`}
              className="text-sm px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-slate-300 hover:text-white hover:border-white/25 transition-colors"
            >
              {l.city}
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
