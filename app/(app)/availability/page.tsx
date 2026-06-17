"use client";

import { useEffect, useState } from "react";
import { CalendarCheck, Save } from "lucide-react";
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

function defaultPrefs(): DayPref[] {
  return DAYS.map((d) => ({
    dayOfWeek: d.value,
    available: true,
    fromTime: "09:00",
    toTime: "17:00",
    note: "",
  }));
}

export default function AvailabilityPage() {
  const [prefs, setPrefs] = useState<DayPref[]>(defaultPrefs());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/availability")
      .then((r) => r.json())
      .then((d) => {
        if (d.prefs && d.prefs.length > 0) {
          // Merge fetched with defaults
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

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <CalendarCheck className="h-6 w-6 text-blue-500" />
            Availability
          </h1>
          <p className="text-slate-500 mt-1">Set your weekly availability preferences</p>
        </div>
        <Button onClick={save} disabled={saving} className="bg-blue-500 hover:bg-blue-600">
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Saving…" : saved ? "Saved ✓" : "Save"}
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading…</div>
      ) : (
        <div className="space-y-3">
          {DAYS.map((day, i) => {
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
    </div>
  );
}
