"use client";

/**
 * ROI calculator.
 *
 * Starting figures match the "what you'd pay using separate tools" section on
 * the homepage (components/marketing/LandingPage.tsx) exactly, so this tool
 * can't quote a different number than the page that sent someone here. Every
 * field is editable — the output is arithmetic on what the visitor actually
 * enters, not a promise about what they'll save.
 */

import { useState } from "react";
import { ROTAHR_PRICING } from "@/lib/seo/competitors";

const fieldClass =
  "w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white " +
  "placeholder:text-slate-500 focus:border-[#FF6B35] focus:outline-none " +
  "focus:ring-2 focus:ring-[#FF6B35]/20 transition-colors";

const labelClass = "block text-sm font-semibold text-slate-300 mb-1.5";

type Plan = "starter" | "pro";

function toNumber(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function money(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

const TOOLS = [
  { key: "rota", name: "Rota & scheduling tool", defaultValue: "115" },
  { key: "bookkeeping", name: "Bookkeeping & receipt tool", defaultValue: "48" },
  { key: "reservations", name: "Reservations system", defaultValue: "100" },
  { key: "payroll", name: "HR & payroll tool", defaultValue: "65" },
] as const;

export default function RoiCalculator() {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(TOOLS.map((t) => [t.key, t.defaultValue]))
  );
  const [plan, setPlan] = useState<Plan>("starter");

  const total = TOOLS.reduce((sum, t) => sum + toNumber(values[t.key]), 0);
  const rotahrPrice = plan === "starter" ? ROTAHR_PRICING.starter : ROTAHR_PRICING.pro;
  const monthlyDiff = total - rotahrPrice;
  const yearlyDiff = monthlyDiff * 12;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 md:p-8">
      <p className="text-sm font-semibold text-slate-300 mb-4">
        What you currently pay for separate tools
      </p>
      <div className="grid sm:grid-cols-2 gap-5 mb-6">
        {TOOLS.map((t) => (
          <div key={t.key}>
            <label className={labelClass} htmlFor={t.key}>{t.name} (€/month)</label>
            <input
              id={t.key}
              inputMode="decimal"
              className={fieldClass}
              value={values[t.key]}
              onChange={(e) => setValues((v) => ({ ...v, [t.key]: e.target.value }))}
            />
          </div>
        ))}
      </div>

      <p className="text-sm font-semibold text-slate-300 mb-3">Rotahr plan</p>
      <div className="flex gap-3 mb-8">
        <button
          type="button"
          onClick={() => setPlan("starter")}
          className={`px-5 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
            plan === "starter"
              ? "border-[#FF6B35] bg-[#FF6B35]/15 text-white"
              : "border-white/15 text-slate-300 hover:bg-white/5"
          }`}
        >
          Starter — €{ROTAHR_PRICING.starter}/mo (up to 15 staff)
        </button>
        <button
          type="button"
          onClick={() => setPlan("pro")}
          className={`px-5 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
            plan === "pro"
              ? "border-[#FF6B35] bg-[#FF6B35]/15 text-white"
              : "border-white/15 text-slate-300 hover:bg-white/5"
          }`}
        >
          Pro — €{ROTAHR_PRICING.pro}/mo (up to 30 staff)
        </button>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="rounded-xl bg-[#0A1427] border border-white/10 p-5 text-center">
          <p className="text-xs text-slate-400 mb-1">Separate tools, total</p>
          <p className="text-2xl font-bold">€{money(total)}/mo</p>
        </div>
        <div className="rounded-xl bg-[#0A1427] border border-white/10 p-5 text-center">
          <p className="text-xs text-slate-400 mb-1">Rotahr {plan === "starter" ? "Starter" : "Pro"}</p>
          <p className="text-2xl font-bold">€{money(rotahrPrice)}/mo</p>
        </div>
        <div className="rounded-xl border p-5 text-center" style={{
          background: monthlyDiff >= 0 ? "rgba(16,185,129,0.08)" : "rgba(244,63,94,0.08)",
          borderColor: monthlyDiff >= 0 ? "rgba(16,185,129,0.3)" : "rgba(244,63,94,0.3)",
        }}>
          <p className="text-xs text-slate-400 mb-1">Difference</p>
          <p className={`text-2xl font-bold ${monthlyDiff >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {monthlyDiff >= 0 ? "−" : "+"}€{money(Math.abs(monthlyDiff))}/mo
          </p>
        </div>
      </div>

      {monthlyDiff !== 0 && (
        <p className="text-sm text-slate-400 mt-5 text-center">
          Over a year, that's{" "}
          <span className={monthlyDiff >= 0 ? "text-emerald-400 font-medium" : "text-rose-400 font-medium"}>
            {monthlyDiff >= 0 ? "−" : "+"}€{money(Math.abs(yearlyDiff))}
          </span>{" "}
          based on the numbers above.
        </p>
      )}

      <p className="text-xs text-slate-500 mt-6 leading-relaxed">
        The starting figures match the typical price ranges for standalone
        rota, bookkeeping, reservations and HR/payroll tools — edit any of
        them to match what you actually pay. This is arithmetic on the
        numbers you enter, not a guaranteed saving, and it doesn't account for
        switching costs, contract notice periods, or features a given tool
        has that Rotahr doesn't.
      </p>
    </div>
  );
}
