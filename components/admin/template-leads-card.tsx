"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, FileDown, Info, Eye, X, AlertTriangle, Send, SkipForward, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Preview {
  step: number;
  label: string;
  subject: string;
  html: string;
  text: string;
}

interface LeadPlan {
  nextStep: number | null;
  label: string | null;
  subject: string | null;
  dueAt: string | null;
  due: boolean;
  blocked: string | null;
}

interface HistoryItem {
  step: number;
  at: string;
  ok: boolean;
  manual: boolean;
  skipped: boolean;
  error: string | null;
}

interface LeadPreview {
  lead: LeadRow;
  subject: string;
  html: string;
}

interface LeadRow {
  id: string;
  email: string;
  marketingConsent: boolean;
  firstSlug: string;
  slugs: string[];
  downloads: number;
  venueType: string | null;
  country: string | null;
  step: number;
  status: string;
  lastSentAt: string | null;
  createdAt: string;
  plan: LeadPlan;
  history: HistoryItem[];
}

interface Data {
  enabled: boolean;
  migrated: boolean;
  pending: number;
  consent: { text: string; preTicked: boolean };
  stats: {
    total: number;
    consented: number;
    last7d: number;
    byStatus: Record<string, number>;
    byStep: Record<string, number>;
    topSlugs: { slug: string; leads: number }[];
  } | null;
  recent: LeadRow[];
  sample: { slug: string; venue: string };
  venueTypes: readonly { id: string; label: string }[];
  templates: { slug: string; name: string }[];
  previews: Preview[];
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-IE", { day: "numeric", month: "short" });
}

const DAY_OF_STEP = ["Day 0", "Day 3", "Day 7", "Day 14"];

function dueText(p: LeadPlan) {
  if (!p.dueAt) return "";
  if (p.due) return "due now";
  return `due ${fmt(p.dueAt)}`;
}

/** Free-template leads: send each lead its next email by hand, track what went, preview the series. */
export function TemplateLeadsCard() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [slug, setSlug] = useState("");
  const [venue, setVenue] = useState("");
  const [open, setOpen] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [leadPreview, setLeadPreview] = useState<LeadPreview | null>(null);
  const [armed, setArmed] = useState<string | null>(null); // "send:<id>" | "skip:<id>"
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, { ok: boolean; text: string }>>({});

  const load = useCallback(async (s: string, v: string) => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (s) q.set("slug", s);
      if (v) q.set("venue", v);
      const r = await fetch(`/api/admin/template-leads?${q.toString()}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = (await r.json()) as Data;
      setData(d);
      setSlug(d.sample.slug);
      setVenue(d.sample.venue);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load("", "");
  }, [load]);

  const openLead = useCallback(async (l: LeadRow) => {
    setBusy(`preview:${l.id}`);
    try {
      const r = await fetch(`/api/admin/template-leads?lead=${encodeURIComponent(l.id)}`);
      const j = await r.json().catch(() => ({}));
      // Use the plan the preview was rendered for, so the header and the Send button match the email shown.
      if (r.ok && j.email) setLeadPreview({ lead: j.plan ? { ...l, plan: j.plan } : l, subject: j.email.subject, html: j.email.html });
      else setNotes((n) => ({ ...n, [l.id]: { ok: false, text: j.error ?? "Nothing to preview" } }));
    } finally {
      setBusy(null);
    }
  }, []);

  const act = useCallback(
    async (l: LeadRow, action: "send" | "skip") => {
      if (l.plan.nextStep === null) return;
      setBusy(`${action}:${l.id}`);
      try {
        const r = await fetch("/api/admin/template-leads", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action, leadId: l.id, step: l.plan.nextStep, early: !l.plan.due }),
        });
        const j = await r.json().catch(() => ({}));
        const day = DAY_OF_STEP[l.plan.nextStep] ?? `Step ${l.plan.nextStep}`;
        setNotes((n) => ({
          ...n,
          [l.id]: r.ok
            ? { ok: true, text: action === "send" ? `Sent ${day} to ${l.email}` : `Skipped ${day}` }
            : { ok: false, text: j.error ?? `Failed (HTTP ${r.status})` },
        }));
        if (r.ok) setLeadPreview(null);
        // Reload either way: on a 409 the lead has usually moved on and the row should show its real next step.
        await load(slug, venue);
      } finally {
        setBusy(null);
        setArmed(null);
      }
    },
    [load, slug, venue],
  );

  const dueNow = data?.recent.filter((l) => l.plan.nextStep !== null && !l.plan.blocked && l.plan.due).length ?? 0;

  return (
    <Card data-testid="template-leads-panel">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <FileDown className="h-4 w-4 text-slate-500" /> Template leads
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />}
        </CardTitle>
        {data && (
          <p className="text-xs text-slate-500 flex gap-1.5" data-testid="template-leads-status">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>
              {data.enabled
                ? "Automatic sending is ON (TEMPLATE_EMAILS_ENABLED=1); you can still send a lead's next email early below."
                : "Automatic sending is OFF — nothing goes out unless you press Send on a lead below. To automate it later, set TEMPLATE_EMAILS_ENABLED=1 in Vercel; it carries on from wherever each lead has got to."}{" "}
              Day 0 goes to everyone who downloads; days 3, 7 and 14 only to those who left the box ticked. Unsubscribed
              addresses and existing customers drop out.
            </span>
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <p className="text-sm text-red-600">{error}</p>}
        {data && !data.migrated && (
          <p className="text-xs text-amber-700 flex gap-1.5" data-testid="template-leads-unmigrated">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            The TemplateLead table doesn&apos;t exist in this database yet — apply migration
            <code>20261025090000_template_leads</code>. Downloads still work; leads are parked
            {data.pending ? ` (${data.pending} so far)` : ""} until then.
          </p>
        )}
        {data && data.migrated && data.pending > 0 && (
          <p className="text-xs text-amber-700">
            {data.pending} lead(s) parked while the table was missing. Import them with
            <code> scripts/import-pending-template-leads.ts</code>.
          </p>
        )}
        {data && data.consent.preTicked && (
          <p className="text-[11px] text-slate-400">
            Consent box starts ticked (CONSENT_DEFAULT_CHECKED in lib/templates/lead-consent.ts).
          </p>
        )}

        {data?.stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center" data-testid="template-leads-stats">
            {[
              { k: "Leads", v: data.stats.total },
              { k: "Last 7 days", v: data.stats.last7d },
              { k: "Opted in", v: data.stats.consented },
              { k: "Became customers", v: data.stats.byStatus.customer ?? 0 },
            ].map((s) => (
              <div key={s.k} className="rounded-lg bg-slate-50 py-2">
                <p className="text-lg font-semibold text-slate-900">{s.v}</p>
                <p className="text-[11px] text-slate-500">{s.k}</p>
              </div>
            ))}
          </div>
        )}

        {data && (
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <p className="text-sm font-medium text-slate-800 mr-auto">The series</p>
              <select
                className="h-8 rounded-md border border-slate-200 px-2 text-xs max-w-[220px]"
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value);
                  void load(e.target.value, venue);
                }}
                aria-label="Sample template"
                data-testid="template-leads-slug"
              >
                {data.templates.map((t) => (
                  <option key={t.slug} value={t.slug}>
                    {t.name}
                  </option>
                ))}
              </select>
              <select
                className="h-8 rounded-md border border-slate-200 px-2 text-xs"
                value={venue}
                onChange={(e) => {
                  setVenue(e.target.value);
                  void load(slug, e.target.value);
                }}
                aria-label="Sample venue type"
                data-testid="template-leads-venue"
              >
                {data.venueTypes.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
            <ul className="divide-y divide-slate-100 border rounded-lg">
              {data.previews.map((p) => (
                <li key={p.step} className="flex items-center gap-3 px-3 py-2" data-testid="template-leads-step">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-slate-500">{p.label}</p>
                    <p className="text-sm text-slate-900 truncate">{p.subject}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1 text-xs"
                    onClick={() => setOpen(p)}
                    data-testid="template-leads-preview"
                  >
                    <Eye className="h-3 w-3" /> Preview
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {data?.stats && data.recent.length > 0 && (
          <div data-testid="template-leads-recent">
            <div className="flex items-baseline gap-2 mb-2">
              <p className="text-sm font-medium text-slate-800">Leads — send the next email</p>
              <span className="text-xs text-slate-500" data-testid="template-leads-due-count">
                {dueNow === 0 ? "nothing due right now" : `${dueNow} due now`}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-slate-500 border-b">
                  <tr>
                    <th className="text-left py-1.5 font-medium">Lead</th>
                    <th className="text-left py-1.5 font-medium">Sent so far</th>
                    <th className="text-left py-1.5 font-medium">Next email</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.recent.map((l) => (
                    <tr key={l.id} className="border-b border-slate-100 align-top" data-testid="template-lead-row">
                      <td className="py-2 pr-2">
                        <p className="break-all text-slate-900 font-medium">{l.email}</p>
                        <p className="text-slate-500">
                          {l.firstSlug}
                          {l.slugs.length > 1 && <span className="text-slate-400"> +{l.slugs.length - 1}</span>}
                          {" · "}
                          {l.venueType ?? "venue ?"} · opt-in {l.marketingConsent ? "yes" : "no"} · {fmt(l.createdAt)}
                        </p>
                      </td>
                      <td className="py-2 pr-2" data-testid="template-lead-history">
                        {l.history.length === 0 ? (
                          <span className="text-slate-400">nothing yet</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {l.history.map((h, i) => (
                              <span
                                key={i}
                                title={h.error ?? (h.manual ? "sent by hand" : "sent automatically")}
                                className={`px-1.5 py-0.5 rounded ${
                                  h.skipped
                                    ? "bg-slate-100 text-slate-500 line-through"
                                    : h.ok
                                      ? "bg-emerald-50 text-emerald-700"
                                      : "bg-red-50 text-red-700"
                                }`}
                              >
                                {DAY_OF_STEP[h.step] ?? `Step ${h.step}`} {h.skipped ? "skipped" : h.ok ? "✓" : "failed"} {fmt(h.at)}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-2 pr-2" data-testid="template-lead-next">
                        {l.plan.nextStep === null ? (
                          <span className="text-slate-500">{l.plan.blocked}</span>
                        ) : (
                          <>
                            <p className="text-slate-800">
                              {l.plan.label}{" "}
                              {!l.plan.blocked && (
                                <span className={l.plan.due ? "text-emerald-700 font-medium" : "text-slate-500"}>
                                  · {dueText(l.plan)}
                                </span>
                              )}
                            </p>
                            <p className="text-slate-500 truncate max-w-[260px]">{l.plan.subject}</p>
                            {l.plan.blocked && <p className="text-amber-700">{l.plan.blocked}</p>}
                          </>
                        )}
                        {notes[l.id] && (
                          <p
                            className={`mt-1 text-[11px] flex items-center gap-1 ${notes[l.id].ok ? "text-emerald-700" : "text-red-600"}`}
                            data-testid="template-lead-note"
                          >
                            {notes[l.id].ok && <CheckCircle2 className="h-3 w-3" />}
                            {notes[l.id].text}
                          </p>
                        )}
                      </td>
                      <td className="py-2 text-right">
                        {l.plan.nextStep !== null && !l.plan.blocked && (
                          <div className="flex flex-wrap justify-end gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 gap-1 text-xs"
                              disabled={busy === `preview:${l.id}`}
                              onClick={() => void openLead(l)}
                              data-testid="template-lead-preview"
                            >
                              <Eye className="h-3 w-3" /> Preview
                            </Button>
                            <LeadActions l={l} armed={armed} busy={busy} setArmed={setArmed} act={act} />
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setOpen(null)}>
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
            data-testid="template-leads-modal"
          >
            <div className="flex items-start justify-between gap-3 p-4 border-b">
              <div className="min-w-0">
                <p className="text-xs text-slate-500">{open.label}</p>
                <p className="text-sm font-semibold text-slate-900">{open.subject}</p>
              </div>
              <button onClick={() => setOpen(null)} className="text-slate-400 hover:text-slate-600" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <iframe title="Email preview" srcDoc={open.html} className="w-full flex-1 min-h-[460px]" sandbox="" />
          </div>
        </div>
      )}
      {leadPreview && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setLeadPreview(null)}>
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
            data-testid="template-lead-modal"
          >
            <div className="flex items-start justify-between gap-3 p-4 border-b">
              <div className="min-w-0">
                <p className="text-xs text-slate-500">
                  To: {leadPreview.lead.email} · {leadPreview.lead.plan.label} · {dueText(leadPreview.lead.plan)}
                </p>
                <p className="text-sm font-semibold text-slate-900">{leadPreview.subject}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <LeadActions l={leadPreview.lead} armed={armed} busy={busy} setArmed={setArmed} act={act} />
                <button onClick={() => setLeadPreview(null)} className="text-slate-400 hover:text-slate-600" aria-label="Close">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            {notes[leadPreview.lead.id] && !notes[leadPreview.lead.id].ok && (
              <p className="px-4 py-2 text-xs text-red-600 border-b">{notes[leadPreview.lead.id].text}</p>
            )}
            <iframe title="Email preview" srcDoc={leadPreview.html} className="w-full flex-1 min-h-[460px]" sandbox="" />
          </div>
        </div>
      )}
    </Card>
  );
}

/** Send / Skip with a second click to confirm, like the Setup emails card. */
function LeadActions({
  l,
  armed,
  busy,
  setArmed,
  act,
}: {
  l: LeadRow;
  armed: string | null;
  busy: string | null;
  setArmed: (k: string | null) => void;
  act: (l: LeadRow, action: "send" | "skip") => void;
}) {
  const sending = busy === `send:${l.id}`;
  const skipping = busy === `skip:${l.id}`;
  const day = l.plan.nextStep === null ? "" : DAY_OF_STEP[l.plan.nextStep] ?? "";
  if (armed === `send:${l.id}` || sending) {
    return (
      <span className="inline-flex flex-wrap items-center justify-end gap-1">
        <Button size="sm" className="h-7 gap-1 text-xs" disabled={sending} onClick={() => act(l, "send")} data-testid="template-lead-send-confirm">
          {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
          {sending ? "Sending…" : `${l.plan.due ? "Send" : "Send early"} ${day} to ${l.email}`}
        </Button>
        {!sending && (
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setArmed(null)}>
            Cancel
          </Button>
        )}
      </span>
    );
  }
  if (armed === `skip:${l.id}` || skipping) {
    return (
      <span className="inline-flex flex-wrap items-center justify-end gap-1">
        <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" disabled={skipping} onClick={() => act(l, "skip")} data-testid="template-lead-skip-confirm">
          {skipping ? <Loader2 className="h-3 w-3 animate-spin" /> : <SkipForward className="h-3 w-3" />}
          {skipping ? "Skipping…" : `Skip ${day} (don't send it)`}
        </Button>
        {!skipping && (
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setArmed(null)}>
            Cancel
          </Button>
        )}
      </span>
    );
  }
  return (
    <span className="inline-flex gap-1.5">
      <Button size="sm" className="h-7 gap-1 text-xs" onClick={() => setArmed(`send:${l.id}`)} data-testid="template-lead-send">
        <Send className="h-3 w-3" /> {l.plan.due ? "Send" : "Send early"}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 gap-1 text-xs text-slate-500"
        onClick={() => setArmed(`skip:${l.id}`)}
        title="Move on to the next email without sending this one"
        data-testid="template-lead-skip"
      >
        <SkipForward className="h-3 w-3" /> Skip
      </Button>
    </span>
  );
}
