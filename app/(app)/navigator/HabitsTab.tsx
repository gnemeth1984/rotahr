"use client";

import { useMemo, useState } from "react";
import { Check, Flame, Plus, Trash2, TrendingUp } from "lucide-react";
import { NavState } from "./types";
import { api, errMsg } from "./api";
import { Btn, Empty, Field, Panel, Pill, SectionTitle, inputClass } from "./nav-ui";

const dayKey = (v: string) => String(v).slice(0, 10);

function addDays(key: string, n: number) {
  const d = new Date(`${key}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function HabitsTab({ state, refresh }: { state: NavState; refresh: () => void }) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("");
  const [target, setTarget] = useState("7");
  const [cue, setCue] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<{
    patterns: string[];
    wins: string[];
    oneChange: string;
    nextWeek: string[];
    encouragement: string;
  } | null>(null);

  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(state.weekStart, i)), [state.weekStart]);

  const logged = useMemo(() => {
    const set = new Set<string>();
    for (const l of state.habitLogs) if (l.done) set.add(`${l.habitId}|${dayKey(l.date)}`);
    return set;
  }, [state.habitLogs]);

  async function addHabit() {
    if (!name.trim()) return;
    setBusy("add");
    setError(null);
    try {
      await api("/habits", {
        body: {
          name: name.trim(),
          emoji: emoji.trim() || undefined,
          targetPerWk: Number(target) || 7,
          cue: cue.trim() || null,
        },
      });
      setName("");
      setEmoji("");
      setCue("");
      refresh();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  }

  async function toggle(habitId: string, key: string) {
    const done = !logged.has(`${habitId}|${key}`);
    setBusy(`${habitId}|${key}`);
    try {
      await api("/habits/log", { body: { habitId, dateKey: key, done } });
      refresh();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string) {
    setBusy(id);
    try {
      await api(`/habits/${id}`, { method: "DELETE" });
      refresh();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  }

  async function runReview() {
    setBusy("review");
    setError(null);
    setReview(null);
    try {
      setReview(await api("/coach", { body: { action: "week" } }));
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>
      )}

      <Panel className="p-5">
        <SectionTitle right={<Pill tone="slate">Week of {state.weekStart}</Pill>}>This week</SectionTitle>
        {state.habits.length === 0 ? (
          <Empty>No habits yet. Start with one, not six.</Empty>
        ) : (
          <div className="-mx-1 overflow-x-auto px-1">
            <table className="w-full min-w-[520px] border-separate border-spacing-y-1.5">
              <thead>
                <tr>
                  <th className="w-full" />
                  {week.map((k, i) => (
                    <th key={k} className="px-1 pb-1 text-center">
                      <span
                        className={`block text-[10px] font-semibold uppercase tracking-wider ${
                          k === state.today ? "text-[#ff8f5f]" : "text-slate-500"
                        }`}
                      >
                        {DOW[i]}
                      </span>
                    </th>
                  ))}
                  <th className="pl-2" />
                </tr>
              </thead>
              <tbody>
                {state.habits.map((h) => {
                  const hits = week.filter((k) => logged.has(`${h.id}|${k}`)).length;
                  const hit = hits >= h.targetPerWk;
                  return (
                    <tr key={h.id}>
                      <td className="rounded-l-xl border-y border-l border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{h.emoji}</span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-white">{h.name}</p>
                            {h.cue && <p className="truncate text-[11px] text-slate-500">After: {h.cue}</p>}
                          </div>
                          <span className="ml-auto flex-shrink-0">
                            <Pill tone={hit ? "green" : "slate"}>
                              {hits}/{h.targetPerWk}
                            </Pill>
                          </span>
                        </div>
                      </td>
                      {week.map((k) => {
                        const on = logged.has(`${h.id}|${k}`);
                        const future = k > state.today;
                        return (
                          <td key={k} className="border-y border-white/[0.08] bg-white/[0.03] px-1 py-2.5 text-center">
                            <button
                              onClick={() => toggle(h.id, k)}
                              disabled={future || busy === `${h.id}|${k}`}
                              className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border transition ${
                                on
                                  ? "border-transparent bg-gradient-to-br from-[#ff6b35] to-[#e8365d] text-white"
                                  : future
                                    ? "border-white/[0.06] text-transparent"
                                    : "border-white/15 text-transparent hover:border-[#ff6b35]"
                              }`}
                              aria-label={`${h.name} ${k}`}
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        );
                      })}
                      <td className="rounded-r-xl border-y border-r border-white/[0.08] bg-white/[0.03] px-3 py-2.5">
                        <button
                          onClick={() => remove(h.id)}
                          className="text-slate-600 transition hover:text-rose-300"
                          aria-label="Delete habit"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel className="p-5">
        <SectionTitle>Add a habit</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-[auto_1fr_auto]">
          <Field label="Icon">
            <input
              className={`${inputClass} sm:w-20 text-center`}
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              placeholder="💧"
              maxLength={4}
            />
          </Field>
          <Field label="Habit">
            <input
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addHabit()}
              placeholder="Meds with breakfast"
            />
          </Field>
          <Field label="Times / week">
            <input
              className={`${inputClass} sm:w-28`}
              type="number"
              min={1}
              max={21}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
          </Field>
        </div>
        <div className="mt-3">
          <Field label="Cue" hint="Anchor it to something that already happens — that's what makes it stick.">
            <input
              className={inputClass}
              value={cue}
              onChange={(e) => setCue(e.target.value)}
              placeholder="After I put the kettle on"
            />
          </Field>
        </div>
        <Btn variant="flame" className="mt-4" loading={busy === "add"} onClick={addHabit}>
          <Plus className="h-4 w-4" />
          Track it
        </Btn>
      </Panel>

      <Panel className="p-5">
        <SectionTitle
          right={
            <Btn size="sm" variant="ghost" loading={busy === "review"} onClick={runReview}>
              <TrendingUp className="h-3.5 w-3.5" />
              Review my week
            </Btn>
          }
        >
          Patterns
        </SectionTitle>

        {!review ? (
          <Empty>Run the review and Navigator reads your energy check-ins, focus sessions and completions.</Empty>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-[#ff6b35]/30 bg-[#ff6b35]/10 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#ffb08a]">
                <Flame className="mr-1 inline h-3 w-3" />
                The one change
              </p>
              <p className="mt-1 font-bold text-white">{review.oneChange}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Patterns</p>
                <ul className="space-y-1.5 text-sm text-slate-300">
                  {review.patterns.map((p, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-[#ff6b35]" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Wins</p>
                <ul className="space-y-1.5 text-sm text-slate-300">
                  {review.wins.map((w, i) => (
                    <li key={i} className="flex gap-2">
                      <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-400" />
                      {w}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Next week</p>
              <ul className="space-y-1.5 text-sm text-slate-300">
                {review.nextWeek.map((n, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-slate-600">{i + 1}.</span>
                    {n}
                  </li>
                ))}
              </ul>
            </div>
            <p className="border-t border-white/[0.06] pt-3 text-sm italic text-slate-400">{review.encouragement}</p>
          </div>
        )}
      </Panel>
    </div>
  );
}
