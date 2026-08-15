"use client";

import { useMemo, useState } from "react";
import { Check, Repeat, Sunrise, Sun, Moon, CalendarCheck, CalendarRange } from "lucide-react";
import { api, errMsg } from "./api";
import { Panel, Pill, SectionTitle } from "./nav-ui";
import type { Ritual, RitualId, RitualLog } from "./types";

const ICON: Record<RitualId, typeof Sunrise> = {
  morning: Sunrise,
  midday: Sun,
  shutdown: Moon,
  weekly: CalendarCheck,
  monthly: CalendarRange,
};

/**
 * 6.3 Rituals.
 *
 * Only ONE ritual is expanded at a time — whichever is live now. Showing five
 * collapsed lists would turn a 4-minute routine into a page to be assessed, and
 * assessment is the exact step that doesn't happen on a bad day.
 *
 * Steps save on tap. No save button, because a save button is one more thing to
 * forget, and a half-ticked ritual that vanished on refresh never gets tried twice.
 */
export function RitualsCard({
  rituals,
  logs,
  current,
  refresh,
}: {
  rituals: Ritual[];
  logs: RitualLog[];
  current: RitualId | null;
  refresh: () => void;
}) {
  const [openId, setOpenId] = useState<RitualId | null>(current ?? rituals[0]?.id ?? null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Optimistic overlay, so a tap feels instant on a phone with bad signal.
  const [local, setLocal] = useState<Record<string, boolean>>({});

  const byRitual = useMemo(() => {
    const m: Record<string, Record<string, boolean>> = {};
    for (const l of logs) m[l.ritual] = (l.steps as Record<string, boolean>) ?? {};
    return m;
  }, [logs]);

  const ticked = (r: RitualId, step: string) => local[`${r}:${step}`] ?? byRitual[r]?.[step] ?? false;

  async function toggle(r: RitualId, step: string) {
    const next = !ticked(r, step);
    const key = `${r}:${step}`;
    setLocal((s) => ({ ...s, [key]: next }));
    setPending(key);
    setError(null);
    try {
      await api("/rituals", { body: { ritual: r, steps: { [step]: next } } });
      refresh();
    } catch (e) {
      setLocal((s) => ({ ...s, [key]: !next }));
      setError(errMsg(e));
    } finally {
      setPending(null);
    }
  }

  if (!rituals.length) return null;

  return (
    <Panel className="p-5">
      <SectionTitle
        right={
          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-slate-500">
            <Repeat className="h-3 w-3" /> Same every day
          </span>
        }
      >
        Rituals
      </SectionTitle>

      {error && <p className="mb-3 text-xs text-rose-300">{error}</p>}

      <div className="space-y-2">
        {rituals.map((r) => {
          const Icon = ICON[r.id];
          const open = openId === r.id;
          const done = r.steps.filter((s) => ticked(r.id, s.id)).length;
          const all = done === r.steps.length;
          const isNow = current === r.id;

          return (
            <div
              key={r.id}
              className={`overflow-hidden rounded-xl border transition-all ${
                all
                  ? "border-emerald-400/25 bg-emerald-500/[0.06]"
                  : isNow
                    ? "border-[#ff6b35]/40 bg-[#ff6b35]/[0.07]"
                    : "border-white/[0.08] bg-white/[0.03]"
              }`}
            >
              <button
                type="button"
                onClick={() => setOpenId(open ? null : r.id)}
                className="flex w-full items-center gap-3 px-3.5 py-3 text-left"
              >
                <Icon className={`h-4 w-4 flex-shrink-0 ${all ? "text-emerald-300" : "text-slate-400"}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-white">{r.title}</span>
                    {isNow && <Pill tone="flame">Now</Pill>}
                    {all && <Pill tone="green">Done</Pill>}
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {r.at} · {r.mins} min · {done}/{r.steps.length}
                  </p>
                </div>
                <div className="h-1.5 w-14 flex-shrink-0 overflow-hidden rounded-full bg-white/[0.08]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#ff6b35] to-[#e8365d] transition-all duration-500"
                    style={{ width: `${(done / r.steps.length) * 100}%` }}
                  />
                </div>
              </button>

              {open && (
                <ul className="space-y-1 border-t border-white/[0.07] px-3.5 py-3">
                  {r.steps.map((s) => {
                    const on = ticked(r.id, s.id);
                    return (
                      <li key={s.id}>
                        <button
                          type="button"
                          onClick={() => toggle(r.id, s.id)}
                          disabled={pending === `${r.id}:${s.id}`}
                          className="flex w-full items-start gap-3 rounded-lg px-1.5 py-2 text-left transition hover:bg-white/[0.04] disabled:opacity-60"
                        >
                          <span
                            className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border transition ${
                              on
                                ? "border-transparent bg-emerald-500 text-white"
                                : "border-white/20 text-transparent"
                            }`}
                          >
                            <Check className="h-3 w-3" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span
                              className={`block text-sm leading-snug ${
                                on ? "text-slate-400 line-through" : "text-slate-100"
                              }`}
                            >
                              {s.label}
                            </span>
                            {s.hint && !on && (
                              <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">{s.hint}</span>
                            )}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-[10px] leading-snug text-slate-600">
        These never change wording. That&apos;s the point — a ritual you have to read is a ritual you have to decide
        about.
      </p>
    </Panel>
  );
}
