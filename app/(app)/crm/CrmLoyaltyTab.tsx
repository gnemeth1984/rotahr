"use client";

/**
 * Loyalty settings tab.
 *
 * Two things live here: the rules (points rate, point value, VIP spend
 * threshold, auto-upgrade) and the tier table itself. Saving re-evaluates every
 * guest straight away, because moving a threshold silently changes who
 * qualifies and a manager should see that immediately.
 */

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  Crown,
  Save,
  AlertCircle,
  CheckCircle2,
  Gift,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const SYMBOLS: Record<string, string> = { EUR: "€", GBP: "£", USD: "$", CAD: "$", AUD: "$" };

const TIER_STYLES: Record<string, string> = {
  bronze: "bg-amber-100 text-amber-800 border-amber-300",
  silver: "bg-slate-100 text-slate-700 border-slate-300",
  gold: "bg-yellow-100 text-yellow-800 border-yellow-300",
  vip: "bg-purple-100 text-purple-800 border-purple-300",
};

interface Settings {
  enabled: boolean;
  pointsPerCurrency: number;
  pointValue: number;
  vipSpendThreshold: number;
  autoUpgrade: boolean;
}

interface Tier {
  key: string;
  name: string;
  minVisits: number;
  minSpend: number;
  perks: string;
  colour: string;
  sortOrder: number;
}

interface TierCount {
  tier: string;
  guests: number;
  spend: number;
  points: number;
}

interface Redemption {
  id: string;
  points: number;
  reward: string;
  valueAmount: number | null;
  notes: string | null;
  recordedBy: string | null;
  createdAt: string;
  customer: { id: string; name: string } | null;
}

export default function CrmLoyaltyTab({ currency = "EUR" }: { currency?: string }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [counts, setCounts] = useState<TierCount[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const sym = SYMBOLS[currency] ?? "€";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/crm/loyalty");
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Could not load loyalty settings");
      const data = await res.json();
      setSettings(data.settings);
      setTiers(data.tiers ?? []);
      setCounts(data.tierCounts ?? []);
      setRedemptions(data.redemptions ?? []);
    } catch (err: any) {
      setError(err?.message || "Could not load loyalty settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/crm/loyalty", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings,
          tiers: tiers.map((t, i) => ({
            key: t.key,
            name: t.name,
            minVisits: Number(t.minVisits) || 0,
            minSpend: Number(t.minSpend) || 0,
            perks: t.perks || null,
            colour: t.colour || "slate",
            sortOrder: i,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Could not save");
      setSettings(data.settings);
      setTiers(data.tiers ?? []);
      const upgrades = data.recomputed?.upgrades?.length ?? 0;
      setNotice(
        upgrades > 0
          ? `Saved. ${upgrades} guest${upgrades === 1 ? "" : "s"} moved tier.`
          : "Saved. No tier changes."
      );
      load();
    } catch (err: any) {
      setError(err?.message || "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const setTier = (index: number, patch: Partial<Tier>) =>
    setTiers((prev) => prev.map((t, i) => (i === index ? { ...t, ...patch } : t)));

  const money = (n: number) =>
    `${sym}${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="mx-4 flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-3">
        <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
        <p className="text-xs text-red-800">{error || "No loyalty settings"}</p>
      </div>
    );
  }

  const countFor = (key: string) => counts.find((c) => c.tier === key);
  const outstanding = counts.reduce((sum, c) => sum + c.points, 0);

  return (
    <div className="px-4 pb-6 space-y-3">
      {error && (
        <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-3">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
          <p className="text-xs text-red-800">{error}</p>
        </div>
      )}
      {notice && (
        <div className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
          <p className="text-xs text-emerald-800">{notice}</p>
        </div>
      )}

      {/* Rules */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
            <Crown className="h-3.5 w-3.5 text-yellow-600" /> Loyalty rules
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500">{settings.enabled ? "On" : "Off"}</span>
            <Switch
              checked={settings.enabled}
              onCheckedChange={(v) => setSettings({ ...settings, enabled: v })}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-[10px] uppercase tracking-wide text-slate-500">
              Points per {sym}1
            </Label>
            <Input
              type="number"
              step="0.1"
              min="0"
              value={settings.pointsPerCurrency}
              onChange={(e) =>
                setSettings({ ...settings, pointsPerCurrency: Number(e.target.value) })
              }
              className="mt-1 h-9 text-sm"
            />
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wide text-slate-500">
              Point worth ({sym})
            </Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={settings.pointValue}
              onChange={(e) => setSettings({ ...settings, pointValue: Number(e.target.value) })}
              className="mt-1 h-9 text-sm"
            />
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wide text-slate-500">
              VIP spend threshold
            </Label>
            <Input
              type="number"
              step="10"
              min="0"
              value={settings.vipSpendThreshold}
              onChange={(e) =>
                setSettings({ ...settings, vipSpendThreshold: Number(e.target.value) })
              }
              className="mt-1 h-9 text-sm"
            />
          </div>
          <div className="flex flex-col justify-end">
            <Label className="text-[10px] uppercase tracking-wide text-slate-500">
              Auto-upgrade tiers
            </Label>
            <div className="mt-2 flex items-center gap-2">
              <Switch
                checked={settings.autoUpgrade}
                onCheckedChange={(v) => setSettings({ ...settings, autoUpgrade: v })}
              />
              <span className="text-[10px] text-slate-500">
                {settings.autoUpgrade ? "moves on its own" : "manual only"}
              </span>
            </div>
          </div>
        </div>

        <p className="mt-3 flex items-start gap-1.5 text-[10px] leading-snug text-slate-500">
          <Info className="mt-0.5 h-3 w-3 flex-shrink-0" />
          {outstanding.toLocaleString()} points are outstanding across your guests, worth roughly{" "}
          {money(outstanding * settings.pointValue)} if every one were redeemed today.
        </p>
      </div>

      {/* Tiers */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3">
        <h3 className="mb-2 text-xs font-semibold text-slate-900">Tiers</h3>
        <div className="space-y-3">
          {tiers.map((t, i) => {
            const c = countFor(t.key);
            return (
              <div key={t.key} className="rounded-xl border border-slate-100 bg-slate-50/60 p-2.5">
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                      TIER_STYLES[t.key] ?? "border-slate-300 bg-white text-slate-700"
                    )}
                  >
                    {t.key}
                  </span>
                  <Input
                    value={t.name}
                    onChange={(e) => setTier(i, { name: e.target.value })}
                    className="h-8 flex-1 text-sm"
                  />
                  <Badge variant="outline" className="flex-shrink-0 text-[9px]">
                    {c?.guests ?? 0} guest{(c?.guests ?? 0) === 1 ? "" : "s"}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px] text-slate-500">Min visits</Label>
                    <Input
                      type="number"
                      min="0"
                      value={t.minVisits}
                      onChange={(e) => setTier(i, { minVisits: Number(e.target.value) })}
                      className="mt-1 h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-slate-500">Min spend ({sym})</Label>
                    <Input
                      type="number"
                      min="0"
                      step="10"
                      value={t.minSpend}
                      onChange={(e) => setTier(i, { minSpend: Number(e.target.value) })}
                      className="mt-1 h-8 text-sm"
                    />
                  </div>
                </div>
                <div className="mt-2">
                  <Label className="text-[10px] text-slate-500">Perks (one per line)</Label>
                  <Textarea
                    value={t.perks}
                    onChange={(e) => setTier(i, { perks: e.target.value })}
                    rows={3}
                    className="mt-1 text-xs"
                  />
                </div>
              </div>
            );
          })}
        </div>

        <Button onClick={save} disabled={saving} className="mt-3 h-9 w-full text-xs">
          {saving ? (
            <>
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Saving and re-checking guests
            </>
          ) : (
            <>
              <Save className="mr-1.5 h-3.5 w-3.5" /> Save and re-check every guest
            </>
          )}
        </Button>
      </div>

      {/* Redemptions */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3">
        <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-900">
          <Gift className="h-3.5 w-3.5 text-pink-500" /> Recent redemptions
        </h3>
        {redemptions.length === 0 ? (
          <p className="text-[11px] text-slate-500">
            Nothing redeemed yet. Redeem points from a guest profile.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {redemptions.map((r) => (
              <div key={r.id} className="py-2">
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-900">
                    {r.customer?.name ?? "Guest removed"}
                  </span>
                  <span className="flex-shrink-0 text-[10px] text-slate-500">
                    {new Date(r.createdAt).toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                  <span className="flex-shrink-0 text-xs font-semibold text-slate-900">
                    -{r.points.toLocaleString()} pts
                  </span>
                </div>
                <div className="text-[10px] text-slate-500">
                  {r.reward}
                  {r.valueAmount != null && ` · ${money(r.valueAmount)}`}
                  {r.recordedBy && ` · by ${r.recordedBy}`}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
