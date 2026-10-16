"use client";

/**
 * Overtime cost calculator.
 *
 * The multiplier is a plain input, not a fixed assumption — overtime rates
 * come from contracts, sector agreements or statutory minimums that this tool
 * has no way to know, so the honest move is to let the user state their own
 * rate rather than Rotahr guessing one.
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
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function money(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function OvertimeCostCalculator() {
  const [rate, setRate] = useState("");
  const [hours, setHours] = useState("");
  const [multiplier, setMultiplier] = useState("1.5");
  const [staffCount, setStaffCount] = useState("1");

  const r = toNumber(rate);
  const h = toNumber(hours);
  const m = toNumber(multiplier);
  const n = toNumber(staffCount) ?? 1;

  const canCompute = r !== null && h !== null && m !== null;
  const weekly = canCompute ? r! * h! * m! * n : null;
  const premiumOnly = canCompute ? r! * h! * (m! - 1) * n : null;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 md:p-8">
      <div className="grid sm:grid-cols-2 gap-5 mb-6">
        <div>
          <label className={labelClass} htmlFor="rate">Base hourly rate</label>
          <input
            id="rate"
            inputMode="decimal"
            className={fieldClass}
            placeholder="e.g. 14.50"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="hours">Overtime hours per week</label>
          <input
            id="hours"
            inputMode="decimal"
            className={fieldClass}
            placeholder="e.g. 6"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="multiplier">Overtime multiplier</label>
          <input
            id="multiplier"
            inputMode="decimal"
            className={fieldClass}
            value={multiplier}
            onChange={(e) => setMultiplier(e.target.value)}
          />
          <p className="text-xs text-slate-500 mt-1.5">
            1.5 is a common default, but check the contract or any sector
            agreement that applies — Rotahr doesn't set this rate.
          </p>
        </div>
        <div>
          <label className={labelClass} htmlFor="staffCount">Staff working this overtime</label>
          <input
            id="staffCount"
            inputMode="numeric"
            className={fieldClass}
            value={staffCount}
            onChange={(e) => setStaffCount(e.target.value)}
          />
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="rounded-xl bg-[#0A1427] border border-white/10 p-5 text-center">
          <p className="text-xs text-slate-400 mb-1">Weekly overtime cost</p>
          <p className="text-2xl font-bold">{weekly !== null ? `€${money(weekly)}` : "—"}</p>
        </div>
        <div className="rounded-xl bg-[#0A1427] border border-white/10 p-5 text-center">
          <p className="text-xs text-slate-400 mb-1">≈ Monthly (×4.33 weeks)</p>
          <p className="text-2xl font-bold">{weekly !== null ? `€${money(weekly * 4.33)}` : "—"}</p>
        </div>
        <div className="rounded-xl bg-[#0A1427] border border-white/10 p-5 text-center">
          <p className="text-xs text-slate-400 mb-1">≈ Yearly (×52 weeks)</p>
          <p className="text-2xl font-bold">{weekly !== null ? `€${money(weekly * 52)}` : "—"}</p>
        </div>
      </div>

      {premiumOnly !== null && (
        <p className="text-sm text-slate-400 mt-5">
          Of that weekly figure, <span className="text-white font-medium">€{money(premiumOnly)}</span> is
          the overtime premium itself — the extra you're paying above base rate for the same hours.
        </p>
      )}

      <p className="text-xs text-slate-500 mt-5 leading-relaxed">
        This multiplies the numbers you enter — it doesn't know your contracts,
        collective agreements or local statutory minimums, and currency here is
        just a label on the number you typed in. Use it to see the shape of the
        cost, not as a substitute for checking what rate actually applies.
      </p>
    </div>
  );
}
