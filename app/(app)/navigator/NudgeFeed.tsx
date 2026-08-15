"use client";

import { useState } from "react";
import { Bell, BellOff, Clock, Coffee, BatteryLow, Undo2 } from "lucide-react";
import { api, errMsg } from "./api";
import { Panel, Pill, SectionTitle } from "./nav-ui";
import type { Nudge, Snooze } from "./types";

const OPTIONS = [
  { id: "10min", label: "10 min", icon: Clock },
  { id: "1hour", label: "1 hour", icon: Clock },
  { id: "after_shift", label: "After shift", icon: Coffee },
  { id: "energy", label: "Got no energy", icon: BatteryLow },
] as const;

function ago(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

function untilLabel(iso: string): string {
  const mins = Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
  if (mins <= 0) return "any moment";
  if (mins < 60) return `${mins} min`;
  return `${Math.round(mins / 60)}h`;
}

/**
 * 5.2 Smart Snooze, plus an in-app record of what the app has said today.
 *
 * Two problems solved at once. First, a push notification that arrives mid-service
 * is gone forever — so every nudge is also here to be read later. Second, the only
 * honest reply to most nudges is "yes, but not now", and without a way to say that
 * the alternative is dismissing them, then ignoring them, then muting everything.
 *
 * A snooze is always shown while it's active. Anything the app hides, the user has
 * to be able to see and undo — otherwise silence looks like the feature is broken.
 */
export function NudgeFeed({
  nudges,
  snoozes,
  refresh,
}: {
  nudges: Nudge[];
  snoozes: Snooze[];
  refresh: () => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const snoozeOf = (n: Nudge) => snoozes.find((s) => s.kind === n.kind && s.refKey === n.refKey) ?? null;

  async function snooze(n: Nudge, option: string) {
    setBusy(n.id);
    setError(null);
    try {
      await api("/nudges/snooze", { body: { kind: n.kind, refKey: n.refKey, option } });
      setOpenId(null);
      refresh();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  }

  async function unsnooze(n: Nudge) {
    setBusy(n.id);
    setError(null);
    try {
      await api(`/nudges/snooze?kind=${encodeURIComponent(n.kind)}&refKey=${encodeURIComponent(n.refKey)}`, {
        method: "DELETE",
      });
      refresh();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  }

  if (!nudges.length) return null;

  return (
    <Panel className="p-5">
      <SectionTitle right={snoozes.length ? <Pill tone="slate">{snoozes.length} snoozed</Pill> : undefined}>
        <span className="inline-flex items-center gap-2">
          <Bell className="h-3.5 w-3.5" /> What Navigator said today
        </span>
      </SectionTitle>

      {error && <p className="mb-3 text-xs text-rose-300">{error}</p>}

      <ul className="space-y-2">
        {nudges.map((n) => {
          const sn = snoozeOf(n);
          const open = openId === n.id;
          return (
            <li
              key={n.id}
              className={`rounded-xl border px-3.5 py-3 transition-all ${
                sn ? "border-white/[0.06] bg-white/[0.015] opacity-70" : "border-white/[0.08] bg-white/[0.03]"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-white">{n.title}</span>
                    <span className="text-[10px] uppercase tracking-wider text-slate-500">{ago(n.sentAt)}</span>
                  </div>
                  <p className="mt-0.5 text-xs leading-snug text-slate-400">{n.body}</p>

                  {sn ? (
                    <button
                      type="button"
                      onClick={() => unsnooze(n)}
                      disabled={busy === n.id}
                      className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500 transition hover:text-slate-200 disabled:opacity-50"
                    >
                      <Undo2 className="h-3 w-3" />
                      Snoozed for {untilLabel(sn.until)}
                      {sn.condition === "energy3" ? " (or until energy is back)" : ""} — bring it back
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setOpenId(open ? null : n.id)}
                      className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500 transition hover:text-slate-200"
                    >
                      <BellOff className="h-3 w-3" />
                      Not now
                    </button>
                  )}

                  {open && !sn && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {OPTIONS.map((o) => {
                        const Icon = o.icon;
                        return (
                          <button
                            key={o.id}
                            type="button"
                            onClick={() => snooze(n, o.id)}
                            disabled={busy === n.id}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.06] px-2.5 py-1.5 text-[11px] font-medium text-slate-200 transition hover:bg-white/[0.12] disabled:opacity-50"
                          >
                            <Icon className="h-3 w-3" />
                            {o.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="mt-3 text-[10px] leading-snug text-slate-600">
        Snoozing tells Navigator when to come back. Dismissing would just make it repeat tomorrow.
      </p>
    </Panel>
  );
}
