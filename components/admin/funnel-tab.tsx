"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, CheckCircle2, Circle, Mail, Eye, X, Info, RefreshCw, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TemplateLeadsCard } from "@/components/admin/template-leads-card";

interface Stage {
  key: string;
  label: string;
  count: number;
  unit: "sessions" | "businesses";
}

interface BizRow {
  id: string;
  name: string;
  createdAt: string;
  ownerEmail: string | null;
  country: string;
  staffCount: number;
  publishedShiftCount: number;
  invitedCount: number;
  joinedCount: number;
  steps: { key: string; done: boolean; doneAt: string | null }[];
  paying: boolean;
  plan: string | null;
  trialDaysLeft: number | null;
  accessMode: string;
  firstTouch: { path: string; referrer: string | null; at: string } | null;
  triedDemo: boolean;
}

interface Funnel {
  days: number;
  since: string | null;
  trackingSince: string | null;
  stages: Stage[];
  medians: { staff: number | null; rota: number | null; invite: number | null };
  sources: { source: string; signups: number }[];
  businesses: BizRow[];
}

interface PlanItem {
  businessId: string;
  businessName: string;
  createdAt: string;
  to: string | null;
  key: string | null;
  reason: string;
  skip: string | null;
  email: { subject: string; html: string; text: string } | null;
  lastSentAt: string | null;
  sentKeys: string[];
}

const RANGES = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
  { days: 0, label: "All time" },
];

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "2-digit" });
}

function pct(n: number, d: number) {
  if (!d) return "—";
  const v = (n / d) * 100;
  return v >= 10 ? `${Math.round(v)}%` : `${v.toFixed(1)}%`;
}

function host(ref: string | null) {
  if (!ref) return "direct";
  try {
    return new URL(ref).hostname.replace(/^www\./, "");
  } catch {
    return ref.slice(0, 24);
  }
}

export function FunnelTab() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Funnel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<{ enabled: boolean; labels: Record<string, string>; items: PlanItem[] } | null>(null);
  const [preview, setPreview] = useState<PlanItem | null>(null);
  // Manual send: first click arms it for that business, second click sends.
  const [armed, setArmed] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [sendNote, setSendNote] = useState<Record<string, { ok: boolean; text: string }>>({});

  const reloadPlan = useCallback(async () => {
    const l = await fetch("/api/admin/lifecycle");
    if (l.ok) setPlan(await l.json());
  }, []);

  const sendNow = useCallback(
    async (i: PlanItem) => {
      if (!i.key) return;
      setSending(i.businessId);
      try {
        const r = await fetch("/api/admin/lifecycle", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ businessId: i.businessId, key: i.key }),
        });
        const j = await r.json().catch(() => ({}));
        setSendNote((n) => ({
          ...n,
          [i.businessId]: r.ok
            ? { ok: true, text: `Sent "${i.key}" to ${j.to ?? i.to}` }
            : { ok: false, text: j.error ?? `Failed (HTTP ${r.status})` },
        }));
        if (r.ok) {
          setPreview(null);
          await reloadPlan();
        }
      } finally {
        setSending(null);
        setArmed(null);
      }
    },
    [reloadPlan],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [f, l] = await Promise.all([fetch(`/api/admin/funnel?days=${days}`), fetch("/api/admin/lifecycle")]);
      if (!f.ok) throw new Error((await f.json().catch(() => ({}))).error ?? `HTTP ${f.status}`);
      setData(await f.json());
      if (l.ok) setPlan(await l.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  const max = data ? Math.max(1, ...data.stages.map((s) => s.count)) : 1;
  const due = plan?.items.filter((i) => i.key) ?? [];

  return (
    <div className="space-y-6" data-testid="funnel-tab">
      <div className="flex flex-wrap items-center gap-2">
        {RANGES.map((r) => (
          <button
            key={r.days}
            onClick={() => setDays(r.days)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
              days === r.days ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
            }`}
            data-testid={`range-${r.days}`}
          >
            {r.label}
          </button>
        ))}
        <Button variant="ghost" size="sm" onClick={load} className="gap-1.5 text-xs h-7">
          <RefreshCw className="h-3 w-3" /> Refresh
        </Button>
        {data?.trackingSince && (
          <span className="text-xs text-slate-400 ml-auto">Page tracking since {fmt(data.trackingSince)}</span>
        )}
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>}
      {loading && !data && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      )}

      {data && (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Funnel</CardTitle>
              <p className="text-xs text-slate-500">
                First three rows count browser sessions, the rest count businesses (demo tenants and /v/ listing shells
                excluded). The % is conversion from the row above.
              </p>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {data.stages.map((s, i) => {
                const prev = i > 0 ? data.stages[i - 1] : null;
                // /try is a side path, not every signup goes through it: measure
                // "reached sign-up page" against all visitors, not demo openers.
                const base = s.key === "register" ? data.stages[0] : prev;
                const w = Math.max(1.5, (s.count / max) * 100);
                return (
                  <div key={s.key}>
                    {prev && prev.unit !== s.unit && <div className="border-t border-dashed border-slate-200 my-2" />}
                    <div className="flex items-center gap-3" data-testid={`stage-${s.key}`}>
                      <div className="w-44 shrink-0 text-xs text-slate-600 truncate">{s.label}</div>
                      <div className="flex-1 bg-slate-100 rounded h-6 overflow-hidden">
                        <div
                          className={`h-6 rounded ${s.unit === "sessions" ? "bg-sky-400" : s.key === "paid" ? "bg-emerald-600" : "bg-emerald-400"}`}
                          style={{ width: `${w}%` }}
                        />
                      </div>
                      <div className="w-14 text-right text-sm font-semibold text-slate-900 tabular-nums" data-testid={`count-${s.key}`}>
                        {s.count.toLocaleString("en-IE")}
                      </div>
                      <div className="w-14 text-right text-xs text-slate-500 tabular-nums">
                        {base ? pct(s.count, base.count) : ""}
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Median days from signup</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-3 gap-3">
                {(
                  [
                    ["staff", "First staff"],
                    ["rota", "First rota"],
                    ["invite", "Team invited"],
                  ] as const
                ).map(([k, label]) => (
                  <div key={k}>
                    <p className="text-2xl font-bold text-slate-900">{data.medians[k] ?? "—"}</p>
                    <p className="text-xs text-slate-500">{label}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Signups by first-touch source</CardTitle>
              </CardHeader>
              <CardContent>
                {data.sources.length === 0 ? (
                  <p className="text-sm text-slate-400">No signups in this range.</p>
                ) : (
                  <ul className="space-y-1">
                    {data.sources.map((s) => (
                      <li key={s.source} className="flex justify-between text-sm">
                        <span className="text-slate-600">{s.source}</span>
                        <span className="font-medium text-slate-900">{s.signups}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Signups ({data.businesses.length})</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {data.businesses.length === 0 ? (
                <p className="text-sm text-slate-400 py-4">No real signups in this range.</p>
              ) : (
                <table className="w-full text-xs min-w-[760px]">
                  <thead className="text-slate-500 border-b">
                    <tr>
                      <th className="text-left py-2 font-medium">Business</th>
                      <th className="text-left py-2 font-medium">Signed up</th>
                      <th className="text-left py-2 font-medium">First touch</th>
                      <th className="text-center py-2 font-medium">Staff</th>
                      <th className="text-center py-2 font-medium">Rota</th>
                      <th className="text-center py-2 font-medium">Invited</th>
                      <th className="text-left py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.businesses.map((b) => {
                      const st = (k: string) => b.steps.find((s) => s.key === k);
                      const cell = (k: string, n: string) => {
                        const s = st(k);
                        return (
                          <td className="py-2 text-center" title={s?.doneAt ? `first: ${fmt(s.doneAt)}` : "not yet"}>
                            <span className="inline-flex items-center gap-1">
                              {s?.done ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                              ) : (
                                <Circle className="h-3.5 w-3.5 text-slate-300" />
                              )}
                              <span className="text-slate-600 tabular-nums">{n}</span>
                            </span>
                          </td>
                        );
                      };
                      return (
                        <tr key={b.id} className="border-b border-slate-100" data-testid="funnel-biz">
                          <td className="py-2 pr-2">
                            <p className="font-medium text-slate-900">{b.name}</p>
                            <p className="text-slate-400">{b.ownerEmail ?? "—"} · {b.country}</p>
                          </td>
                          <td className="py-2 text-slate-600 whitespace-nowrap">{fmt(b.createdAt)}</td>
                          <td className="py-2 text-slate-600">
                            {b.firstTouch ? (
                              <>
                                <span>{host(b.firstTouch.referrer)}</span>
                                <span className="text-slate-400"> → {b.firstTouch.path}</span>
                                {b.triedDemo && (
                                  <span className="ml-1 px-1.5 py-0.5 rounded bg-sky-50 text-sky-700">demo first</span>
                                )}
                              </>
                            ) : (
                              <span className="text-slate-400">not linked</span>
                            )}
                          </td>
                          {cell("staff", String(b.staffCount))}
                          {cell("rota", String(b.publishedShiftCount))}
                          {cell("invite", `${b.joinedCount}/${b.invitedCount}`)}
                          <td className="py-2 whitespace-nowrap">
                            {b.paying ? (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-medium capitalize">
                                {b.plan ?? "paying"}
                              </span>
                            ) : b.trialDaysLeft !== null ? (
                              <span className={b.trialDaysLeft <= 7 ? "text-amber-700 font-medium" : "text-slate-600"}>
                                trial · {b.trialDaysLeft}d left
                              </span>
                            ) : (
                              <span className="text-slate-400">{b.accessMode.replace(/_/g, " ")}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
              <p className="text-[11px] text-slate-400 mt-2">Invited column: logged in / invited.</p>
            </CardContent>
          </Card>
        </>
      )}

      {plan && (
        <Card data-testid="lifecycle-panel">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="h-4 w-4 text-slate-500" /> Setup emails
            </CardTitle>
            <p className="text-xs text-slate-500 flex gap-1.5">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              {plan.enabled
                ? "Automatic sending is ON (LIFECYCLE_EMAILS_ENABLED)."
                : "Automatic sending is OFF — nothing goes out unless you press Send here."}{" "}
              This is who is due what today. One email per missing step, trial accounts only, max one every 3 days,
              unsubscribed and demo addresses skipped.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(plan.labels).map(([k, v]) => (
                <span key={k} className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  <code>{k}</code> · {v}
                </span>
              ))}
            </div>
            {Object.entries(sendNote)
              .filter(([id, n]) => n.ok && !due.some((d) => d.businessId === id))
              .map(([id, n]) => (
                <p key={id} className="text-xs text-emerald-700 flex items-center gap-1.5" data-testid="lifecycle-sent">
                  <CheckCircle2 className="h-3.5 w-3.5" /> {n.text}
                </p>
              ))}
            {due.length === 0 ? (
              <p className="text-sm text-slate-400">Nobody is due a setup email today.</p>
            ) : (
              <table className="w-full text-xs">
                <thead className="text-slate-500 border-b">
                  <tr>
                    <th className="text-left py-2 font-medium">Business</th>
                    <th className="text-left py-2 font-medium">Email</th>
                    <th className="text-left py-2 font-medium">Why</th>
                    <th className="text-left py-2 font-medium">To</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {due.map((i) => (
                    <tr key={i.businessId} className="border-b border-slate-100" data-testid="lifecycle-row">
                      <td className="py-2 font-medium text-slate-900">{i.businessName}</td>
                      <td className="py-2">
                        <code className="text-slate-700">{i.key}</code>
                        <p className="text-slate-500">{i.email?.subject}</p>
                      </td>
                      <td className="py-2 text-slate-600">{i.reason}</td>
                      <td className="py-2 text-slate-600 break-all">
                        {i.to}
                        {i.skip && <span className="block text-amber-700">skipped: {i.skip}</span>}
                      </td>
                      <td className="py-2 text-right">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={() => setPreview(i)} data-testid="lifecycle-preview">
                            <Eye className="h-3 w-3" /> Preview
                          </Button>
                          {!i.skip && <SendControl i={i} armed={armed} sending={sending} setArmed={setArmed} sendNow={sendNow} />}
                        </div>
                        {sendNote[i.businessId] && (
                          <p
                            className={`mt-1 text-[11px] ${sendNote[i.businessId].ok ? "text-emerald-700" : "text-red-600"}`}
                            data-testid="lifecycle-send-note"
                          >
                            {sendNote[i.businessId].text}
                          </p>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <details className="text-xs text-slate-500">
              <summary className="cursor-pointer">Not due ({(plan.items.length - due.length).toString()})</summary>
              <ul className="mt-2 space-y-1">
                {plan.items
                  .filter((i) => !i.key)
                  .map((i) => (
                    <li key={i.businessId}>
                      <span className="text-slate-700">{i.businessName}</span> — {i.reason}
                      {i.sentKeys.length > 0 && <span className="text-slate-400"> · sent: {i.sentKeys.join(", ")}</span>}
                    </li>
                  ))}
              </ul>
            </details>
          </CardContent>
        </Card>
      )}

      <TemplateLeadsCard />

      {preview?.email && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
            data-testid="lifecycle-modal"
          >
            <div className="flex items-start justify-between gap-3 p-4 border-b">
              <div className="min-w-0">
                <p className="text-xs text-slate-500">To: {preview.to} · {preview.key}</p>
                <p className="text-sm font-semibold text-slate-900">{preview.email.subject}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {!preview.skip && (
                  <SendControl i={preview} armed={armed} sending={sending} setArmed={setArmed} sendNow={sendNow} />
                )}
                <button onClick={() => setPreview(null)} className="text-slate-400 hover:text-slate-600" aria-label="Close">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            {sendNote[preview.businessId] && !sendNote[preview.businessId].ok && (
              <p className="px-4 py-2 text-xs text-red-600 border-b">{sendNote[preview.businessId].text}</p>
            )}
            <iframe title="Email preview" srcDoc={preview.email.html} className="w-full flex-1 min-h-[420px]" sandbox="" />
          </div>
        </div>
      )}
    </div>
  );
}

function SendControl({
  i,
  armed,
  sending,
  setArmed,
  sendNow,
}: {
  i: PlanItem;
  armed: string | null;
  sending: string | null;
  setArmed: (id: string | null) => void;
  sendNow: (i: PlanItem) => void;
}) {
  const busy = sending === i.businessId;
  if (armed === i.businessId || busy) {
    return (
      <span className="inline-flex items-center gap-1">
        <Button size="sm" className="h-7 gap-1 text-xs" disabled={busy} onClick={() => sendNow(i)} data-testid="lifecycle-send-confirm">
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
          {busy ? "Sending…" : `Send to ${i.to}`}
        </Button>
        {!busy && (
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setArmed(null)}>
            Cancel
          </Button>
        )}
      </span>
    );
  }
  return (
    <Button size="sm" className="h-7 gap-1 text-xs" onClick={() => setArmed(i.businessId)} data-testid="lifecycle-send">
      <Send className="h-3 w-3" /> Send
    </Button>
  );
}
