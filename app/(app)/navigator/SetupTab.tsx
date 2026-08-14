"use client";

import { useState } from "react";
import { Check, Save } from "lucide-react";
import { NavProfile, NavState } from "./types";
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

export function SetupTab({ state, refresh }: { state: NavState; refresh: () => void }) {
  const [p, setP] = useState<NavProfile>(state.profile);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof NavProfile>(key: K, value: NavProfile[K]) {
    setP((prev) => ({ ...prev, [key]: value }));
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
          timezone: p.timezone,
          dietary: p.dietary || null,
          kitchen: p.kitchen || null,
          exercise: p.exercise || null,
          derailers: p.derailers || null,
          goals: p.goals || null,
          focusMins: Number(p.focusMins) || 50,
          breakMins: Number(p.breakMins) || 10,
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
          <Field label="Work starts">
            <input
              className={inputClass}
              type="time"
              value={p.workStart}
              onChange={(e) => set("workStart", e.target.value)}
            />
          </Field>
          <Field label="Work ends">
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
        <div className="mt-4">
          <Field label="What you're actually working towards" hint="Next 90 days, in your own words.">
            <textarea
              className={`${inputClass} min-h-[80px]`}
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
