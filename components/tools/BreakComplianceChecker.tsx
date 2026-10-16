"use client";

/**
 * Break / rest-gap compliance checker.
 *
 * Covers one specific, checkable rule per jurisdiction — the statutory
 * minimum rest break tied to shift length — rather than trying to model every
 * working-time rule. Ireland and the UK set genuinely different thresholds,
 * so the jurisdiction picker isn't cosmetic: it changes the number the tool
 * checks against.
 *
 * Sources: Organisation of Working Time Act 1997 (Ireland); Working Time
 * Regulations 1998 (Great Britain) and Working Time Regulations (Northern
 * Ireland) 2016, both of which set the same 20-minute break threshold even
 * though they differ on other things (like the overtime averaging period,
 * which this tool doesn't cover).
 */

import { useState } from "react";

type Jurisdiction = "ie" | "uk";

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

function requiredBreakMinutes(jurisdiction: Jurisdiction, shiftHours: number): number {
  if (jurisdiction === "ie") {
    if (shiftHours >= 6) return 30;
    if (shiftHours >= 4.5) return 15;
    return 0;
  }
  // uk (Great Britain and Northern Ireland share this threshold)
  if (shiftHours > 6) return 20;
  return 0;
}

export default function BreakComplianceChecker() {
  const [jurisdiction, setJurisdiction] = useState<Jurisdiction>("ie");
  const [shiftHours, setShiftHours] = useState("");
  const [breakTaken, setBreakTaken] = useState("");

  const hours = toNumber(shiftHours);
  const taken = toNumber(breakTaken);
  const required = hours !== null ? requiredBreakMinutes(jurisdiction, hours) : null;
  const compliant = required !== null && taken !== null ? taken >= required : null;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 md:p-8">
      <div className="grid sm:grid-cols-3 gap-5 mb-6">
        <div>
          <label className={labelClass} htmlFor="jurisdiction">Jurisdiction</label>
          <select
            id="jurisdiction"
            className={fieldClass}
            value={jurisdiction}
            onChange={(e) => setJurisdiction(e.target.value as Jurisdiction)}
          >
            <option value="ie">Ireland</option>
            <option value="uk">UK (Great Britain &amp; Northern Ireland)</option>
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="shiftHours">Shift length (hours)</label>
          <input
            id="shiftHours"
            inputMode="decimal"
            className={fieldClass}
            placeholder="e.g. 7.5"
            value={shiftHours}
            onChange={(e) => setShiftHours(e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="breakTaken">Break taken (minutes)</label>
          <input
            id="breakTaken"
            inputMode="numeric"
            className={fieldClass}
            placeholder="e.g. 20"
            value={breakTaken}
            onChange={(e) => setBreakTaken(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-xl bg-[#0A1427] border border-white/10 p-6 text-center">
        {required === null || taken === null ? (
          <p className="text-slate-400">Enter a shift length and break taken to check it.</p>
        ) : (
          <>
            <p className="text-sm text-slate-400 mb-1">
              Statutory minimum break for a {hours}-hour shift in{" "}
              {jurisdiction === "ie" ? "Ireland" : "the UK"}
            </p>
            <p className="text-3xl font-bold mb-3">{required} min</p>
            {compliant ? (
              <p className="text-emerald-400 font-medium">
                {taken} minutes taken meets the statutory minimum.
              </p>
            ) : (
              <p className="text-rose-400 font-medium">
                {taken} minutes taken falls short by {required - taken} minutes.
              </p>
            )}
          </>
        )}
      </div>

      <div className="text-xs text-slate-500 mt-5 leading-relaxed space-y-2">
        <p>
          Ireland: no statutory break is required under 4.5 hours; a 15-minute
          break applies from 4.5 hours; a 30-minute break (which may include
          the first 15 minutes) applies from 6 hours, under the Organisation of
          Working Time Act 1997.
        </p>
        <p>
          UK (Great Britain and Northern Ireland): a 20-minute break applies
          once a shift exceeds 6 hours, under the Working Time Regulations
          1998 and the Working Time Regulations (Northern Ireland) 2016.
        </p>
        <p>
          This checks one rule only — the in-shift rest break tied to shift
          length. It doesn't check daily rest between shifts, weekly rest, or
          the different rules that can apply to young workers or night
          workers. Confirm anything that matters against the Workplace
          Relations Commission (Ireland) or Acas / GOV.UK (UK), not this tool.
        </p>
      </div>
    </div>
  );
}
