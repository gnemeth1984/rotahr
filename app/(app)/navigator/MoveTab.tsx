"use client";

import { useState } from "react";
import { Check, Plus, Sparkles, Trash2 } from "lucide-react";
import { NavState } from "./types";
import { api, errMsg } from "./api";
import { Btn, Empty, Field, Panel, Pill, SectionTitle, inputClass } from "./nav-ui";

const MOODS = ["flat", "normal", "restless", "wired", "sore", "low motivation"];

export function MoveTab({ state, refresh }: { state: NavState; refresh: () => void }) {
  const [minutes, setMinutes] = useState("15");
  const [mood, setMood] = useState("normal");
  const [where, setWhere] = useState("home, no equipment");
  const [mode, setMode] = useState<"single" | "week">("single");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [manual, setManual] = useState({ title: "", kind: "movement", durationMins: "15" });

  async function generate() {
    setBusy("gen");
    setError(null);
    setNote(null);
    try {
      const out = await api<{ note?: string }>("/workouts", {
        body: {
          action: "generate",
          mode,
          minutes: Number(minutes) || 15,
          mood,
          where,
        },
      });
      if (out.note) setNote(out.note);
      refresh();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  }

  async function addManual() {
    if (!manual.title.trim()) return;
    setBusy("add");
    try {
      await api("/workouts", {
        body: {
          action: "add",
          title: manual.title.trim(),
          kind: manual.kind,
          durationMins: Number(manual.durationMins) || 10,
        },
      });
      setManual({ ...manual, title: "" });
      refresh();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  }

  async function toggle(id: string, completed: boolean) {
    setBusy(id);
    try {
      await api(`/workouts/${id}`, { method: "PATCH", body: { completed } });
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
      await api(`/workouts/${id}`, { method: "DELETE" });
      refresh();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  }

  const doneMins = state.workouts.filter((w) => w.completed).reduce((s, w) => s + w.durationMins, 0);

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>
      )}

      <Panel className="p-5" glow={state.workouts.length === 0}>
        <SectionTitle>Movement that fits the body you have today</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Minutes you'll realistically give">
            <input
              className={inputClass}
              type="number"
              min={5}
              max={120}
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
            />
          </Field>
          <Field label="How the body feels">
            <select className={inputClass} value={mood} onChange={(e) => setMood(e.target.value)}>
              {MOODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Where">
            <input className={inputClass} value={where} onChange={(e) => setWhere(e.target.value)} />
          </Field>
          <Field label="Plan">
            <select className={inputClass} value={mode} onChange={(e) => setMode(e.target.value as "single" | "week")}>
              <option value="single">Just today</option>
              <option value="week">Next 7 days</option>
            </select>
          </Field>
        </div>
        <Btn variant="flame" className="mt-4" loading={busy === "gen"} onClick={generate}>
          <Sparkles className="h-4 w-4" />
          Give me something to do
        </Btn>
        {note && (
          <div className="mt-4 rounded-xl border border-[#ff6b35]/30 bg-[#ff6b35]/10 px-4 py-3 text-sm text-[#ffd0ba]">
            {note}
          </div>
        )}
      </Panel>

      <Panel className="p-5">
        <SectionTitle right={<Pill tone="green">{doneMins}m done this week</Pill>}>Next 7 days</SectionTitle>
        {state.workouts.length === 0 ? (
          <Empty>Nothing scheduled. Ten minutes counts — generate something above.</Empty>
        ) : (
          <ul className="space-y-2">
            {state.workouts.map((w) => (
              <li
                key={w.id}
                className={`rounded-xl border px-3.5 py-3 ${
                  w.completed ? "border-emerald-400/20 bg-emerald-500/[0.06]" : "border-white/[0.08] bg-white/[0.03]"
                }`}
              >
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => toggle(w.id, !w.completed)}
                    disabled={busy === w.id}
                    className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg border transition ${
                      w.completed
                        ? "border-transparent bg-emerald-500 text-white"
                        : "border-white/20 text-transparent hover:border-[#ff6b35]"
                    }`}
                    aria-label="Mark done"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-slate-400">{String(w.date).slice(5, 10)}</span>
                      <Pill tone="violet">{w.kind}</Pill>
                      <Pill tone="slate">
                        {w.durationMins}m · {w.intensity}
                      </Pill>
                    </div>
                    <p className={`mt-1 font-semibold ${w.completed ? "text-slate-400 line-through" : "text-white"}`}>
                      {w.title}
                    </p>
                    {w.steps && w.steps.length > 0 && (
                      <ol className="mt-2 space-y-1">
                        {w.steps.map((s, i) => (
                          <li key={i} className="flex gap-2 text-xs text-slate-400">
                            <span className="text-slate-600">{i + 1}.</span>
                            {s}
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                  <button
                    onClick={() => remove(w.id)}
                    className="text-slate-600 transition hover:text-rose-300"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 grid gap-3 border-t border-white/[0.06] pt-4 sm:grid-cols-[1fr_auto_auto_auto]">
          <input
            className={inputClass}
            value={manual.title}
            onChange={(e) => setManual({ ...manual, title: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && addManual()}
            placeholder="Log something you already did"
          />
          <select
            className={inputClass}
            value={manual.kind}
            onChange={(e) => setManual({ ...manual, kind: e.target.value })}
          >
            {["movement", "walk", "strength", "cardio", "mobility"].map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          <input
            className={`${inputClass} sm:w-24`}
            type="number"
            min={1}
            value={manual.durationMins}
            onChange={(e) => setManual({ ...manual, durationMins: e.target.value })}
          />
          <Btn variant="ghost" loading={busy === "add"} onClick={addManual}>
            <Plus className="h-4 w-4" />
            Add
          </Btn>
        </div>
      </Panel>
    </div>
  );
}
