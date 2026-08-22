import Link from "next/link";
import { competitors } from "@/lib/seo/competitors";
import { jsonLdProps, breadcrumbSchema } from "@/lib/seo/structured-data";

export const metadata = {
  title: "Rotahr vs Bizimply, RotaCloud, Deputy & More",
  description:
    "How Rotahr compares to Bizimply, RotaCloud, Deputy, Planday, 7shifts and Sling for pubs, cafes and restaurants. Includes where each competitor is the better choice.",
  alternates: { canonical: "/compare" },
};


const YES = "yes";
const NO = "no";
const PARTIAL = "partial";

type Val = "yes" | "no" | "partial";

interface Row {
  feature: string;
  category: string;
  rotahr: Val;
  deputy: Val;
  bizimply: Val;
  sevenShifts: Val;
  planday: Val;
  sling: Val;
}

const rows: Row[] = [
  // Scheduling
  { feature: "Rota / Scheduling", category: "Core", rotahr: YES, deputy: YES, bizimply: YES, sevenShifts: YES, planday: YES, sling: YES },
  { feature: "Shift templates & copy week", category: "Core", rotahr: YES, deputy: YES, bizimply: YES, sevenShifts: YES, planday: YES, sling: YES },
  { feature: "Auto-scheduling (AI)", category: "Core", rotahr: YES, deputy: YES, bizimply: NO, sevenShifts: YES, planday: NO, sling: NO },
  { feature: "Irish public holiday detection", category: "Core", rotahr: YES, deputy: PARTIAL, bizimply: YES, sevenShifts: NO, planday: NO, sling: NO },
  // Attendance
  { feature: "Clock in / out", category: "Attendance", rotahr: YES, deputy: YES, bizimply: YES, sevenShifts: YES, planday: YES, sling: YES },
  { feature: "GPS / geofence clock-in", category: "Attendance", rotahr: YES, deputy: YES, bizimply: YES, sevenShifts: YES, planday: YES, sling: YES },
  { feature: "Break tracking (compliance)", category: "Attendance", rotahr: YES, deputy: YES, bizimply: YES, sevenShifts: YES, planday: YES, sling: PARTIAL },
  // HR
  { feature: "Time-off management", category: "HR", rotahr: YES, deputy: YES, bizimply: YES, sevenShifts: YES, planday: YES, sling: YES },
  { feature: "Staff availability preferences", category: "HR", rotahr: YES, deputy: YES, bizimply: YES, sevenShifts: YES, planday: YES, sling: YES },
  { feature: "Employee profiles & docs", category: "HR", rotahr: YES, deputy: YES, bizimply: YES, sevenShifts: PARTIAL, planday: YES, sling: NO },
  { feature: "Training & cert tracker (HACCP)", category: "HR", rotahr: YES, deputy: NO, bizimply: YES, sevenShifts: NO, planday: NO, sling: NO },
  { feature: "Late / no-show auto-alerts", category: "HR", rotahr: YES, deputy: YES, bizimply: YES, sevenShifts: YES, planday: YES, sling: PARTIAL },
  { feature: "Manager log book (86'd items, repairs)", category: "HR", rotahr: YES, deputy: NO, bizimply: NO, sevenShifts: YES, planday: NO, sling: NO },
  { feature: "Region-aware overtime compliance (EU/UK/US/CA/AU)", category: "HR", rotahr: YES, deputy: PARTIAL, bizimply: PARTIAL, sevenShifts: PARTIAL, planday: PARTIAL, sling: NO },
  // Comms
  { feature: "Team messaging", category: "Comms", rotahr: YES, deputy: YES, bizimply: NO, sevenShifts: YES, planday: YES, sling: YES },
  { feature: "Mobile app (iOS & Android)", category: "Comms", rotahr: YES, deputy: YES, bizimply: YES, sevenShifts: YES, planday: YES, sling: YES },
  { feature: "Push notifications", category: "Comms", rotahr: YES, deputy: YES, bizimply: YES, sevenShifts: YES, planday: YES, sling: YES },
  // Finance
  { feature: "Payroll export (CSV / BrightPay)", category: "Finance", rotahr: YES, deputy: YES, bizimply: YES, sevenShifts: YES, planday: YES, sling: NO },
  { feature: "Labour cost % on rota", category: "Finance", rotahr: YES, deputy: YES, bizimply: YES, sevenShifts: YES, planday: YES, sling: NO },
  { feature: "Bookkeeping & receipt AI", category: "Finance", rotahr: YES, deputy: NO, bizimply: NO, sevenShifts: NO, planday: NO, sling: NO },
  { feature: "VAT tracking & P&L dashboard", category: "Finance", rotahr: YES, deputy: NO, bizimply: NO, sevenShifts: NO, planday: NO, sling: NO },
  { feature: "Labour cost vs revenue trend reports", category: "Finance", rotahr: YES, deputy: NO, bizimply: NO, sevenShifts: YES, planday: YES, sling: NO },
  { feature: "Per-venue labour cost breakdown", category: "Finance", rotahr: YES, deputy: PARTIAL, bizimply: NO, sevenShifts: YES, planday: PARTIAL, sling: NO },
  // Hospitality-specific
  { feature: "Reservations / table bookings", category: "Hospitality", rotahr: YES, deputy: NO, bizimply: NO, sevenShifts: NO, planday: NO, sling: NO },
  { feature: "Menu specials board", category: "Hospitality", rotahr: YES, deputy: NO, bizimply: NO, sevenShifts: NO, planday: NO, sling: NO },
  { feature: "AI booking assistant", category: "Hospitality", rotahr: YES, deputy: NO, bizimply: NO, sevenShifts: NO, planday: NO, sling: NO },
  { feature: "CRM promo codes with QR redemption", category: "Hospitality", rotahr: YES, deputy: NO, bizimply: NO, sevenShifts: NO, planday: NO, sling: NO },
  { feature: "Send CRM email from your own Gmail", category: "Hospitality", rotahr: YES, deputy: NO, bizimply: NO, sevenShifts: NO, planday: NO, sling: NO },
  // Scale
  { feature: "Multi-venue support", category: "Scale", rotahr: YES, deputy: YES, bizimply: YES, sevenShifts: YES, planday: YES, sling: YES },
  { feature: "AI assistant (scheduling + ops)", category: "Scale", rotahr: YES, deputy: PARTIAL, bizimply: NO, sevenShifts: PARTIAL, planday: NO, sling: NO },
];

// Deliberately the pricing MODEL, not a headline number. Vendor list prices
// move, several of these vendors don't publish one at all, and third-party
// aggregators contradict each other. The model is verifiable and is the
// difference that actually shows up on a venue's bill as it hires.
const pricing: Record<string, string> = {
  rotahr: "Flat monthly",
  deputy: "Per user",
  bizimply: "On request",
  sevenShifts: "Per location",
  planday: "Per user + fee",
  sling: "Free tier / per user",
};

const cols = [
  { key: "rotahr", label: "Rotahr", highlight: true },
  { key: "deputy", label: "Deputy", highlight: false },
  { key: "bizimply", label: "Bizimply", highlight: false },
  { key: "sevenShifts", label: "7shifts", highlight: false },
  { key: "planday", label: "Planday", highlight: false },
  { key: "sling", label: "Sling", highlight: false },
];

function Cell({ val }: { val: Val }) {
  if (val === YES) return <span className="text-emerald-500 font-bold text-lg leading-none">✓</span>;
  if (val === NO) return <span className="text-red-400 font-bold text-lg leading-none">✕</span>;
  return <span className="text-amber-400 font-bold text-lg leading-none" title="Partial">—</span>;
}

const categories = Array.from(new Set(rows.map((r) => r.category)));

export default function ComparePage() {
  return (
    <main className="min-h-screen bg-gray-950 text-white px-4 py-16">
      <script
        {...jsonLdProps(
          breadcrumbSchema([
            { name: "Rotahr", path: "/" },
            { name: "Compare", path: "/compare" },
          ])
        )}
      />
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <span className="inline-block bg-emerald-500/10 text-emerald-400 text-xs font-semibold tracking-widest uppercase px-3 py-1 rounded-full mb-4">
            Competitor Comparison
          </span>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Rotahr vs the rest
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            One app for the rota, food safety records, bookings and the books — built for independent pubs, cafes and restaurants. Including, honestly, where each of these is the better choice for you.
          </p>
        </div>

        {/* Legend */}
        <div className="flex gap-6 justify-center mb-8 text-sm text-gray-400">
          <span className="flex items-center gap-1.5"><span className="text-emerald-500 font-bold">✓</span> Available</span>
          <span className="flex items-center gap-1.5"><span className="text-red-400 font-bold">✕</span> Not available</span>
          <span className="flex items-center gap-1.5"><span className="text-amber-400 font-bold">—</span> Partial / add-on</span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-900">
                <th className="text-left px-4 py-3 text-gray-400 font-medium w-64">Feature</th>
                {cols.map((col) => (
                  <th
                    key={col.key}
                    className={`px-4 py-3 text-center font-semibold ${
                      col.highlight
                        ? "bg-emerald-500/10 text-emerald-400 border-x border-emerald-500/30"
                        : "text-gray-300"
                    }`}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => {
                const catRows = rows.filter((r) => r.category === cat);
                return (
                  <>
                    {/* Category header */}
                    <tr key={`cat-${cat}`} className="bg-gray-900/60">
                      <td
                        colSpan={7}
                        className="px-4 py-2 text-xs font-bold tracking-widest uppercase text-gray-500"
                      >
                        {cat}
                      </td>
                    </tr>
                    {catRows.map((row, i) => (
                      <tr
                        key={row.feature}
                        className={`border-t border-white/5 ${
                          i % 2 === 0 ? "bg-gray-950" : "bg-gray-900/30"
                        } hover:bg-gray-800/50 transition-colors`}
                      >
                        <td className="px-4 py-3 text-gray-200">{row.feature}</td>
                        {cols.map((col) => (
                          <td
                            key={col.key}
                            className={`px-4 py-3 text-center ${
                              col.highlight
                                ? "bg-emerald-500/5 border-x border-emerald-500/20"
                                : ""
                            }`}
                          >
                            <Cell val={(row as any)[col.key]} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </>
                );
              })}

              {/* Pricing row */}
              <tr className="border-t-2 border-white/20 bg-gray-900">
                <td className="px-4 py-4 font-bold text-white">Starting price</td>
                {cols.map((col) => (
                  <td
                    key={col.key}
                    className={`px-4 py-4 text-center text-xs font-semibold ${
                      col.highlight
                        ? "bg-emerald-500/10 text-emerald-400 border-x border-emerald-500/30"
                        : "text-gray-300"
                    }`}
                  >
                    {pricing[col.key]}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {/* Bottom note */}
        <p className="text-center text-gray-500 text-xs mt-6">
          Based on each vendor's publicly marketed feature set, checked 2 August 2026. Partial (—) means the feature is a paid add-on or limited in scope. Pricing models are taken from each vendor's own pricing page — we don't quote aggregator sites because they're often years stale. Verify current pricing before you buy.
        </p>

        {/* Deep links: each competitor gets a full page of its own, which is
            what ranks for "<competitor> alternative" searches. */}
        <div className="mt-14">
          <h2 className="text-center text-lg font-semibold mb-5">
            Read the detailed comparison
          </h2>
          <div className="flex flex-wrap gap-2 justify-center">
            {competitors.map((c) => (
              <Link
                key={c.slug}
                href={`/compare/${c.slug}`}
                className="text-sm px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-gray-300 hover:text-white hover:border-white/25 transition-colors"
              >
                Rotahr vs {c.name}
              </Link>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="flex justify-center mt-12">
          <Link
            href="/try"
            className="bg-emerald-500 hover:bg-emerald-400 text-white font-semibold px-8 py-3 rounded-xl transition-colors text-base"
          >
            Have a look yourself →
          </Link>
        </div>
      </div>
    </main>
  );
}
