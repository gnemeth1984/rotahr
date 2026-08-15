"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Hourglass, Play } from "lucide-react";
import { Btn, Panel, Pill } from "./nav-ui";
import type { TimeDebt, TimeDebtBand } from "./types";

const BAND: Record<TimeDebtBand, { label: string; bar: string; text: string; tone: "green" | "amber" | "flame" | "slate" }> = {
  clear: { label: "Clear", bar: "from-emerald-500 to-emerald-400", text: "text-emerald-300", tone: "green" },
  light: { label: "Light", bar: "from-amber-500 to-amber-400", text: "text-amber-200", tone: "amber" },
  heavy: { label: "Heavy", bar: "from-[#ff6b35] to-[#e8365d]", text: "text-[#ffb08a]", tone: "flame" },
  buried: { label: "Buried", bar: "from-rose-500 to-rose-600", text: "text-rose-300", tone: "slate" },
};

/**
 * 4.1 Time Debt — the honest number for "how far behind am I really?".
 *
 * The reason this exists as one figure: overdue work is normally experienced as a
 * vague dread that's impossible to argue with. A number can be argued with, and
 * more importantly it can be reduced — including by deleting things, which the
 * advice line says out loud when the debt gets big enough.
 */
export function TimeDebtCard({
  debt,
  onStart,
}: {
  debt: TimeDebt;
  onStart?: (taskId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const b = BAND[debt.band];
  const total = debt.parts.reduce((n, p) => n + p.mins, 0) || 1;

  return (
    <Panel className="p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
          <Hourglass className={`h-4 w-4 ${b.text}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Time debt</span>
            <Pill tone={b.tone}>{b.label}</Pill>
          </div>
          <p className="mt-1 text-2xl font-bold leading-none text-white">{debt.label}</p>
          <p className="mt-1.5 text-xs leading-snug text-slate-400">{debt.advice}</p>

          {debt.parts.length > 0 && (
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 transition hover:text-slate-300"
            >
              {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              {open ? "Hide the maths" : "Where it came from"}
            </button>
          )}
        </div>
      </div>

      {open && debt.parts.length > 0 && (
        <div className="mt-3 space-y-2 border-t border-white/[0.07] pt-3">
          {debt.parts.map((p) => (
            <div key={p.label} className="flex items-center gap-3">
              <span className="w-32 flex-shrink-0 text-[11px] text-slate-400">{p.label}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${b.bar} transition-all duration-700`}
                  style={{ width: `${Math.min(100, (p.mins / total) * 100)}%` }}
                />
              </div>
              <span className="w-24 flex-shrink-0 text-right text-[10px] text-slate-500">{p.detail}</span>
            </div>
          ))}
          <p className="pt-1 text-[10px] leading-snug text-slate-600">
            Counted over the last three weeks only. Older than that isn&apos;t debt any more — it&apos;s a decision
            you already made.
          </p>
        </div>
      )}

      {debt.firstMove && (
        <div className="mt-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Clear this first</p>
          <p className="mt-1 text-sm font-semibold leading-snug text-white">{debt.firstMove.title}</p>
          {debt.firstMove.startTrigger && (
            <p className="mt-1 text-xs leading-snug text-slate-400">{debt.firstMove.startTrigger}</p>
          )}
          <div className="mt-2.5 flex items-center gap-2">
            {onStart && (
              <Btn size="sm" variant="flame" onClick={() => onStart(debt.firstMove!.taskId)}>
                <Play className="h-3 w-3" />
                Start it now
              </Btn>
            )}
            <span className="text-[11px] text-slate-500">~{debt.firstMove.mins} min</span>
          </div>
        </div>
      )}
    </Panel>
  );
}
