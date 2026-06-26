"use client";

import { useEffect, useState } from "react";
import { CalendarCheck, Save, Plus, Trash2, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const DAYS = [
  { label: "Monday", value: 1 },
  { label: "Tuesday", value: 2 },
  { label: "Wednesday", value: 3 },
  { label: "Thursday", value: 4 },
  { label: "Friday", value: 5 },
  { label: "Saturday", value: 6 },
  { label: "Sunday", value: 0 },
];

type DayPref = {
  dayOfWeek: number;
  available: boolean;
  fromTime: string;
  toTime: string;
  note: string;
};

type ExtraEntry = {
  id: string;
  date: string; // ISO string
  fromTime: string | null;
  toTime: string | null;
  note: string | null;
  employee?: { id: string; firstName: string; lastName: string };
};

function defaultPrefs(): DayPref[] {
  return DAYS.map((d) => ({
    dayOfWeek: d.value,
    available: true,
    fromTime: "09:00",
    toTime: "17:00",
    note: "",
  }));
}

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IE", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

export default function AvailabilityPage() {
  const [activeTab, setActiveTab] = useState<"weekly" | "extra">("weekly");

  // ── Weekly pattern state ──────────────────────────────────────────────────
  const [prefs, setPrefs] = useState<DayPref[]>(defaultPrefs());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  // ── Extra shifts state ────────────────────────────────────────────────────
  const [extraEntries, setExtraEntries] = useState<ExtraEntry[]>([]);
  const [extraLoading, setExtraLoading] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newFrom, setNewFrom] = useState("");
  const [newTo, setNewTo] = useState("");
  const [newNote, setNewNote] = useState("");
  const [adding, setAdding] = useState(false);
  const [deletingDate, setDeletingDate] = useState<string | null>(null);

  const todayStr = toDateStr(new Date());

  useEffect(() => {
    fetch("/api/availability")
      .then((r) => r.json())
      .then((d) => {
        if (d.prefs && d.prefs.length > 0) {
          const map: Record<number, any> = {};
          for (const p of d.prefs) map[p.dayOfWeek] = p;
          setPrefs(
            DAYS.map((day) =>
              map[day.value]
                ? {
                    dayOfWeek: day.value,
                    available: map[day.value].available,
                    fromTime: map[day.value].fromTime ?? "09:00",
                    toTime: map[day.value].toTime ?? "17:00",
                    note: map[day.value].note ?? "",
                  }
                : {
                    dayOfWeek: day.value,
                    available: true,
                    fromTime: "09:00",
                    toTime: "17:00",
                    note: "",
                  }
            )
          );
        }
        setLoading(false);
      });
  }, []);

  function fetchExtra() {
    setExtraLoading(true);
    // fetch from today onwards (90 days out)
    const from = todayStr;
    const toDate = new Date();
    toDate.setDate(toDate.getDate() + 90);
    const to = toDateStr(toDate);
    fetch(`/api/extra-availability?from=${from}&to=${to}`)
      .then((r) => r.json())
      .then((d) => setExtraEntries(d.entries ?? []))
      .finally(() => setExtraLoading(false));
  }

  useEffect(() => {
    if (activeTab === "extra") fetchExtra();
  }, [activeTab]);

  function update(dayOfWeek: number, field: keyof DayPref, value: any) {
    setPrefs((prev) =>
      prev.map((p) => (p.dayOfWeek === dayOfWeek ? { ...p, [field]: value } : p))
    );
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    await fetch("/api/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prefs }),
    });
    setSaving(false);
    setSaved(true);
  }

  async function addExtra() {
    if (!newDate) return;
    setAdding(true);
    await fetch("/api/extra-availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: newDate,
        fromTime: newFrom || null,
        toTime: newTo || null,
        note: newNote || null,
      }),
    });
    setNewDate("");
    setNewFrom("");
    setNewTo("");
    setNewNote("");
    setAdding(false);
    fetchExtra();
  }

  async function deleteExtra(dateIso: string) {
    // dateIso comes from the DB as full ISO — extract YYYY-MM-DD
    const dateStr = dateIso.split("T")[0];
    setDeletingDate(dateStr);
    await fetch(`/api/extra-availability?date=${dateStr}`, { method: "DELETE" });
    setDeletingDate(null);
    fetchExtra();
  }

  // Group entries by ISO week for readability
  function getWeekLabel(iso: string): string {
    const d = new Date(iso);
    const mon = new Date(d);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    mon.setDate(d.getDate() + diff);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    return `${mon.toLocaleDateString("en-IE", { day: "numeric", month: "short" })} – ${sun.toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" })}`;
  }

  // Group entries by week
  const groupedExtras: { weekLabel: string; entries: ExtraEntry[] }[] = [];
  for (const entry of extraEntries) {
    const label = getWeekLabel(entry.date);
    const existing = groupedExtras.find((g) => g.weekLabel === label);
    if (existing) existing.entries.push(entry);
    else groupedExtras.push({ weekLabel: label, entries: [entry] });
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <CalendarCheck className="h-6 w-6 text-blue-500" />
            Availability
          </h1>
          <p className="text-slate-500 mt-1">Manage your availability preferences</p>
        </div>
        {activeTab === "weekly" && (
          <Button onClick={save} disabled={saving} className="bg-blue-500 hover:bg-blue-600">
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving…" : saved ? "Saved ✓" : "Save"}
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setActiveTab("weekly")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "weekly"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Weekly Pattern
        </button>
        <button
          onClick={() => setActiveTab("extra")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "extra"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <CalendarDays className="h-3.5 w-3.5" />
          Extra Shifts
        </button>
      </div>

      {/* ── Tab: Weekly Pattern ── */}
      {activeTab === "weekly" && (
        <>
          {loading ? (
            <div className="text-center py-12 text-slate-400">Loading…</div>
          ) : (
            <div className="space-y-3">
              {DAYS.map((day) => {
                const pref = prefs.find((p) => p.dayOfWeek === day.value)!;
                return (
                  <div
                    key={day.value}
                    className={`bg-white rounded-xl border p-5 transition-all ${
                      pref.available ? "border-slate-200" : "border-slate-100 opacity-60"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <Label className="text-base font-semibold text-slate-900">
                        {day.label}
                      </Label>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-500">
                          {pref.available ? "Available" : "Unavailable"}
                        </span>
                        <Switch
                          checked={pref.available}
                          onCheckedChange={(v) => update(day.value, "available", v)}
                        />
                      </div>
                    </div>
                    {pref.available && (
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <Label className="text-xs text-slate-500 mb-1 block">From</Label>
                          <Input
                            type="time"
                            value={pref.fromTime}
                            onChange={(e) => update(day.value, "fromTime", e.target.value)}
                            className="w-full"
                          />
                        </div>
                        <div className="flex-1">
                          <Label className="text-xs text-slate-500 mb-1 block">To</Label>
                          <Input
                            type="time"
                            value={pref.toTime}
                            onChange={(e) => update(day.value, "toTime", e.target.value)}
                            className="w-full"
                          />
                        </div>
                        <div className="flex-1">
                          <Label className="text-xs text-slate-500 mb-1 block">Note</Label>
                          <Input
                            type="text"
                            value={pref.note}
                            onChange={(e) => update(day.value, "note", e.target.value)}
                            placeholder="Optional"
                            className="w-full"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── Tab: Extra Shifts ── */}
      {activeTab === "extra" && (
        <div className="space-y-5">
          {/* Info blurb */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
            <p className="text-sm text-emerald-800 font-medium">Volunteer for extra shifts</p>
            <p className="text-xs text-emerald-700 mt-0.5">
              Flag specific dates you're available to pick up extra work. Managers will see a green indicator on the rota for those days.
            </p>
          </div>

          {/* Add form */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <p className="text-sm font-semibold text-slate-700">Put my name down for a date</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-slate-500 mb-1 block">Date *</Label>
                <Input
                  type="date"
                  min={todayStr}
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full"
                />
              </div>
              <div>
                <Label className="text-xs text-slate-500 mb-1 block">Note (optional)</Label>
                <Input
                  type="text"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="e.g. Available after 2pm"
                  className="w-full"
                />
              </div>
              <div>
                <Label className="text-xs text-slate-500 mb-1 block">Available from (optional)</Label>
                <Input
                  type="time"
                  value={newFrom}
                  onChange={(e) => setNewFrom(e.target.value)}
                  className="w-full"
                />
              </div>
              <div>
                <Label className="text-xs text-slate-500 mb-1 block">Available until (optional)</Label>
                <Input
                  type="time"
                  value={newTo}
                  onChange={(e) => setNewTo(e.target.value)}
                  className="w-full"
                />
              </div>
            </div>
            <Button
              onClick={addExtra}
              disabled={!newDate || adding}
              className="bg-emerald-600 hover:bg-emerald-500 w-full sm:w-auto"
            >
              <Plus className="h-4 w-4 mr-2" />
              {adding ? "Adding…" : "Put my name down"}
            </Button>
          </div>

          {/* List */}
          {extraLoading ? (
            <div className="text-center py-8 text-slate-400 text-sm">Loading…</div>
          ) : groupedExtras.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <CalendarDays className="h-8 w-8 mx-auto mb-2 text-slate-300" />
              <p className="text-sm">No extra availability added yet.</p>
              <p className="text-xs mt-1">Pick a date above and put your name down.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {groupedExtras.map(({ weekLabel, entries }) => (
                <div key={weekLabel}>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 px-1">{weekLabel}</p>
                  <div className="space-y-2">
                    {entries.map((entry) => {
                      const dateKey = entry.date.split("T")[0];
                      return (
                        <div
                          key={entry.id}
                          className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3"
                        >
                          <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold text-emerald-700">
                              {new Date(entry.date).getDate()}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800">{fmtDate(entry.date)}</p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {entry.fromTime && entry.toTime
                                ? `${entry.fromTime} – ${entry.toTime}`
                                : entry.fromTime
                                ? `From ${entry.fromTime}`
                                : entry.toTime
                                ? `Until ${entry.toTime}`
                                : "Any time"}
                              {entry.note && ` · ${entry.note}`}
                            </p>
                          </div>
                          <button
                            onClick={() => deleteExtra(entry.date)}
                            disabled={deletingDate === dateKey}
                            className="p-1.5 text-slate-300 hover:text-red-400 transition-colors rounded-md hover:bg-red-50 flex-shrink-0"
                            title="Remove"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
