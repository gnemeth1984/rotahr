"use client";

import { useMemo, useState } from "react";
import { BatteryLow, Check, ChevronDown, ChevronRight, Inbox, Play, Plus, Scissors, Trash2, Wand2, Zap } from "lucide-react";
import { NavState, Task } from "./types";
import { api, errMsg } from "./api";
import { Btn, Empty, Field, PRIORITY_TONE, Panel, Pill, SectionTitle, inputClass } from "./nav-ui";
import { WarmUpButton } from "./WarmUp";

/**
 * How the AI is asked to cut a task up. "steps" is the ordinary pass;
 * "low_energy" caps every step at 15 minutes of no-thinking work; "smallest"
 * returns exactly one move, for when even a list feels like too much.
 */
type BreakdownMode = "steps" | "low_energy" | "smallest";

const BUCKETS = [
  { id: "urgent", label: "Urgent", blurb: "Real deadlines, real consequences" },
  { id: "important", label: "Important", blurb: "Moves things forward" },
  { id: "quickwin", label: "Quick wins", blurb: "Under 15 minutes — use these to start moving" },
  { id: "later", label: "Later", blurb: "Parked without guilt" },
] as const;

export function TasksTab({ state, refresh }: { state: NavState; refresh: () => void }) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Task["priority"]>("important");
  const [effort, setEffort] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [firstMove, setFirstMove] = useState<{ id: string; text: string } | null>(null);
  const [draft, setDraft] = useState("");

  const [showParked, setShowParked] = useState(false);

  const { parents, childrenOf, parked } = useMemo(() => {
    // Parked is its own place, not a priority. Left in the buckets it would look
    // identical to live work, which makes both auto-park (5.3) and manual parking
    // pointless — the list never actually gets shorter.
    const parents = state.tasks.filter((t) => !t.parentId && t.status !== "parked");
    const parked = state.tasks.filter((t) => t.status === "parked");
    const childrenOf: Record<string, Task[]> = {};
    for (const t of state.tasks) {
      if (t.parentId) (childrenOf[t.parentId] ??= []).push(t);
    }
    return { parents, childrenOf, parked };
  }, [state.tasks]);

  async function add() {
    if (!title.trim()) return;
    setBusy("add");
    setError(null);
    try {
      await api("/tasks", {
        body: {
          title: title.trim(),
          priority,
          effortMins: effort ? Number(effort) : null,
        },
      });
      setTitle("");
      setEffort("");
      refresh();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  }

  // 2.3 Quick capture. Title only, no priority, no estimate — a thought costs
  // one keystroke to store. It lands as a draft, invisible to the list and the
  // nudges until it gets triaged.
  async function capture() {
    if (!draft.trim()) return;
    setBusy("capture");
    setError(null);
    try {
      await api("/tasks", { body: { title: draft.trim(), status: "draft" } });
      setDraft("");
      refresh();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  }

  // Let the model make the boring decisions (priority / effort / where to start)
  // and promote the draft to a real task in one move.
  async function triage(id: string) {
    setBusy(`triage-${id}`);
    setError(null);
    try {
      const out = await api<{ why: string }>(`/tasks/${id}/triage`, { method: "POST" });
      if (out.why) setFirstMove({ id, text: out.why });
      refresh();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  }

  async function patch(id: string, body: Record<string, unknown>) {
    setBusy(id);
    setError(null);
    try {
      await api(`/tasks/${id}`, { method: "PATCH", body });
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
      await api(`/tasks/${id}`, { method: "DELETE" });
      refresh();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  }

  async function breakdown(id: string, mode: BreakdownMode) {
    setBusy(`${mode}-${id}`);
    setError(null);
    setFirstMove(null);
    try {
      const out = await api<{ firstMove: string }>(`/tasks/${id}/breakdown`, {
        method: "POST",
        body: { mode },
      });
      setOpen((o) => ({ ...o, [id]: true }));
      if (out.firstMove) setFirstMove({ id, text: out.firstMove });
      refresh();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  }

  async function startFocus(t: Task) {
    setBusy(`focus-${t.id}`);
    try {
      await api("/focus", {
        body: { label: t.title, taskId: t.id, plannedMins: Math.min(120, t.effortMins ?? state.profile.focusMins) },
      });
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

      {/* 2.3 Brain dump — one field, zero decisions. Deliberately the first thing
          on the tab, above the fuller form, because the whole point is that
          capturing must be faster than thinking about capturing. */}
      <Panel className="p-5">
        <SectionTitle
          right={state.drafts.length ? <Pill tone="violet">{state.drafts.length} waiting</Pill> : undefined}
        >
          Brain dump
        </SectionTitle>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <input
            className={inputClass}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && capture()}
            placeholder="Dump it here — sort it out later"
          />
          <Btn variant="flame" loading={busy === "capture"} onClick={capture}>
            <Inbox className="h-4 w-4" />
            Capture
          </Btn>
        </div>
        <p className="mt-2 text-[11px] leading-snug text-slate-500">
          No priority, no estimate, no decisions. It stays out of your task list and out of your
          notifications until you triage it.
        </p>
      </Panel>

      {state.drafts.length > 0 && (
        <Panel className="p-5">
          <SectionTitle right={<Pill tone="violet">{state.drafts.length}</Pill>}>Inbox — needs triage</SectionTitle>
          <div className="space-y-2">
            {state.drafts.map((d) => (
              <div
                key={d.id}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2.5"
              >
                <p className="min-w-0 flex-1 text-sm leading-snug text-slate-100">{d.title}</p>
                <Btn
                  size="sm"
                  variant="flame"
                  loading={busy === `triage-${d.id}`}
                  onClick={() => triage(d.id)}
                  title="Let Navigator set priority, time and a start trigger"
                >
                  <Wand2 className="h-3.5 w-3.5" />
                  Sort it out
                </Btn>
                <Btn
                  size="sm"
                  variant="quiet"
                  loading={busy === d.id}
                  onClick={() => patch(d.id, { status: "todo" })}
                  title="Move to tasks as-is"
                >
                  Keep as-is
                </Btn>
                <Btn size="sm" variant="quiet" loading={busy === d.id} onClick={() => remove(d.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Btn>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <Panel className="p-5">
        <SectionTitle>Add with details</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
          <input
            className={inputClass}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Whatever's rattling around"
          />
          <select
            className={inputClass}
            value={priority}
            onChange={(e) => setPriority(e.target.value as Task["priority"])}
          >
            {BUCKETS.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </select>
          <input
            className={`${inputClass} sm:w-24`}
            type="number"
            min={1}
            value={effort}
            onChange={(e) => setEffort(e.target.value)}
            placeholder="mins"
          />
          <Btn variant="flame" loading={busy === "add"} onClick={add}>
            <Plus className="h-4 w-4" />
            Add
          </Btn>
        </div>
      </Panel>

      {firstMove && (
        <Panel className="p-4" glow>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#ffb08a]">Next 2 minutes</p>
          <p className="mt-1 text-white">{firstMove.text}</p>
        </Panel>
      )}

      {BUCKETS.map((bucket) => {
        const items = parents.filter((t) => t.priority === bucket.id);
        return (
          <Panel key={bucket.id} className="p-5">
            <SectionTitle right={<Pill tone={PRIORITY_TONE[bucket.id]}>{items.length}</Pill>}>
              {bucket.label}
            </SectionTitle>
            <p className="-mt-2 mb-3 text-xs text-slate-500">{bucket.blurb}</p>
            {items.length === 0 ? (
              <Empty>Nothing here.</Empty>
            ) : (
              <ul className="space-y-2">
                {items.map((t) => {
                  const kids = childrenOf[t.id] ?? [];
                  const expanded = open[t.id] ?? kids.length > 0;
                  const doneKids = kids.filter((k) => k.status === "done").length;
                  return (
                    <li key={t.id} className="rounded-xl border border-white/[0.08] bg-white/[0.03]">
                      <div className="flex items-start gap-3 p-3.5">
                        <button
                          onClick={() => patch(t.id, { status: t.status === "done" ? "todo" : "done" })}
                          disabled={busy === t.id}
                          className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg border border-white/20 text-transparent transition hover:border-[#ff6b35] hover:text-[#ff6b35]/60"
                          aria-label="Complete task"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold leading-snug text-white">{t.title}</p>
                            {t.status === "doing" && <Pill tone="flame">In progress</Pill>}
                            {t.effortMins && <Pill tone="slate">{t.effortMins}m</Pill>}
                            {kids.length > 0 && (
                              <Pill tone={doneKids === kids.length ? "green" : "blue"}>
                                {doneKids}/{kids.length} steps
                              </Pill>
                            )}
                          </div>
                          {t.startTrigger && (
                            <p className="mt-1 flex items-start gap-1.5 text-xs text-[#ffb08a]">
                              <Zap className="mt-0.5 h-3 w-3 flex-shrink-0" />
                              {t.startTrigger}
                            </p>
                          )}
                          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                            {kids.length === 0 ? (
                              <>
                                <Btn
                                  size="sm"
                                  variant="ghost"
                                  loading={busy === `steps-${t.id}`}
                                  onClick={() => breakdown(t.id, "steps")}
                                >
                                  <Scissors className="h-3.5 w-3.5" />
                                  Break it down
                                </Btn>
                                <Btn
                                  size="sm"
                                  variant="quiet"
                                  loading={busy === `low_energy-${t.id}`}
                                  onClick={() => breakdown(t.id, "low_energy")}
                                  title="Short, no-thinking steps for a bad day"
                                >
                                  <BatteryLow className="h-3.5 w-3.5" />
                                  Low energy
                                </Btn>
                                <Btn
                                  size="sm"
                                  variant="quiet"
                                  loading={busy === `smallest-${t.id}`}
                                  onClick={() => breakdown(t.id, "smallest")}
                                  title="Just one tiny move to get unstuck"
                                >
                                  Smallest step
                                </Btn>
                              </>
                            ) : (
                              <Btn size="sm" variant="quiet" onClick={() => setOpen((o) => ({ ...o, [t.id]: !expanded }))}>
                                {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                {expanded ? "Hide steps" : "Show steps"}
                              </Btn>
                            )}
                            {t.startTrigger && t.status !== "done" && (
                              <WarmUpButton
                                task={{
                                  id: t.id,
                                  title: t.title,
                                  startTrigger: t.startTrigger,
                                  effortMins: t.effortMins ?? null,
                                }}
                                focusMins={state.profile.focusMins}
                                onStarted={refresh}
                              />
                            )}
                            <Btn size="sm" variant="quiet" loading={busy === `focus-${t.id}`} onClick={() => startFocus(t)}>
                              <Play className="h-3.5 w-3.5" />
                              Focus
                            </Btn>
                            <Btn size="sm" variant="quiet" onClick={() => patch(t.id, { status: "parked", priority: "later" })}>
                              Park
                            </Btn>
                            <Btn size="sm" variant="quiet" onClick={() => remove(t.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Btn>
                          </div>
                        </div>
                      </div>

                      {expanded && kids.length > 0 && (
                        <ul className="space-y-1.5 border-t border-white/[0.06] bg-black/20 p-3.5">
                          {kids.map((k) => (
                            <li key={k.id} className="flex items-start gap-3">
                              <button
                                onClick={() => patch(k.id, { status: k.status === "done" ? "todo" : "done" })}
                                disabled={busy === k.id}
                                className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border transition ${
                                  k.status === "done"
                                    ? "border-transparent bg-emerald-500 text-white"
                                    : "border-white/20 text-transparent hover:border-[#ff6b35]"
                                }`}
                                aria-label="Complete step"
                              >
                                <Check className="h-3 w-3" />
                              </button>
                              <div className="min-w-0 flex-1">
                                <p
                                  className={`text-sm leading-snug ${
                                    k.status === "done" ? "text-slate-500 line-through" : "text-slate-100"
                                  }`}
                                >
                                  {k.title}
                                  {k.effortMins ? <span className="ml-2 text-xs text-slate-500">{k.effortMins}m</span> : null}
                                </p>
                                {k.startTrigger && k.status !== "done" && (
                                  <p className="mt-0.5 text-[11px] text-slate-500">Start by: {k.startTrigger}</p>
                                )}
                              </div>
                              <button
                                onClick={() => startFocus(k)}
                                className="text-slate-500 transition hover:text-[#ff8f5f]"
                                aria-label="Focus on step"
                              >
                                <Play className="h-3.5 w-3.5" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        );
      })}

      {/* 5.3 — parked work, collapsed. Visible and reversible: anything the app
          moves out of the way on its own has to be one tap from coming back. */}
      {parked.length > 0 && (
        <Panel className="p-5">
          <button
            type="button"
            onClick={() => setShowParked((v) => !v)}
            className="flex w-full items-center gap-2 text-left"
          >
            {showParked ? (
              <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
            )}
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Parked</span>
            <Pill tone="slate">{parked.length}</Pill>
          </button>
          <p className="mt-1.5 text-xs text-slate-500">
            Out of the way, not deleted. Anything on &quot;Later&quot; with no deadline that hasn&apos;t moved in three
            weeks ends up here on its own.
          </p>
          {showParked && (
            <ul className="mt-3 space-y-1.5">
              {parked.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2"
                >
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-400">{t.title}</span>
                  <Btn size="sm" variant="quiet" loading={busy === t.id} onClick={() => patch(t.id, { status: "todo" })}>
                    Bring back
                  </Btn>
                  <button
                    onClick={() => remove(t.id)}
                    disabled={busy === t.id}
                    className="text-slate-600 transition hover:text-rose-300"
                    aria-label="Delete task"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      {state.doneToday.length > 0 && (
        <Panel className="p-5">
          <SectionTitle right={<Pill tone="green">{state.doneToday.length}</Pill>}>Done today</SectionTitle>
          <ul className="space-y-1.5">
            {state.doneToday.map((t) => (
              <li key={t.id} className="flex items-center gap-2 text-sm text-slate-400">
                <Check className="h-3.5 w-3.5 flex-shrink-0 text-emerald-400" />
                {t.title}
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
