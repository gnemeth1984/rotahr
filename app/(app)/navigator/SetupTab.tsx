"use client";

import { useState } from "react";
import { Check, Save } from "lucide-react";
import { NavProfile, NavState, WeekdayKey, WeekPattern, DayWindow } from "./types";
import { api, errMsg } from "./api";
import { Btn, Field, Panel, SectionTitle, inputClass } from "./nav-ui";

const TIMEZONES = [
  "Europe/Dublin",
  "Europe/London",
  "Europe/Budapest",
  "Europe/Lisbon",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "UTC",
];

const DAYS: { key: WeekdayKey; label: string }[] = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" },
];

const NUDGE_KINDS: { key: keyof NavProfile; label: string; hint: string }[] = [
  {
    key: "notifyBlocks",
    label: "Next block starting",
    hint: "The backbone — tells you what you're doing next, just before it starts.",
  },
  {
    key: "notifyErrands",
    label: "Small stuff you keep skipping",
    hint: "Passport paperwork, checking a delivery, ordering shoes. Surfaced one at a time in real free gaps, oldest first.",
  },
  { key: "notifyDueToday", label: "Due today", hint: "One summary in the morning, not a running commentary." },
  { key: "notifyOverdue", label: "Overdue", hint: "Max two a day, oldest first." },
  { key: "notifyStuck", label: "Stuck in progress", hint: "Started over two days ago and hasn't moved." },
  { key: "notifyIdle", label: "No plan yet", hint: "A prod when the day is free and nothing's been laid out." },
  { key: "notifyEvening", label: "Close the day", hint: "A reflection prompt 45 min before quiet hours." },
  {
    key: "notifyDuringShift",
    label: "Allow nudges during a shift",
    hint: "Off by default — you're at work and can't act on them.",
  },
];

// inputClass is w-full; strip it so day rows can size their own cells.
const cellInput = inputClass.replace("w-full ", "");

export function SetupTab({ state, refresh }: { state: NavState; refresh: () => void }) {
  const [p, setP] = useState<NavProfile>(state.profile);
  const [week, setWeek] = useState<WeekPattern>(() => {
    const raw = (state.profile.weekPattern ?? null) as WeekPattern | null;
    if (raw) return raw;
    // No pattern yet — seed every day from the flat window so editing is obvious.
    const seeded: WeekPattern = {};
    for (const d of DAYS) seeded[d.key] = { start: state.profile.workStart, end: state.profile.workEnd };
    return seeded;
  });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  async function sendTestNudge() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/navigator/test-nudge", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed");
      // Phone push and the in-app bell fail independently, so report both.
      setTestResult(`Bell: sent. Phone push: ${data.push}`);
    } catch (e) {
      setTestResult(e instanceof Error ? e.message : "Failed to send");
    } finally {
      setTesting(false);
    }
  }

  function set<K extends keyof NavProfile>(key: K, value: NavProfile[K]) {
    setP((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  function setDay(day: WeekdayKey, value: DayWindow) {
    setWeek((prev) => ({ ...prev, [day]: value }));
    setSaved(false);
  }

  function copyDown(day: WeekdayKey) {
    const src = week[day] ?? null;
    const idx = DAYS.findIndex((d) => d.key === day);
    setWeek((prev) => {
      const next = { ...prev };
      for (const d of DAYS.slice(idx + 1)) next[d.key] = src ? { ...src } : null;
      return next;
    });
    setSaved(false);
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api("/profile", {
        method: "PUT",
        body: {
          wakeTime: p.wakeTime,
          sleepTime: p.sleepTime,
          workStart: p.workStart,
          workEnd: p.workEnd,
          weekPattern: week,
          energyPattern: p.energyPattern || null,
          timezone: p.timezone,
          dietary: p.dietary || null,
          kitchen: p.kitchen || null,
          exercise: p.exercise || null,
          derailers: p.derailers || null,
          goals: p.goals || null,
          focusMins: Number(p.focusMins) || 50,
          breakMins: Number(p.breakMins) || 10,
          notifyEnabled: p.notifyEnabled,
          notifyLeadMins: Number(p.notifyLeadMins) || 0,
          notifyBlocks: p.notifyBlocks,
          notifyDueToday: p.notifyDueToday,
          notifyOverdue: p.notifyOverdue,
          notifyErrands: p.notifyErrands,
          notifyStuck: p.notifyStuck,
          notifyIdle: p.notifyIdle,
          notifyEvening: p.notifyEvening,
          notifyDuringShift: p.notifyDuringShift,
          quietStart: p.quietStart,
          quietEnd: p.quietEnd,
          onboarded: true,
        },
      });
      setSaved(true);
      refresh();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>
      )}

      <Panel className="p-5">
        <SectionTitle>The shape of your days</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Wake">
            <input className={inputClass} type="time" value={p.wakeTime} onChange={(e) => set("wakeTime", e.target.value)} />
          </Field>
          <Field label="Sleep">
            <input
              className={inputClass}
              type="time"
              value={p.sleepTime}
              onChange={(e) => set("sleepTime", e.target.value)}
            />
          </Field>
          <Field label="Default work start" hint="Used only for days with no pattern set.">
            <input
              className={inputClass}
              type="time"
              value={p.workStart}
              onChange={(e) => set("workStart", e.target.value)}
            />
          </Field>
          <Field label="Default work end">
            <input className={inputClass} type="time" value={p.workEnd} onChange={(e) => set("workEnd", e.target.value)} />
          </Field>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Field label="Timezone">
            <select className={inputClass} value={p.timezone} onChange={(e) => set("timezone", e.target.value)}>
              {(TIMEZONES.includes(p.timezone) ? TIMEZONES : [p.timezone, ...TIMEZONES]).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Focus block (mins)" hint="Your realistic ceiling, not your best-ever day.">
            <input
              className={inputClass}
              type="number"
              min={10}
              max={180}
              value={p.focusMins}
              onChange={(e) => set("focusMins", Number(e.target.value))}
            />
          </Field>
          <Field label="Break (mins)">
            <input
              className={inputClass}
              type="number"
              min={2}
              max={60}
              value={p.breakMins}
              onChange={(e) => set("breakMins", Number(e.target.value))}
            />
          </Field>
        </div>
      </Panel>

      <Panel className="p-5">
        <SectionTitle>Your actual week</SectionTitle>
        <p className="mb-4 text-sm text-slate-400">
          Shifts are treated as immovable. Navigator plans around them instead of pretending every day is the same —
          switch a day off and it becomes rest, not a work day.
        </p>
        <div className="space-y-2">
          {DAYS.map(({ key, label }) => {
            const w = week[key] ?? null;
            const working = w !== null;
            return (
              <div
                key={key}
                className="flex flex-nowrap items-center gap-2 overflow-x-auto rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2"
              >
                <span className="w-[86px] shrink-0 text-sm font-medium text-slate-200">{label}</span>

                <button
                  type="button"
                  onClick={() => setDay(key, working ? null : { start: p.workStart, end: p.workEnd })}
                  className={`w-[72px] shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                    working
                      ? "bg-gradient-to-r from-[#ff6b35] to-[#e8365d] text-white"
                      : "border border-white/15 bg-white/5 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {working ? "Working" : "Day off"}
                </button>

                {working ? (
                  <>
                    <input
                      className={`${cellInput} w-[118px] shrink-0 px-2.5 py-1.5`}
                      type="time"
                      value={w!.start}
                      onChange={(e) => setDay(key, { ...w!, start: e.target.value })}
                    />
                    <span className="shrink-0 text-xs text-slate-500">to</span>
                    <input
                      className={`${cellInput} w-[118px] shrink-0 px-2.5 py-1.5`}
                      type="time"
                      value={w!.end}
                      onChange={(e) => setDay(key, { ...w!, end: e.target.value })}
                    />
                    <input
                      className={`${cellInput} min-w-[120px] flex-1 px-2.5 py-1.5`}
                      placeholder="note (optional) — e.g. split shift, early prep"
                      value={w!.note ?? ""}
                      onChange={(e) => setDay(key, { ...w!, note: e.target.value })}
                    />
                  </>
                ) : (
                  <span className="flex-1 truncate text-sm text-slate-500">
                    No shift — rest, family, garden, optional project time.
                  </span>
                )}

                {key !== "sun" && (
                  <button
                    type="button"
                    onClick={() => copyDown(key)}
                    className="shrink-0 rounded-lg border border-white/10 px-2 py-1 text-xs text-slate-400 transition hover:text-slate-200"
                    title="Copy this day to all days below"
                  >
                    copy ↓
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel className="p-5">
        <SectionTitle>Nudges</SectionTitle>
        <p className="mb-4 text-sm text-slate-400">
          Reminders land in the Rotahr bell and on your phone once push is enabled. Nothing is ever sent
          during a shift, or between your quiet hours below.
        </p>

        <label className="mb-4 flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[#ff6b35]"
            checked={p.notifyEnabled}
            onChange={(e) => set("notifyEnabled", e.target.checked)}
          />
          <span className="text-sm font-semibold text-white">Nudges on</span>
        </label>

        <div className={p.notifyEnabled ? "" : "pointer-events-none opacity-40"}>
          <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Warning before a block" hint="Minutes of head-start.">
              <input
                className={inputClass}
                type="number"
                min={0}
                max={60}
                value={p.notifyLeadMins}
                onChange={(e) => set("notifyLeadMins", Number(e.target.value))}
              />
            </Field>
            <Field label="Quiet from">
              <input
                className={inputClass}
                type="time"
                value={p.quietStart}
                onChange={(e) => set("quietStart", e.target.value)}
              />
            </Field>
            <Field label="Quiet until">
              <input
                className={inputClass}
                type="time"
                value={p.quietEnd}
                onChange={(e) => set("quietEnd", e.target.value)}
              />
            </Field>
          </div>

          <div className="space-y-1">
            {NUDGE_KINDS.map((n) => (
              <label
                key={n.key}
                className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2 hover:bg-white/5"
              >
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[#ff6b35]"
                  checked={Boolean(p[n.key])}
                  onChange={(e) => set(n.key, e.target.checked as never)}
                />
                <span>
                  <span className="block text-sm font-medium text-white">{n.label}</span>
                  <span className="block text-xs text-slate-400">{n.hint}</span>
                </span>
              </label>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-white/10 pt-4">
            <button
              type="button"
              onClick={sendTestNudge}
              disabled={testing}
              className="rounded-lg border border-white/15 px-3 py-2 text-sm font-medium text-white transition hover:border-[#ff6b35] hover:text-[#ff6b35] disabled:opacity-50"
            >
              {testing ? "Sending..." : "Send a test nudge now"}
            </button>
            {testResult && <span className="text-xs text-slate-300">{testResult}</span>}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Nudges are checked every 5 minutes between 06:00 and 22:00. Nothing fires during a
            shift or inside your quiet hours, so a silent morning before 07:00 is working as
            intended.
          </p>
        </div>
      </Panel>

      <Panel className="p-5">
        <SectionTitle>What Navigator needs to know</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Food — likes, dislikes, restrictions" hint="Be blunt. Foods you'll never eat, safe foods you always will.">
            <textarea
              className={`${inputClass} min-h-[100px]`}
              value={p.dietary ?? ""}
              onChange={(e) => set("dietary", e.target.value)}
              placeholder="High protein. Hate mushrooms. Always have eggs, rice, chicken in."
            />
          </Field>
          <Field label="Kitchen & shopping reality" hint="Equipment, time, how often you shop.">
            <textarea
              className={`${inputClass} min-h-[100px]`}
              value={p.kitchen ?? ""}
              onChange={(e) => set("kitchen", e.target.value)}
              placeholder="Air fryer, hob, no time to shop midweek. Big shop Sundays."
            />
          </Field>
          <Field label="Movement — what you'll actually do" hint="Equipment, injuries, what you hate.">
            <textarea
              className={`${inputClass} min-h-[100px]`}
              value={p.exercise ?? ""}
              onChange={(e) => set("exercise", e.target.value)}
              placeholder="Home only, kettlebell. Bad knee. Won't run."
            />
          </Field>
          <Field label="What derails you" hint="This is the most useful box on the page — it shapes every plan.">
            <textarea
              className={`${inputClass} min-h-[100px]`}
              value={p.derailers ?? ""}
              onChange={(e) => set("derailers", e.target.value)}
              placeholder="Phone in the morning. Starting admin before deep work. Skipping lunch then crashing at 3."
            />
          </Field>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field
            label="Your energy through the day"
            hint="When you're sharp, when you dip, caffeine cut-off. Hard work gets placed in your peaks."
          >
            <textarea
              className={`${inputClass} min-h-[100px]`}
              value={p.energyPattern ?? ""}
              onChange={(e) => set("energyPattern", e.target.value)}
              placeholder="Sharp around 11. Dips through the afternoon, picks up when it gets busy. Coffee only before 2pm."
            />
          </Field>
          <Field label="What you're actually working towards" hint="Next 90 days, in your own words.">
            <textarea
              className={`${inputClass} min-h-[100px]`}
              value={p.goals ?? ""}
              onChange={(e) => set("goals", e.target.value)}
              placeholder="Get Rotahr to 20 paying venues. Train 3x a week. Stop working past 8pm."
            />
          </Field>
        </div>
      </Panel>

      <div className="flex items-center gap-3">
        <Btn variant="flame" loading={busy} onClick={save}>
          <Save className="h-4 w-4" />
          Save setup
        </Btn>
        {saved && (
          <span className="inline-flex items-center gap-1.5 text-sm text-emerald-300">
            <Check className="h-4 w-4" />
            Saved — plans will use this from now on.
          </span>
        )}
      </div>
    </div>
  );
}
