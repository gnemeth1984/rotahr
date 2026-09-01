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
    "Rota scheduling, clock-in and payroll hours, HACCP food safety, table bookings, bookkeeping, recipe costing, guest CRM with loyalty, in-house staff training and an equipment service register — what each module actually does, and what it doesn't.",
  alternates: { canonical: "/features" },
  openGraph: {
    title: "Rotahr features — every module explained",
    description:
      "Nine modules, one app. What each one does, who it's for, and where its limits are.",
    url: "/features",
  },
};

export default function FeaturesIndexPage() {
  // ItemList so the module set is machine-readable as a collection rather than
  // nine pages Google has to infer a relationship between.
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
            { name: "Rotahr", path: "/" },
            { name: "Features", path: "/features" },
          ]),
        ])}
      />

      <div className="max-w-4xl mx-auto px-6 py-16">
        <nav className="text-sm text-slate-400 mb-8">
          <Link href="/" className="hover:text-white">Rotahr</Link>
          <span className="mx-2">/</span>
          <span className="text-slate-300">Features</span>
        </nav>

        <h1 className="text-4xl md:text-5xl font-bold mb-5 leading-tight">
          Everything Rotahr does, module by module
        </h1>
        <p className="text-lg text-slate-200 mb-6 max-w-2xl">
          Rotahr is nine modules in one app — scheduling, clock-in and payroll
          hours, HACCP food safety, table bookings, bookkeeping, recipe costing,
          guest CRM with loyalty, in-house staff training and an equipment
          service register — sharing one set of staff, venues and data, so the
          same delivery never gets entered three times.
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

        {/*
          Module set stated in the vocabulary directory reviewers actually use.
          G2's Restaurant Management category requires four of: inventory
          management, POS, employee management, accounting, order management,
          reservations. The module names above are the words our customers use
          ("rota", "bookkeeping", "stock") and a reviewer scanning this page for
          "inventory" or "accounting" found neither — a category request was
          already refused once for a mismatch of exactly this kind. The two
          things Rotahr is not are named for the same reason: a claim that
          doesn't hold is worse than a gap that does.
        */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 mb-16">
          <h2 className="text-2xl font-bold mb-2">Where Rotahr fits</h2>
          <p className="text-sm text-slate-300 mb-6 max-w-2xl leading-relaxed">
            Rotahr is restaurant management software: it covers the back of house
            — staff, stock, money, bookings and food safety — for independent
            restaurants, pubs, cafés and small groups. In the standard category
            terms:
          </p>

          <dl className="space-y-4 mb-8">
            {[
              {
                term: "Employee management",
                body: "Rota building, shift templates, time off and break entitlements, clock-in by GPS or QR, and payroll hours export.",
                slug: "staff-scheduling",
              },
              {
                term: "Inventory management",
                body: "Stock counts, supplier deliveries, and recipe costing that re-prices every dish when an ingredient price moves.",
                slug: "stock-recipe-costing",
              },
              {
                term: "Accounting",
                body: "Expense and receipt capture, category totals, P&L, VAT or sales-tax summaries, per-employee labour cost, CSV export.",
                slug: "bookkeeping-receipts",
              },
              {
                term: "Reservations and table management",
                body: "Table bookings with a drag-and-drop floor plan, live table status by service, and guest history on every booking.",
                slug: "table-bookings",
              },
              {
                term: "Order management (purchase orders)",
                body: "Order lists built per supplier off live stock levels, with quantities and unit prices, moving draft to sent to received — plus supplier statement upload and reconciliation against what was ordered. Supplier purchase orders only, not guest orders.",
                slug: "stock-recipe-costing",
              },
              {
                term: "Reporting",
                body: "Labour cost against hours worked, food-safety compliance rates, booking and cover volumes, gross margin per dish.",
                slug: "bookkeeping-receipts",
              },
              {
                term: "Compliance records",
                body: "Paperless HACCP — temperature and delivery checks, cleaning and opening/closing checklists, corrective actions, PDF export for an inspection.",
                slug: "haccp-food-safety",
              },
              {
                term: "Training management",
                body: "Thirteen in-house courses generated from the venue's own menu, equipment register, stock list and HACCP units, with assignment, an 80% pass mark, a 12-month expiry and a printable record. In-house training, not accredited qualifications.",
                slug: "training-certifications",
              },
              {
                term: "Asset and maintenance management",
                body: "Equipment register with warranty, service intervals, service history, uploaded certificates and invoices, and warnings 30 and 7 days before anything falls due.",
                slug: "equipment-register",
              },
            ].map((c) => (
              <div key={c.term} className="border-l-2 border-[#FF6B35] pl-4">
                <dt className="font-semibold">
                  <Link href={`/features/${c.slug}`} className="hover:text-[#FF6B35] transition-colors">
                    {c.term}
                  </Link>
                </dt>
                <dd className="text-sm text-slate-300 leading-relaxed">{c.body}</dd>
              </div>
            ))}
          </dl>

          <h3 className="font-semibold mb-2 text-slate-200">What Rotahr is not</h3>
          <p className="text-sm text-slate-400 leading-relaxed max-w-2xl">
            Rotahr has no point of sale — it does not take payments from your
            guests, take orders at the table or send tickets to the kitchen, and
            it is not a delivery or online-ordering platform. It sits alongside
            whatever till you already run. Order management above means purchase
            orders to your suppliers, never guest orders. And the training module
            is in-house training only: the courses are generated from your own
            data and Rotahr is not an awarding body, so nothing in it is an
            accredited qualification. Where accredited certification is legally
            required, you buy it elsewhere and Rotahr tracks its expiry.
          </p>
        </div>

        <div className="rounded-2xl bg-gradient-to-r from-[#FF6B35] to-[#E8365D] p-8 text-center mb-16">
          <h2 className="text-2xl font-bold mb-3">Easier to just look</h2>
          <p className="mb-6 text-white/90">
            A full demo venue with real data in every module. Nothing to sign up for.
          </p>
          <Link
            href="/product-tour"
            className="inline-block bg-white text-[#0F1C35] font-semibold px-7 py-3 rounded-xl hover:bg-slate-100 transition-colors"
          >
            See real screens
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
