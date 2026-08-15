"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Panel } from "./nav-ui";
import type { Momentum, MomentumBand } from "./types";

const BAND: Record<MomentumBand, { label: string; ring: string; text: string }> = {
  stalled: { label: "Stalled", ring: "#64748b", text: "text-slate-300" },
  warming: { label: "Warming up", ring: "#f59e0b", text: "text-amber-200" },
  moving: { label: "Moving", ring: "#ff6b35", text: "text-[#ffb08a]" },
  flying: { label: "Flying", ring: "#10b981", text: "text-emerald-300" },
};

/**
 * 1.3 Momentum — one number for "am I actually moving?".
 *
 * Rolling 7 days, never just today, so a single bad day cannot make this feel
 * like a punishment. The breakdown is collapsed by default: the score is the
 * point, the detail is only there when he wants to know why.
 */
export function MomentumCard({ momentum }: { momentum: Momentum }) {
  const [open, setOpen] = useState(false);
  const b = BAND[momentum.band];

  // SVG ring geometry — r=34 on a 80x80 box.
  const r = 34;
  const circ = 2 * Math.PI * r;
  const filled = (Math.max(0, Math.min(100, momentum.score)) / 100) * circ;

  const Trend = momentum.delta > 2 ? TrendingUp : momentum.delta < -2 ? TrendingDown : Minus;
  const trendTone =
    momentum.delta > 2 ? "text-emerald-300" : momentum.delta < -2 ? "text-rose-300" : "text-slate-400";

  return (
    <Panel className="p-4">
      <div className="flex items-center gap-4">
        <div className="relative h-20 w-20 flex-shrink-0">
          <svg viewBox="0 0 80 80" className="h-20 w-20 -rotate-90">
            <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" />
            <circle
              cx="40"
              cy="40"
              r={r}
              fill="none"
              stroke={b.ring}
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={`${filled} ${circ - filled}`}
              className="transition-all duration-700"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-bold leading-none text-white">{momentum.score}</span>
            <span className="text-[9px] uppercase tracking-wider text-slate-500">/100</span>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-sm font-semibold ${b.text}`}>{b.label}</span>
            <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${trendTone}`}>
              <Trend className="h-3 w-3" />
              {momentum.delta > 0 ? `+${momentum.delta}` : momentum.delta} vs last week
            </span>
          </div>
          <p className="mt-1 text-xs leading-snug text-slate-400">{momentum.summary}</p>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 transition hover:text-slate-300"
          >
            {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            {open ? "Hide breakdown" : "What's in this"}
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-3 space-y-2 border-t border-white/[0.07] pt-3">
          {momentum.parts.map((p) => (
            <div key={p.label} className="flex items-center gap-3">
              <span className="w-28 flex-shrink-0 text-[11px] text-slate-400">{p.label}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#ff6b35] to-[#e8365d] transition-all duration-700"
                  style={{ width: `${p.max > 0 ? (p.points / p.max) * 100 : 0}%` }}
                />
              </div>
              <span className="w-24 flex-shrink-0 text-right text-[10px] text-slate-500">{p.detail}</span>
            </div>
          ))}
          <p className="pt-1 text-[10px] leading-snug text-slate-600">
            Rolling 7 days. Every part caps out, so this rewards consistency — not overwork.
          </p>
        </div>
      )}
    </Panel>
  );
}
