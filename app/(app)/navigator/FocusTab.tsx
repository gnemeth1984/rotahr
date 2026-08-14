"use client";

import { useEffect, useMemo, useState } from "react";
import { Ban, Bell, Play, Square, Timer } from "lucide-react";
import { FocusSession, NavState } from "./types";
import { api, errMsg } from "./api";
import { Btn, Empty, Field, Panel, Pill, SectionTitle, inputClass } from "./nav-ui";

export function FocusTab({ state, refresh }: { state: NavState; refresh: () => void }) {
  const live = state.focus;
  const [label, setLabel] = useState("");
  const [planned, setPlanned] = useState(String(state.profile.focusMins || 50));
  const [taskId, setTaskId] = useState("");
  const [outcome, setOutcome] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<FocusSession[]>([]);
  const [weekMinutes, setWeekMinutes] = useState(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    api<{ recent: FocusSession[]; weekMinutes: number }>("/focus")
      .then((d) => {
        setRecent(d.recent ?? []);
        setWeekMinutes(d.weekMinutes ?? 0);
      })
      .catch(() => {});
  }, [state.focus?.id, state.lastFocus?.endedAt]);

  const elapsed = useMemo(() => {
    if (!live) return 0;
    void tick;
    return Math.max(0, Math.floor((Date.now() - new Date(live.startedAt).getTime()) / 1000));
  }, [live, tick]);

  const remaining = live ? live.plannedMins * 60 - elapsed : 0;
  const overrun = remaining < 0;
  const abs = Math.abs(remaining);
  const clock = `${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
  const pct = live ? Math.min(100, (elapsed / (live.plannedMins * 60)) * 100) : 0;

  async function start() {
    const openTask = state.tasks.find((t) => t.id === taskId);
    const finalLabel = label.trim() || openTask?.title;
    if (!finalLabel) {
      setError("Name the one thing you're doing — vague sessions drift.");
      return;
    }
    setBusy("start");
    setError(null);
    try {
      await api("/focus", {
        body: {
          label: finalLabel,
          plannedMins: Number(planned) || 50,
          taskId: taskId || null,
        },
      });
      setLabel("");
      setTaskId("");
      refresh();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  }

  async function patch(action: "end" | "abandon" | "distraction") {
    if (!live) return;
    setBusy(action);
    try {
      await api("/focus", {
        method: "PATCH",
        body: { id: live.id, action, outcome: action === "distraction" ? null : outcome || null },
      });
      if (action !== "distraction") setOutcome("");
      refresh();
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

      {live ? (
        <Panel className="overflow-hidden p-0" glow>
          <div className="relative p-6 text-center">
            <div
              className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#ff6b35] to-[#e8365d] transition-all"
              style={{ width: `${pct}%` }}
            />
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#ffb08a]">
              {overrun ? "Over the planned time" : "In the tunnel"}
            </p>
            <p
              className={`mt-2 font-mono text-6xl font-bold tabular-nums sm:text-7xl ${
                overrun ? "text-amber-300" : "text-white"
              }`}
            >
              {overrun ? "+" : ""}
              {clock}
            </p>
            <p className="mx-auto mt-3 max-w-md text-lg font-semibold leading-snug text-white">{live.label}</p>
            <p className="mt-1 text-sm text-slate-400">
              Planned {live.plannedMins} min · {live.distractions} distraction{live.distractions === 1 ? "" : "s"} logged
            </p>

            <div className="mt-5">
              <input
                className={`${inputClass} mx-auto max-w-md text-center`}
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
                placeholder="What came out of it? (optional)"
              />
            </div>

            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Btn variant="flame" loading={busy === "end"} onClick={() => patch("end")}>
                <Square className="h-4 w-4" />
                Done
              </Btn>
              <Btn variant="ghost" loading={busy === "distraction"} onClick={() => patch("distraction")}>
                <Bell className="h-4 w-4" />
                Got pulled away
              </Btn>
              <Btn variant="danger" loading={busy === "abandon"} onClick={() => patch("abandon")}>
                <Ban className="h-4 w-4" />
                Stop, not finished
              </Btn>
            </div>
            <p className="mt-4 text-xs text-slate-500">
              Logging a distraction instead of quitting is the whole trick. No shame either way.
            </p>
          </div>
        </Panel>
      ) : (
        <Panel className="p-5" glow>
          <SectionTitle right={<Pill tone="green">{weekMinutes}m focused this week</Pill>}>
            <span className="inline-flex items-center gap-2">
              <Timer className="h-3.5 w-3.5" /> Start a hyperfocus block
            </span>
          </SectionTitle>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <Field label="The one thing">
              <input
                className={inputClass}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && start()}
                placeholder="Draft the three outreach emails"
              />
            </Field>
            <Field label="Minutes">
              <input
                className={`${inputClass} sm:w-28`}
                type="number"
                min={5}
                max={240}
                value={planned}
                onChange={(e) => setPlanned(e.target.value)}
              />
            </Field>
          </div>
          {state.tasks.length > 0 && (
            <div className="mt-3">
              <Field label="Or pick an open task">
                <select
                  className={inputClass}
                  value={taskId}
                  onChange={(e) => {
                    setTaskId(e.target.value);
                    const t = state.tasks.find((x) => x.id === e.target.value);
                    if (t) {
                      setLabel(t.title);
                      if (t.effortMins) setPlanned(String(Math.min(240, t.effortMins)));
                    }
                  }}
                >
                  <option value="">—</option>
                  {state.tasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.parentId ? "↳ " : ""}
                      {t.title}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          )}
          <Btn variant="flame" size="lg" className="mt-4 w-full sm:w-auto" loading={busy === "start"} onClick={start}>
            <Play className="h-4 w-4" />
            Start
          </Btn>
          <p className="mt-3 text-xs text-slate-500">
            Break after: {state.profile.breakMins} min. Change it in Setup.
          </p>
        </Panel>
      )}

      <Panel className="p-5">
        <SectionTitle>Recent sessions</SectionTitle>
        {recent.filter((r) => r.endedAt).length === 0 ? (
          <Empty>No finished sessions in the last 7 days.</Empty>
        ) : (
          <ul className="space-y-2">
            {recent
              .filter((r) => r.endedAt)
              .map((r) => (
                <li key={r.id} className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone={r.completed ? "green" : "amber"}>{r.completed ? "Finished" : "Cut short"}</Pill>
                    <Pill tone="slate">
                      {r.actualMins ?? 0}m of {r.plannedMins}m
                    </Pill>
                    {r.distractions > 0 && <Pill tone="blue">{r.distractions} pulls</Pill>}
                    <span className="ml-auto text-xs text-slate-500">
                      {new Date(r.startedAt).toLocaleString("en-IE", {
                        weekday: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="mt-1 font-semibold text-white">{r.label}</p>
                  {r.outcome && <p className="mt-0.5 text-sm text-slate-400">{r.outcome}</p>}
                </li>
              ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
