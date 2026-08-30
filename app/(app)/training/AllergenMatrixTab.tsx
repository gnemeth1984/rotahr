// @ts-nocheck
"use client";

/**
 * The allergen matrix. One row per active dish, one column per named allergen.
 *
 * A blank row is not a confirmed absence — that is why "Confirmed" is a separate
 * explicit act with a name and a timestamp against it, and why the course tests
 * that instinct rather than assuming a blank means safe.
 */

import { useEffect, useMemo, useState } from "react";
import {
  Utensils, Loader2, Check, AlertTriangle, Info, Search, Save, X,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function fmt(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-IE", { day: "2-digit", month: "short", year: "numeric" });
}

export default function AllergenMatrixTab({ canEdit }: { canEdit: boolean }) {
  const [allergens, setAllergens] = useState<any[]>([]);
  const [dishes, setDishes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [openHelp, setOpenHelp] = useState(false);
  const [dirty, setDirty] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch("/api/menu/dishes/allergens")
      .then((r) => r.json())
      .then((d) => {
        setAllergens(d.allergens ?? []);
        setDishes(d.dishes ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return dishes;
    return dishes.filter((d) => d.name?.toLowerCase().includes(s));
  }, [dishes, q]);

  const checkedCount = dishes.filter((d) => d.allergenCheckedAt).length;

  function toggle(dishId: string, field: string) {
    if (!canEdit) return;
    setDishes((prev) =>
      prev.map((d) => (d.id === dishId ? { ...d, [field]: !d[field] } : d))
    );
    setDirty((p) => ({ ...p, [dishId]: true }));
  }

  async function save(dish: any, confirm: boolean) {
    setSavingId(dish.id);
    const payload: any = { id: dish.id, confirm };
    for (const a of allergens) payload[a.field] = Boolean(dish[a.field]);
    try {
      const res = await fetch("/api/menu/dishes/allergens", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.dish) {
        setDishes((prev) => prev.map((d) => (d.id === data.dish.id ? data.dish : d)));
        setDirty((p) => { const n = { ...p }; delete n[dish.id]; return n; });
      }
    } finally {
      setSavingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        <strong className="text-slate-800">This is the source your allergen course reads.</strong>{" "}
        Tick what each dish <em>contains</em>, then press Confirm — that stamps who checked it and
        when. An unconfirmed row is treated as unknown, not as safe. The named list here is the
        14 used across the EU and UK; the US names 9 and Australia/New Zealand differs again, so
        check the rules that apply where you trade.
        <button
          onClick={() => setOpenHelp((v) => !v)}
          className="ml-1 font-medium text-slate-700 underline hover:text-slate-900"
        >
          {openHelp ? "Hide where they hide" : "Where they hide"}
        </button>
      </div>

      {openHelp && (
        <Card><CardContent className="p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {allergens.map((a) => (
              <div key={a.key} className="text-sm">
                <div className="font-medium text-slate-800">{a.label}</div>
                <div className="text-xs text-slate-500">{a.hides.slice(0, 4).join(" · ")}</div>
              </div>
            ))}
          </div>
        </CardContent></Card>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-56 flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search dishes..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <Badge variant="outline" className="bg-slate-50 text-slate-600">
          {checkedCount} of {dishes.length} dishes confirmed
        </Badge>
      </div>

      {dishes.length === 0 && (
        <Card><CardContent className="py-10 text-center">
          <Utensils className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 text-slate-600">No active dishes yet.</p>
          <p className="mt-1 text-sm text-slate-400">
            Add dishes under Menu, then come back and record their allergens.
          </p>
        </CardContent></Card>
      )}

      {dishes.length > 0 && (
        <Card><CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="sticky left-0 z-10 bg-slate-50 px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    Dish
                  </th>
                  {allergens.map((a) => (
                    <th
                      key={a.key}
                      title={`${a.label} — often hidden in: ${a.hides.slice(0, 3).join(", ")}`}
                      className="px-1 py-3 text-center text-[11px] font-medium text-slate-500"
                    >
                      <span className="block max-w-[52px] leading-tight">{a.label}</span>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    Confirmed
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => {
                  const isDirty = dirty[d.id];
                  return (
                    <tr key={d.id} className="border-b border-slate-100 last:border-0">
                      <td className="sticky left-0 z-10 bg-white px-4 py-2.5">
                        <div className="font-medium text-slate-800">{d.name}</div>
                        <div className="text-xs capitalize text-slate-400">{d.category}</div>
                      </td>
                      {allergens.map((a) => {
                        const on = Boolean(d[a.field]);
                        return (
                          <td key={a.key} className="px-1 py-2.5 text-center">
                            <button
                              disabled={!canEdit}
                              onClick={() => toggle(d.id, a.field)}
                              title={a.label}
                              className={cn(
                                "h-6 w-6 rounded border transition-colors",
                                on
                                  ? "border-red-300 bg-red-500 text-white"
                                  : "border-slate-200 bg-white hover:bg-slate-100",
                                !canEdit && "cursor-default opacity-70"
                              )}
                            >
                              {on && <Check className="mx-auto h-3.5 w-3.5" />}
                            </button>
                          </td>
                        );
                      })}
                      <td className="whitespace-nowrap px-4 py-2.5">
                        {canEdit ? (
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant={isDirty || !d.allergenCheckedAt ? "default" : "outline"}
                              disabled={savingId === d.id}
                              onClick={() => save(d, true)}
                            >
                              {savingId === d.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <>
                                  <Save className="mr-1.5 h-3.5 w-3.5" />
                                  {d.allergenCheckedAt ? "Re-confirm" : "Confirm"}
                                </>
                              )}
                            </Button>
                            {d.allergenCheckedAt ? (
                              <span className="text-xs text-slate-500">
                                {fmt(d.allergenCheckedAt)}
                                {d.allergenCheckedBy ? ` · ${d.allergenCheckedBy}` : ""}
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-xs text-amber-600">
                                <AlertTriangle className="h-3.5 w-3.5" /> unknown
                              </span>
                            )}
                          </div>
                        ) : d.allergenCheckedAt ? (
                          <span className="text-xs text-slate-500">{fmt(d.allergenCheckedAt)}</span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-amber-600">
                            <AlertTriangle className="h-3.5 w-3.5" /> unknown
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent></Card>
      )}

      <p className="flex items-start gap-2 text-xs text-slate-400">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Cross-contact risk is a kitchen-by-kitchen judgement: a shared fryer, one board, or a
        single tub of flour in the air can carry an allergen into a dish that never listed it.
        Record what you actually do, not what the recipe says.
      </p>
    </div>
  );
}
