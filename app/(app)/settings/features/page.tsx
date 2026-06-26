"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useFeatureFlags } from "@/components/shared/FeatureFlagsProvider";
import { FEATURE_DEFINITIONS, FeatureKey, FeatureFlag } from "@/lib/features";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ToggleLeft,
  ToggleRight,
  Users,
  Info,
  Loader2,
  CheckCircle2,
  ShieldAlert,
  Eye,
  EyeOff,
  Save,
} from "lucide-react";

type FlagMap = Record<FeatureKey, FeatureFlag>;

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  EMPLOYEE: { label: "Staff", color: "bg-slate-100 text-slate-700 border-slate-200" },
  MANAGER: { label: "Manager", color: "bg-blue-100 text-blue-700 border-blue-200" },
  ADMIN: { label: "Admin / Owner", color: "bg-purple-100 text-purple-700 border-purple-200" },
};

const CATEGORY_ORDER = ["Core", "Operations", "Finance", "People", "AI & Tools"];

export default function FeaturesSettingsPage() {
  const { data: session } = useSession();
  const { reload } = useFeatureFlags();
  const role = session?.user?.role;

  const [flags, setFlags] = useState<FlagMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    const r = await fetch("/api/settings/features");
    if (r.ok) {
      const d = await r.json();
      setFlags(d.flags);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function toggleEnabled(key: FeatureKey) {
    setFlags((prev) => {
      if (!prev) return prev;
      const current = prev[key];
      return { ...prev, [key]: { ...current, enabled: !current.enabled } };
    });
    setSaved(false);
  }

  function toggleRole(key: FeatureKey, roleStr: string) {
    setFlags((prev) => {
      if (!prev) return prev;
      const current = prev[key];
      const roles = current.roles.includes(roleStr)
        ? current.roles.filter((r) => r !== roleStr)
        : [...current.roles, roleStr];
      // Always keep ADMIN
      const safe = roles.includes("ADMIN") ? roles : [...roles, "ADMIN"];
      return { ...prev, [key]: { ...current, roles: safe } };
    });
    setSaved(false);
  }

  async function save() {
    if (!flags) return;
    setSaving(true);
    setError("");
    const r = await fetch("/api/settings/features", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flags }),
    });
    setSaving(false);
    if (!r.ok) {
      const d = await r.json();
      setError(d.error ?? "Save failed");
      return;
    }
    setSaved(true);
    reload(); // refresh sidebar
    setTimeout(() => setSaved(false), 3000);
  }

  if (role !== "MANAGER" && role !== "ADMIN") {
    return (
      <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-5 py-4 text-sm text-red-700">
        <ShieldAlert className="h-5 w-5 flex-shrink-0" />
        Only managers and admins can manage feature settings.
      </div>
    );
  }

  if (loading || !flags) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-7 w-7 animate-spin text-slate-300" />
      </div>
    );
  }

  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    items: FEATURE_DEFINITIONS.filter((d) => d.category === cat),
  }));

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Intro */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4 flex gap-3 text-sm text-blue-800">
        <Info className="h-4 w-4 flex-shrink-0 mt-0.5 text-blue-500" />
        <div className="space-y-1">
          <p className="font-semibold">Control what your team sees and uses</p>
          <p className="text-blue-700">
            Turn features on or off for your business. You can also control which roles (Staff, Manager, Admin) can see each feature in the menu. Changes take effect immediately — the menu will update for all users within seconds.
          </p>
        </div>
      </div>

      {/* Save bar */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">
          {saved
            ? "Changes saved — menu updated for all users."
            : "Make your changes below then click Save."}
        </p>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" /> Saved
            </span>
          )}
          {error && <span className="text-xs text-red-600">{error}</span>}
          <Button size="sm" onClick={save} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save changes
          </Button>
        </div>
      </div>

      {/* Feature groups */}
      {grouped.map(({ category, items }) => (
        <div key={category} className="space-y-2">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{category}</p>

          <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
            {items.map((def) => {
              const key = def.key as FeatureKey;
              const flag = flags[key];
              const isOn = flag?.enabled ?? true;
              const canDisable = def.canDisable !== false;

              return (
                <div
                  key={key}
                  className={cn(
                    "px-5 py-4 transition-colors",
                    !isOn && "bg-slate-50 opacity-70"
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Label + description */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-slate-900">{def.label}</p>
                        {!canDisable && (
                          <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full border border-slate-200">
                            Always on
                          </span>
                        )}
                        {isOn ? (
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-200">
                            Active
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full border border-slate-200">
                            Hidden from menu
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed">{def.description}</p>

                      {/* Role visibility toggles — only show if feature is enabled */}
                      {isOn && (
                        <div className="pt-2 space-y-1">
                          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                            <Eye className="h-3 w-3" />
                            Visible to
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {(def.canRestrictToRoles as readonly string[]).map((r) => {
                              const info = ROLE_LABELS[r];
                              const isRoleOn = flag?.roles?.includes(r) ?? true;
                              const isAdminRole = r === "ADMIN";

                              return (
                                <button
                                  key={r}
                                  disabled={isAdminRole} // ADMIN always locked on
                                  onClick={() => !isAdminRole && toggleRole(key, r)}
                                  title={
                                    isAdminRole
                                      ? "Admins always have access"
                                      : isRoleOn
                                      ? `Hide from ${info.label}`
                                      : `Show to ${info.label}`
                                  }
                                  className={cn(
                                    "flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-all",
                                    isRoleOn
                                      ? info.color
                                      : "bg-white text-slate-300 border-slate-200 line-through",
                                    !isAdminRole && "cursor-pointer hover:opacity-80",
                                    isAdminRole && "cursor-not-allowed opacity-60"
                                  )}
                                >
                                  {isRoleOn ? (
                                    <Eye className="h-3 w-3" />
                                  ) : (
                                    <EyeOff className="h-3 w-3" />
                                  )}
                                  {info.label}
                                  {isAdminRole && (
                                    <span className="text-[9px] opacity-60 ml-0.5">locked</span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1">
                            Click a role pill to toggle who can see this in the menu. Admin/Owner always has access.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* On/Off toggle */}
                    <button
                      disabled={!canDisable}
                      onClick={() => canDisable && toggleEnabled(key)}
                      title={
                        !canDisable
                          ? "This feature cannot be disabled"
                          : isOn
                          ? "Turn off — hides from menu"
                          : "Turn on"
                      }
                      className={cn(
                        "flex-shrink-0 mt-0.5 transition-colors",
                        !canDisable && "cursor-not-allowed opacity-40"
                      )}
                    >
                      {isOn ? (
                        <ToggleRight className="h-8 w-8 text-blue-500 hover:text-blue-600" />
                      ) : (
                        <ToggleLeft className="h-8 w-8 text-slate-300 hover:text-slate-400" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Bottom save */}
      <div className="flex justify-end pb-8">
        <Button onClick={save} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save changes
        </Button>
      </div>
    </div>
  );
}
