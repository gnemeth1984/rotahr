"use client";

/**
 * Labour cost % calculator.
 *
 * Pure client-side arithmetic, no data leaves the browser. The guideline band
 * shown underneath the result is a widely-cited industry rule of thumb, not a
 * Rotahr-set target — it's labelled as such so it doesn't read as a promise.
 */

import { useState } from "react";

const fieldClass =
  "w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white " +
  "placeholder:text-slate-500 focus:border-[#FF6B35] focus:outline-none " +
  "focus:ring-2 focus:ring-[#FF6B35]/20 transition-colors";

const labelClass = "block text-sm font-semibold text-slate-300 mb-1.5";

function toNumber(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export default function LabourCostCalculator() {
  const [revenue, setRevenue] = useState("");
  const [labourCost, setLabourCost] = useState("");

  const rev = toNumber(revenue);
  const lab = toNumber(labourCost);
  const pct = rev && rev > 0 && lab !== null ? (lab / rev) * 100 : null;

  let band: { label: string; color: string } | null = null;
  if (pct !== null) {
    if (pct <= 30) band = { label: "On the lean side of the common guideline range", color: "text-emerald-400" };
    else if (pct <= 35) band = { label: "Inside the commonly cited guideline range", color: "text-amber-300" };
    else band = { label: "Above the commonly cited guideline range", color: "text-rose-400" };
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 md:p-8">
      <div className="grid sm:grid-cols-2 gap-5 mb-6">
        <div>
          <label className={labelClass} htmlFor="revenue">
            Revenue for the period
          </label>
          <input
            id="revenue"
            inputMode="decimal"
            className={fieldClass}
            placeholder="e.g. 24000"
            value={revenue}
            onChange={(e) => setRevenue(e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="labour">
            Total labour cost for the same period
          </label>
          <input
            id="labour"
            inputMode="decimal"
            className={fieldClass}
            placeholder="e.g. 7200"
            value={labourCost}
            onChange={(e) => setLabourCost(e.target.value)}
          />
          <p className="text-xs text-slate-500 mt-1.5">
            Gross wages plus employer PRSI/NI and any employer pension contribution, if you want the full cost rather than just wages.
          </p>
        </div>
      </div>

      <div className="rounded-xl bg-[#0A1427] border border-white/10 p-6 text-center">
        <p className="text-sm text-slate-400 mb-1">Labour cost as % of revenue</p>
        <p className="text-4xl font-bold mb-2">
          {pct !== null ? `${pct.toFixed(1)}%` : "—"}
        </p>
        {band && <p className={`text-sm font-medium ${band.color}`}>{band.label}</p>}
      </div>

      <p className="text-xs text-slate-500 mt-5 leading-relaxed">
        Many hospitality operators treat roughly 25–35% of revenue as a common
        guideline range for labour cost, but the right number for your venue
        depends on service style, margin and what's included in "labour cost."
        This is a reference point, not a target Rotahr sets for you — the
        calculation itself is exact; the guideline band is a general industry
        rule of thumb only.
      </p>
    </div>
  );
}
