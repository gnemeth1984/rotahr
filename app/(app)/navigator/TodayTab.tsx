"use client";

import { useMemo, useState } from "react";
import { Anchor, Check, Sparkles, HelpCircle, Split, Wand2, Moon, Shrink, AlertTriangle } from "lucide-react";
import { Block, NavState } from "./types";
import { api, errMsg } from "./api";
import { Btn, Empty, Field, KIND_TONE, Panel, Pill, Scale, SectionTitle, inputClass } from "./nav-ui";
import { MomentumCard } from "./MomentumCard";
import { TimeDebtCard } from "./TimeDebtCard";
import { RitualsCard } from "./RitualsCard";
import { NudgeFeed } from "./NudgeFeed";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** A block with no real time window has nothing to render and breaks the maths. */
function isRenderableBlock(b: unknown): b is Block {
  if (!b || typeof b !== "object") return false;
  const r = b as Record<string, unknown>;
  return (
    typeof r.start === "string" &&
    HHMM.test(r.start) &&
    typeof r.end === "string" &&
    HHMM.test(r.end) &&
    typeof r.label === "string" &&
    !!r.label.trim()
  );
}

export function TodayTab({ state, refresh }: { state: NavState; refresh: () => void }) {
  const plan = state.plan;
  // Defensive on purpose. Every block here gets arithmetic done on its start and
  // end, so one malformed entry used to throw during render and take the whole
  // page down. The API sanitises too; this is the second lock on the same door.
  const blocks: Block[] = useMemo(() => {
    const raw = (plan?.blocks as Block[] | null) ?? [];
    return Array.isArray(raw) ? raw.filter(isRenderableBlock) : [];
  }, [plan?.blocks]);

  const [energy, setEnergy] = useState<number | null>(plan?.energy ?? null);
  const [hours, setHours] = useState<string>(String(plan?.availableHours ?? 6));
  const [mood, setMood] = useState(plan?.mood ?? "");
  const [mustDo, setMustDo] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [nudge, setNudge] = useState<string | null>(null);
  const [decision, setDecision] = useState<{ options: string[]; pick: string; because: string; ifStuck: string } | null>(
    null
  );
  const [question, setQuestion] = useState("");

  const [compressed, setCompressed] = useState<{ summary: string; dropped: number } | null>(null);

  const [reflection, setReflection] = useState(plan?.reflection ?? "");
  const [wins, setWins] = useState(plan?.wins ?? "");
  const [friction, setFriction] = useState(plan?.friction ?? "");
  const [score, setScore] = useState<number | null>(plan?.scoreOutOf5 ?? null);

  const nowMins = useMemo(() => {
    const [h, m] = String(state.now ?? "").split(":").map(Number);
    return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
  }, [state.now]);

  const toMins = (t: string) => {
    const [h, m] = String(t ?? "").split(":").map(Number);
    return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
  };

  const currentIdx = blocks.findIndex((b) => toMins(b.start) <= nowMins && nowMins < toMins(b.end));
  const doneCount = blocks.filter((b) => b.done).length;
  const isEvening = nowMins >= 18 * 60;

  async function generate() {
    if (!energy) {
      setError("Pick an energy level first — the plan is built around it.");
      return;
    }
    setBusy("plan");
    setError(null);
    try {
      await api("/day", {
        method: "POST",
        body: {
          energy,
          availableHours: Number(hours) || 6,
          mood: mood || undefined,
          mustDo: mustDo || undefined,
        },
      });
      await api("/checkin", { body: { kind: "energy", value: energy, note: mood || null } });
      refresh();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  }

  async function toggleBlock(i: number) {
    const next = blocks.map((b, idx) => (idx === i ? { ...b, done: !b.done } : b));
    setBusy(`block-${i}`);
    try {
      await api("/day", { method: "PATCH", body: { blocks: next } });
      refresh();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  }

  async function unstick() {
    setBusy("nudge");
    setError(null);
    setNudge(null);
    try {
      const out = await api<{ text: string }>("/coach", {
        body: { action: "motivate", situation: mustDo || undefined },
      });
      setNudge(out.text);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  }

  async function decide() {
    if (!question.trim()) return;
    setBusy("decide");
    setError(null);
    setDecision(null);
    try {
      setDecision(await api("/coach", { body: { action: "decide", question: question.trim() } }));
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  }

  async function saveReflection() {
    setBusy("reflect");
    try {
      await api("/day", {
        method: "PATCH",
        body: {
          reflection: reflection || null,
          wins: wins || null,
          friction: friction || null,
          scoreOutOf5: score ?? null,
        },
      });
      refresh();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  }

  // 4.2 — rescue a day that's run away, without asking the model to re-plan.
  async function compress() {
    setBusy("compress");
    setError(null);
    try {
      const out = await api<{ summary: string; dropped: unknown[] }>("/day/compress", { body: {} });
      setCompressed({ summary: out.summary, dropped: out.dropped?.length ?? 0 });
      refresh();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  }

  async function startTask(taskId: string) {
    try {
      await api(`/tasks/${taskId}`, { method: "PATCH", body: { status: "doing" } });
      refresh();
    } catch (e) {
      setError(errMsg(e));
    }
  }

  async function quickCheckin(kind: "energy" | "overstim" | "hunger", value: number) {
    try {
      await api("/checkin", { body: { kind, value } });
      refresh();
    } catch {
      /* a missed check-in is not worth an error banner */
    }
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        {state.momentum && <MomentumCard momentum={state.momentum} />}
        {state.timeDebt && <TimeDebtCard debt={state.timeDebt} onStart={startTask} />}
      </div>

      {/* 4.2 Offered only when the plan has visibly stopped matching reality —
          a permanent "rescue the day" button would just read as an accusation. */}
      {state.planStale && (
        <Panel className="p-4" glow>
          <div className="flex flex-wrap items-center gap-3">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 text-[#ff8f5f]" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white">The plan has drifted</p>
              <p className="mt-0.5 text-xs leading-snug text-slate-400">
                Blocks came and went untouched. Squeeze what&apos;s left into the time you actually have — same order,
                shorter, nothing moved into the past.
              </p>
            </div>
            <Btn variant="flame" size="sm" loading={busy === "compress"} onClick={compress}>
              <Shrink className="h-3.5 w-3.5" />
              Rescue the day
            </Btn>
          </div>
          {compressed && (
            <p className="mt-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-xs leading-snug text-slate-300">
              {compressed.summary}
              {compressed.dropped > 0 && " Dropped work went back to your task list, not the bin."}
            </p>
          )}
        </Panel>
      )}

      {/* Plan builder */}
      <Panel className="p-5" glow={!plan}>
        <SectionTitle right={plan ? <Pill tone="green">{doneCount}/{blocks.length} done</Pill> : undefined}>
          {plan ? "Rebuild today" : "Build today"}
        </SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Energy right now" hint="Honest, not aspirational. Low energy gets a shorter, kinder day.">
            <Scale value={energy} onChange={setEnergy} labels={["Running on fumes", "Sharp"]} />
          </Field>
          <div className="space-y-3">
            <Field label="Hours you actually have">
              <input
                className={inputClass}
                type="number"
                min={0.5}
                max={18}
                step={0.5}
                value={hours}
                onChange={(e) => setHours(e.target.value)}
              />
            </Field>
            <Field label="Mood in a few words">
              <input
                className={inputClass}
                value={mood}
                onChange={(e) => setMood(e.target.value)}
                placeholder="wired but scattered"
              />
            </Field>
          </div>
        </div>
        <div className="mt-4">
          <Field label="One thing that must happen today" hint="Leave blank and Navigator picks from your open tasks.">
            <input
              className={inputClass}
              value={mustDo}
              onChange={(e) => setMustDo(e.target.value)}
              placeholder="Ship the Navigator page"
            />
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Btn variant="flame" loading={busy === "plan"} onClick={generate}>
            <Sparkles className="h-4 w-4" />
            {plan ? "Rebuild the day" : "Build my day"}
          </Btn>
          <Btn variant="ghost" loading={busy === "nudge"} onClick={unstick}>
            <Wand2 className="h-4 w-4" />
            Unstick me
          </Btn>
        </div>
        {nudge && (
          <div className="mt-4 rounded-xl border border-[#ff6b35]/30 bg-[#ff6b35]/10 px-4 py-3 text-sm leading-relaxed text-[#ffd0ba]">
            {nudge}
          </div>
        )}
      </Panel>

      {/* Anchor */}
      {plan?.anchor && (
        <Panel className="overflow-hidden p-0" glow>
          <div className="flex items-start gap-4 bg-gradient-to-r from-[#ff6b35]/15 to-transparent p-5">
            <Anchor className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#ff8f5f]" />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#ffb08a]">
                Today&apos;s anchor
              </p>
              <p className="mt-1 text-lg font-bold leading-snug text-white">{plan.anchor}</p>
              {plan.focusTheme && <p className="mt-1 text-sm text-slate-400">Theme: {plan.focusTheme}</p>}
            </div>
          </div>
        </Panel>
      )}

      {/* Blocks */}
      <Panel className="p-5">
        <SectionTitle>The shape of today</SectionTitle>
        {blocks.length === 0 ? (
          <Empty>No plan yet. Set your energy above and Navigator will lay the day out.</Empty>
        ) : (
          <ol className="space-y-2">
            {blocks.map((b, i) => {
              const past = toMins(b.end) <= nowMins;
              const current = i === currentIdx;
              return (
                <li
                  key={`${b.start}-${i}`}
                  className={`flex items-start gap-3 rounded-xl border px-3.5 py-3 transition-all ${
                    current
                      ? "border-[#ff6b35]/45 bg-[#ff6b35]/[0.09]"
                      : b.done
                        ? "border-emerald-400/20 bg-emerald-500/[0.06]"
                        : past
                          ? "border-white/[0.06] bg-white/[0.015] opacity-60"
                          : "border-white/[0.08] bg-white/[0.03]"
                  }`}
                >
                  <button
                    onClick={() => toggleBlock(i)}
                    disabled={busy === `block-${i}`}
                    className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg border transition ${
                      b.done
                        ? "border-transparent bg-emerald-500 text-white"
                        : "border-white/20 text-transparent hover:border-[#ff6b35] hover:text-[#ff6b35]/60"
                    }`}
                    aria-label="Toggle block"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-slate-400">
                        {b.start}–{b.end}
                      </span>
                      <Pill tone={KIND_TONE[b.kind] ?? "slate"}>{b.kind}</Pill>
                      {current && <Pill tone="flame">Now</Pill>}
                    </div>
                    <p className={`mt-1 font-semibold leading-snug ${b.done ? "text-slate-400 line-through" : "text-white"}`}>
                      {b.label}
                    </p>
                    {b.why && <p className="mt-0.5 text-xs text-slate-500">{b.why}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </Panel>

      {/* 6.3 */}
      {state.rituals?.length > 0 && (
        <RitualsCard
          rituals={state.rituals}
          logs={state.ritualLogs ?? []}
          current={state.currentRitual}
          refresh={refresh}
        />
      )}

      {/* 5.2 */}
      <NudgeFeed nudges={state.recentNudges ?? []} snoozes={state.snoozes ?? []} refresh={refresh} />

      {/* Quick check-ins */}
      <Panel className="p-5">
        <SectionTitle>Quick check-in</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-3">
          {(
            [
              ["energy", "Energy", ["Empty", "Full"]],
              ["overstim", "Overstimulation", ["Calm", "Fried"]],
              ["hunger", "Hunger", ["Fine", "Starving"]],
            ] as const
          ).map(([kind, label, l]) => (
            <Field key={kind} label={label}>
              <Scale value={null} onChange={(v) => quickCheckin(kind, v)} labels={l as [string, string]} />
            </Field>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-slate-500">
          Tapping logs it instantly — this is what the weekly pattern review reads.
        </p>
      </Panel>

      {/* Decide for me */}
      <Panel className="p-5">
        <SectionTitle>Decide for me</SectionTitle>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className={inputClass}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && decide()}
            placeholder="Rota rewrite or the outreach emails first?"
          />
          <Btn variant="ghost" loading={busy === "decide"} onClick={decide} className="sm:w-auto">
            <Split className="h-4 w-4" />
            Choose
          </Btn>
        </div>
        {decision && (
          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-[#ff6b35]/30 bg-[#ff6b35]/10 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#ffb08a]">Do this</p>
              <p className="mt-1 font-bold text-white">{decision.pick}</p>
              <p className="mt-1 text-sm text-slate-300">{decision.because}</p>
            </div>
            <ul className="space-y-1.5 text-sm text-slate-400">
              {decision.options.map((o) => (
                <li key={o} className="flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-slate-500" />
                  {o}
                </li>
              ))}
            </ul>
            <p className="flex items-start gap-2 text-xs text-slate-500">
              <HelpCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
              {decision.ifStuck}
            </p>
          </div>
        )}
      </Panel>

      {/* Evening reflection */}
      <Panel className="p-5">
        <SectionTitle right={isEvening ? <Pill tone="violet">Good time for this</Pill> : undefined}>
          <span className="inline-flex items-center gap-2">
            <Moon className="h-3.5 w-3.5" /> Close the day
          </span>
        </SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="What actually went well">
            <textarea className={`${inputClass} min-h-[90px]`} value={wins} onChange={(e) => setWins(e.target.value)} />
          </Field>
          <Field label="Where it stalled">
            <textarea
              className={`${inputClass} min-h-[90px]`}
              value={friction}
              onChange={(e) => setFriction(e.target.value)}
            />
          </Field>
        </div>
        <div className="mt-4 space-y-4">
          <Field label="Anything else worth remembering">
            <textarea
              className={`${inputClass} min-h-[70px]`}
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
            />
          </Field>
          <Field label="Rate the day">
            <Scale value={score} onChange={setScore} labels={["Rough", "Strong"]} />
          </Field>
        </div>
        <Btn variant="flame" className="mt-4" loading={busy === "reflect"} onClick={saveReflection}>
          Save reflection
        </Btn>
      </Panel>
    </div>
  );
}
