// @ts-nocheck
"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Brain,
  Users,
  CalendarRange,
  Megaphone,
  Loader2,
  CheckCircle2,
  ArrowLeft,
  Save,
} from "lucide-react";
import { UserRole as Role } from "@/types/roles";
import Link from "next/link";

interface AISettingsData {
  bookingThresholdForStaffIncrease: number;
  kitchenRatio: number;
  floorRatio: number;
  minBarStaff: number;
  rotaWarningDaysAhead: number;
  autoFlagShortStaffedShifts: boolean;
  minStaffPerShift: number;
  priceChangeNotifyScope: "managers" | "all_staff" | "none";
  priceChangeMessage: string | null;
}

const DEFAULTS: AISettingsData = {
  bookingThresholdForStaffIncrease: 20,
  kitchenRatio: 20,
  floorRatio: 15,
  minBarStaff: 1,
  rotaWarningDaysAhead: 3,
  autoFlagShortStaffedShifts: true,
  minStaffPerShift: 2,
  priceChangeNotifyScope: "managers",
  priceChangeMessage: null,
};

export default function AISettingsPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const isManager =
    session?.user?.role === Role.MANAGER ||
    session?.user?.role === Role.ADMIN;

  const [form, setForm] = useState<AISettingsData>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isManager) return;
    fetch("/api/ai/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.settings) setForm({ ...DEFAULTS, ...data.settings });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isManager]);

  function setField<K extends keyof AISettingsData>(key: K, val: AISettingsData[K]) {
    setForm((prev) => ({ ...prev, [key]: val }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (!isManager) {
    return (
      <div className="px-4 py-8 text-center max-w-sm mx-auto">
        <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
          <Brain className="h-6 w-6 text-slate-400" />
        </div>
        <p className="text-slate-600">AI settings are available to managers only.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto space-y-6 w-full">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/ai"
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Brain className="h-6 w-6 text-violet-600" />
              AI Assistant Settings
            </h1>
          </div>
          <p className="text-sm text-slate-500 ml-6">
            Configure how the AI handles staffing, rota, and communications
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="gap-2 bg-violet-600 hover:bg-violet-700 text-white shrink-0"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : saved ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {saved ? "Saved" : "Save Settings"}
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Staffing Thresholds ─────────────────────────────────────────────── */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center">
              <Users className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-base">Staffing Thresholds</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                When the AI should suggest increasing staff based on bookings
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">
              Booking threshold to suggest more staff
            </Label>
            <p className="text-xs text-slate-500">
              When total covers on a day reach this number, the AI will flag a staffing increase
            </p>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min={1}
                max={500}
                value={form.bookingThresholdForStaffIncrease}
                onChange={(e) =>
                  setField("bookingThresholdForStaffIncrease", parseInt(e.target.value) || 1)
                }
                className="w-28 text-sm"
              />
              <span className="text-sm text-slate-500">covers</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Kitchen ratio</Label>
              <p className="text-xs text-slate-500">1 kitchen staff per</p>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={form.kitchenRatio}
                  onChange={(e) =>
                    setField("kitchenRatio", parseInt(e.target.value) || 1)
                  }
                  className="w-24 text-sm"
                />
                <span className="text-sm text-slate-500">covers</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Floor ratio</Label>
              <p className="text-xs text-slate-500">1 floor staff per</p>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={form.floorRatio}
                  onChange={(e) =>
                    setField("floorRatio", parseInt(e.target.value) || 1)
                  }
                  className="w-24 text-sm"
                />
                <span className="text-sm text-slate-500">covers</span>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Minimum bar staff</Label>
            <p className="text-xs text-slate-500">
              AI will warn if fewer than this many bar staff are scheduled when there are covers
            </p>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min={0}
                max={20}
                value={form.minBarStaff}
                onChange={(e) =>
                  setField("minBarStaff", parseInt(e.target.value) || 0)
                }
                className="w-24 text-sm"
              />
              <span className="text-sm text-slate-500">staff</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Rota Settings ───────────────────────────────────────────────────── */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-violet-100 flex items-center justify-center">
              <CalendarRange className="h-4 w-4 text-violet-600" />
            </div>
            <div>
              <CardTitle className="text-base">Rota Intelligence</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                How the AI monitors and flags rota issues
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label className="text-sm font-medium">Auto-flag short-staffed shifts</Label>
              <p className="text-xs text-slate-500 mt-0.5">
                Automatically highlight shifts that fall below minimum staff levels
              </p>
            </div>
            <Switch
              checked={form.autoFlagShortStaffedShifts}
              onCheckedChange={(v) => setField("autoFlagShortStaffedShifts", v)}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Minimum staff per shift</Label>
            <p className="text-xs text-slate-500">
              Shifts with fewer than this many people will be flagged as understaffed
            </p>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min={1}
                max={50}
                value={form.minStaffPerShift}
                onChange={(e) =>
                  setField("minStaffPerShift", parseInt(e.target.value) || 1)
                }
                className="w-24 text-sm"
              />
              <span className="text-sm text-slate-500">staff</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Early warning — days ahead</Label>
            <p className="text-xs text-slate-500">
              Flag upcoming rota gaps this many days in advance
            </p>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min={1}
                max={30}
                value={form.rotaWarningDaysAhead}
                onChange={(e) =>
                  setField("rotaWarningDaysAhead", parseInt(e.target.value) || 1)
                }
                className="w-24 text-sm"
              />
              <span className="text-sm text-slate-500">days</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Specials / Price Change Communication ───────────────────────────── */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-amber-100 flex items-center justify-center">
              <Megaphone className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <CardTitle className="text-base">Specials & Price Changes</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Who gets notified when prices or specials are updated
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Notify when price changes are posted</Label>
            <p className="text-xs text-slate-500">
              Determines who receives a notification when a menu price change or special is published
            </p>
            <Select
              value={form.priceChangeNotifyScope}
              onValueChange={(v: "managers" | "all_staff" | "none") =>
                setField("priceChangeNotifyScope", v)
              }
            >
              <SelectTrigger className="w-56 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="managers">Managers &amp; Admins only</SelectItem>
                <SelectItem value="all_staff">All staff</SelectItem>
                <SelectItem value="none">No notification</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Custom notification message</Label>
            <p className="text-xs text-slate-500">
              Optional message appended to price change notifications. Leave blank for default.
            </p>
            <Textarea
              value={form.priceChangeMessage ?? ""}
              onChange={(e) =>
                setField("priceChangeMessage", e.target.value || null)
              }
              placeholder="e.g. Please update your knowledge of tonight's specials before service."
              className="min-h-[80px] resize-none text-sm"
              maxLength={500}
            />
            <p className="text-xs text-slate-400 text-right">
              {(form.priceChangeMessage ?? "").length}/500
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Bottom save */}
      <div className="flex justify-end pb-6">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="gap-2 bg-violet-600 hover:bg-violet-700 text-white"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : saved ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {saved ? "Saved!" : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}
