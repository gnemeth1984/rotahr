import { CheckIcon, XMarkIcon, MinusIcon } from "@heroicons/react/24/solid";
import Link from "next/link";

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
  // Comms
  { feature: "Team messaging", category: "Comms", rotahr: YES, deputy: YES, bizimply: NO, sevenShifts: YES, planday: YES, sling: YES },
  { feature: "Mobile app (iOS & Android)", category: "Comms", rotahr: YES, deputy: YES, bizimply: YES, sevenShifts: YES, planday: YES, sling: YES },
  { feature: "Push notifications", category: "Comms", rotahr: YES, deputy: YES, bizimply: YES, sevenShifts: YES, planday: YES, sling: YES },
  // Finance
  { feature: "Payroll export (CSV / BrightPay)", category: "Finance", rotahr: YES, deputy: YES, bizimply: YES, sevenShifts: YES, planday: YES, sling: NO },
  { feature: "Labour cost % on rota", category: "Finance", rotahr: YES, deputy: YES, bizimply: YES, sevenShifts: YES, planday: YES, sling: NO },
  { feature: "Bookkeeping & receipt AI", category: "Finance", rotahr: YES, deputy: NO, bizimply: NO, sevenShifts: NO, planday: NO, sling: NO },
  { feature: "VAT tracking & P&L dashboard", category: "Finance", rotahr: YES, deputy: NO, bizimply: NO, sevenShifts: NO, planday: NO, sling: NO },
  // Hospitality-specific
  { feature: "Reservations / table bookings", category: "Hospitality", rotahr: YES, deputy: NO, bizimply: NO, sevenShifts: NO, planday: NO, sling: NO },
  { feature: "Menu specials board", category: "Hospitality", rotahr: YES, deputy: NO, bizimply: NO, sevenShifts: NO, planday: NO, sling: NO },
  { feature: "AI booking assistant", category: "Hospitality", rotahr: YES, deputy: NO, bizimply: NO, sevenShifts: NO, planday: NO, sling: NO },
  // Scale
  { feature: "Multi-venue support", category: "Scale", rotahr: YES, deputy: YES, bizimply: YES, sevenShifts: YES, planday: YES, sling: YES },
  { feature: "AI assistant (scheduling + ops)", category: "Scale", rotahr: YES, deputy: PARTIAL, bizimply: NO, sevenShifts: PARTIAL, planday: NO, sling: NO },
];

const pricing: Record<string, string> = {
  rotahr: "€49 Starter",
  deputy: "€4–5/user/mo",
  bizimply: "€4/user/mo",
  sevenShifts: "$29.99 flat",
  planday: "€2.50/user/mo",
  sling: "Free / $1.70/user",
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
  if (val === YES) return <CheckIcon className="w-5 h-5 text-emerald-500 mx-auto" />;
  if (val === NO) return <XMarkIcon className="w-5 h-5 text-red-400 mx-auto" />;
  return <MinusIcon className="w-5 h-5 text-amber-400 mx-auto" title="Partial" />;
}

const categories = Array.from(new Set(rows.map((r) => r.category)));

export default function ComparePage() {
  return (
    <main className="min-h-screen bg-gray-950 text-white px-4 py-16">
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
            The only hospitality platform that combines rota, HR, bookkeeping, and reservations — built specifically for Irish restaurants, bars and hotels.
          </p>
        </div>

        {/* Legend */}
        <div className="flex gap-6 justify-center mb-8 text-sm text-gray-400">
          <span className="flex items-center gap-1.5"><CheckIcon className="w-4 h-4 text-emerald-500" /> Available</span>
          <span className="flex items-center gap-1.5"><XMarkIcon className="w-4 h-4 text-red-400" /> Not available</span>
          <span className="flex items-center gap-1.5"><MinusIcon className="w-4 h-4 text-amber-400" /> Partial / add-on</span>
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
          Data based on publicly available feature lists as of June 2026. Partial (—) indicates the feature exists as a paid add-on or is limited in scope.
        </p>

        {/* CTA */}
        <div className="flex justify-center mt-12">
          <Link
            href="/auth/signin"
            className="bg-emerald-500 hover:bg-emerald-400 text-white font-semibold px-8 py-3 rounded-xl transition-colors text-base"
          >
            Get started with Rotahr →
          </Link>
        </div>
      </div>
    </main>
  );
}
