"use client";

import { useState } from "react";
import { Check, Plus, ShoppingBasket, Sparkles, Trash2, Utensils } from "lucide-react";
import { GroceryItem, NavState } from "./types";
import { api, errMsg } from "./api";
import { Btn, Empty, Field, Panel, Pill, SectionTitle, inputClass } from "./nav-ui";

const SLOT_ORDER = ["breakfast", "lunch", "dinner", "snack"];

export function FoodTab({ state, refresh }: { state: NavState; refresh: () => void }) {
  const [maxPrep, setMaxPrep] = useState("20");
  const [mode, setMode] = useState<"day" | "week">("day");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shortcut, setShortcut] = useState<string | null>(null);
  const [manual, setManual] = useState({ slot: "dinner", title: "", prepMins: "10" });
  const [item, setItem] = useState("");

  const meals = [...state.meals].sort(
    (a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot)
  );

  async function generate() {
    setBusy("gen");
    setError(null);
    setShortcut(null);
    try {
      const out = await api<{ shortcut?: string }>("/meals", {
        body: { action: "generate", mode, maxPrepMins: Number(maxPrep) || 20 },
      });
      if (out.shortcut) setShortcut(out.shortcut);
      refresh();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  }

  async function addMeal() {
    if (!manual.title.trim()) return;
    setBusy("addmeal");
    try {
      await api("/meals", {
        body: {
          action: "add",
          slot: manual.slot,
          title: manual.title.trim(),
          prepMins: Number(manual.prepMins) || 10,
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

  async function toggleMeal(id: string, eaten: boolean) {
    setBusy(id);
    try {
      await api(`/meals/${id}`, { method: "PATCH", body: { eaten } });
      refresh();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  }

  async function deleteMeal(id: string) {
    setBusy(id);
    try {
      await api(`/meals/${id}`, { method: "DELETE" });
      refresh();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  }

  async function addGrocery() {
    if (!item.trim()) return;
    setBusy("grocery");
    try {
      await api("/grocery", { body: { items: [{ name: item.trim(), category: "other" }] } });
      setItem("");
      refresh();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  }

  async function toggleGrocery(g: GroceryItem) {
    try {
      await api("/grocery", { method: "PATCH", body: { id: g.id, checked: !g.checked } });
      refresh();
    } catch (e) {
      setError(errMsg(e));
    }
  }

  async function clearChecked() {
    setBusy("clear");
    try {
      await api("/grocery?checked=1", { method: "DELETE" });
      refresh();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  }

  const grouped = state.grocery.reduce<Record<string, GroceryItem[]>>((acc, g) => {
    (acc[g.category] ??= []).push(g);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>
      )}

      <Panel className="p-5" glow={meals.length === 0}>
        <SectionTitle>Decide the food so you don&apos;t have to</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-[auto_auto_1fr]">
          <Field label="Plan for">
            <select className={inputClass} value={mode} onChange={(e) => setMode(e.target.value as "day" | "week")}>
              <option value="day">Today</option>
              <option value="week">Next 7 days</option>
            </select>
          </Field>
          <Field label="Max prep (mins)">
            <input
              className={`${inputClass} sm:w-28`}
              type="number"
              min={2}
              max={120}
              value={maxPrep}
              onChange={(e) => setMaxPrep(e.target.value)}
            />
          </Field>
          <div className="flex items-end">
            <Btn variant="flame" loading={busy === "gen"} onClick={generate}>
              <Sparkles className="h-4 w-4" />
              Plan my food
            </Btn>
          </div>
        </div>
        {shortcut && (
          <div className="mt-4 rounded-xl border border-[#ff6b35]/30 bg-[#ff6b35]/10 px-4 py-3 text-sm text-[#ffd0ba]">
            <span className="font-semibold">Zero-effort backup: </span>
            {shortcut}
          </div>
        )}
      </Panel>

      <Panel className="p-5">
        <SectionTitle right={<Pill tone="slate">{state.today}</Pill>}>
          <span className="inline-flex items-center gap-2">
            <Utensils className="h-3.5 w-3.5" /> Today&apos;s meals
          </span>
        </SectionTitle>
        {meals.length === 0 ? (
          <Empty>Nothing planned. Generate above, or add one below.</Empty>
        ) : (
          <ul className="space-y-2">
            {meals.map((m) => (
              <li
                key={m.id}
                className={`flex items-start gap-3 rounded-xl border px-3.5 py-3 ${
                  m.eaten ? "border-emerald-400/20 bg-emerald-500/[0.06]" : "border-white/[0.08] bg-white/[0.03]"
                }`}
              >
                <button
                  onClick={() => toggleMeal(m.id, !m.eaten)}
                  disabled={busy === m.id}
                  className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg border transition ${
                    m.eaten
                      ? "border-transparent bg-emerald-500 text-white"
                      : "border-white/20 text-transparent hover:border-[#ff6b35]"
                  }`}
                  aria-label="Mark eaten"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone="green">{m.slot}</Pill>
                    <Pill tone="slate">{m.prepMins}m prep</Pill>
                    {m.protein ? <Pill tone="blue">{m.protein}g protein</Pill> : null}
                  </div>
                  <p className={`mt-1 font-semibold ${m.eaten ? "text-slate-400 line-through" : "text-white"}`}>
                    {m.title}
                  </p>
                  {m.ingredients && m.ingredients.length > 0 && (
                    <p className="mt-0.5 text-xs text-slate-500">{m.ingredients.join(" · ")}</p>
                  )}
                  {m.notes && <p className="mt-0.5 text-xs text-slate-500">{m.notes}</p>}
                </div>
                <button
                  onClick={() => deleteMeal(m.id)}
                  className="text-slate-600 transition hover:text-rose-300"
                  aria-label="Delete meal"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 grid gap-3 border-t border-white/[0.06] pt-4 sm:grid-cols-[auto_1fr_auto_auto]">
          <select
            className={inputClass}
            value={manual.slot}
            onChange={(e) => setManual({ ...manual, slot: e.target.value })}
          >
            {SLOT_ORDER.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <input
            className={inputClass}
            value={manual.title}
            onChange={(e) => setManual({ ...manual, title: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && addMeal()}
            placeholder="What you actually ate or plan to"
          />
          <input
            className={`${inputClass} sm:w-24`}
            type="number"
            min={0}
            value={manual.prepMins}
            onChange={(e) => setManual({ ...manual, prepMins: e.target.value })}
          />
          <Btn variant="ghost" loading={busy === "addmeal"} onClick={addMeal}>
            <Plus className="h-4 w-4" />
            Add
          </Btn>
        </div>
      </Panel>

      <Panel className="p-5">
        <SectionTitle
          right={
            state.grocery.some((g) => g.checked) ? (
              <Btn size="sm" variant="quiet" loading={busy === "clear"} onClick={clearChecked}>
                Clear ticked
              </Btn>
            ) : undefined
          }
        >
          <span className="inline-flex items-center gap-2">
            <ShoppingBasket className="h-3.5 w-3.5" /> Shopping list
          </span>
        </SectionTitle>

        <div className="mb-4 flex gap-2">
          <input
            className={inputClass}
            value={item}
            onChange={(e) => setItem(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addGrocery()}
            placeholder="Add an item"
          />
          <Btn variant="ghost" loading={busy === "grocery"} onClick={addGrocery}>
            <Plus className="h-4 w-4" />
          </Btn>
        </div>

        {state.grocery.length === 0 ? (
          <Empty>Empty list. Meal plans fill this automatically.</Empty>
        ) : (
          <div className="space-y-4">
            {Object.entries(grouped).map(([cat, items]) => (
              <div key={cat}>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{cat}</p>
                <ul className="space-y-1">
                  {items.map((g) => (
                    <li key={g.id}>
                      <button
                        onClick={() => toggleGrocery(g)}
                        className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition hover:bg-white/[0.05]"
                      >
                        <span
                          className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${
                            g.checked ? "border-transparent bg-emerald-500 text-white" : "border-white/25 text-transparent"
                          }`}
                        >
                          <Check className="h-2.5 w-2.5" />
                        </span>
                        <span className={`text-sm ${g.checked ? "text-slate-500 line-through" : "text-slate-100"}`}>
                          {g.name}
                          {g.qty ? <span className="ml-1.5 text-xs text-slate-500">{g.qty}</span> : null}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
