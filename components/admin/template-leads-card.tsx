"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, FileDown, Info, Eye, X, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Preview {
  step: number;
  label: string;
  subject: string;
  html: string;
  text: string;
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

function stepText(l: LeadRow) {
  if (l.status !== "active") return l.status;
  return l.step === 0 ? "awaiting day 0" : `sent ${l.step}/4`;
}

/** Free-template leads + read-only preview of the 4-email follow-up series. */
export function TemplateLeadsCard() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [slug, setSlug] = useState("");
  const [venue, setVenue] = useState("");
  const [open, setOpen] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);

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
                ? "Follow-up emails are ON (TEMPLATE_EMAILS_ENABLED=1)."
                : "Follow-up emails are OFF. Leads are collected; nothing is sent. Review the 4 emails below, then set TEMPLATE_EMAILS_ENABLED=1 in Vercel."}{" "}
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
          <details className="text-xs" data-testid="template-leads-recent">
            <summary className="cursor-pointer text-slate-600">Recent leads ({data.recent.length})</summary>
            <table className="w-full mt-2">
              <thead className="text-slate-500 border-b">
                <tr>
                  <th className="text-left py-1.5 font-medium">Email</th>
                  <th className="text-left py-1.5 font-medium">Template</th>
                  <th className="text-left py-1.5 font-medium">Venue</th>
                  <th className="text-left py-1.5 font-medium">Opt-in</th>
                  <th className="text-left py-1.5 font-medium">Series</th>
                  <th className="text-left py-1.5 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map((l) => (
                  <tr key={l.id} className="border-b border-slate-100">
                    <td className="py-1.5 break-all text-slate-800">{l.email}</td>
                    <td className="py-1.5 text-slate-600">
                      {l.firstSlug}
                      {l.slugs.length > 1 && <span className="text-slate-400"> +{l.slugs.length - 1}</span>}
                    </td>
                    <td className="py-1.5 text-slate-600">{l.venueType ?? "—"}</td>
                    <td className="py-1.5">{l.marketingConsent ? "yes" : "no"}</td>
                    <td className="py-1.5 text-slate-600">{stepText(l)}</td>
                    <td className="py-1.5 text-slate-500">{fmt(l.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
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
    </Card>
  );
}
