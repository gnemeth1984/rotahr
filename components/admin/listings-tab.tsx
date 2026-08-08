"use client";

/**
 * Paste-and-go listings tool.
 *
 * Paste addresses, press Build. Each one becomes a live venue page. Nothing is
 * emailed by that click.
 *
 * Sending is a second, per-row click, because the page is assembled by a model
 * reading someone's website and it will sometimes get the address or the food
 * wrong. A wrong page nobody has seen is a five-second delete; a wrong page
 * announced to its owner by cold email is a complaint. So the order is build,
 * open it, then send.
 */

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  Send,
  Trash2,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Link2,
  EyeOff,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface BuildRow {
  ok: boolean;
  email: string;
  businessId?: string;
  slug?: string;
  name?: string;
  sourceUrl?: string;
  address?: string | null;
  warnings?: string[];
  error?: string;
  needsUrl?: boolean;
}

interface PageRow {
  id: string;
  name: string;
  slug: string | null;
  email: string | null;
  address: string | null;
  noIndex: boolean;
  invited: boolean;
  leadStatus: string | null;
  lastContacted: string | null;
  createdAt: string;
}

async function post(body: Record<string, unknown>) {
  const res = await fetch("/api/admin/listings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, json } as { ok: boolean; json: Record<string, unknown> };
}

export function ListingsTab() {
  const [emails, setEmails] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [nameOverride, setNameOverride] = useState("");
  const [building, setBuilding] = useState(false);
  const [results, setResults] = useState<BuildRow[] | null>(null);
  const [pages, setPages] = useState<PageRow[]>([]);
  const [loadingPages, setLoadingPages] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [cityById, setCityById] = useState<Record<string, string>>({});
  const [hookById, setHookById] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<{ subject: string; html: string; to: string } | null>(null);

  const emailCount = emails.split(/[\s,;]+/).filter((s) => s.includes("@")).length;
  const single = emailCount === 1;

  const loadPages = useCallback(async () => {
    setLoadingPages(true);
    try {
      const res = await fetch("/api/admin/listings");
      const json = await res.json();
      setPages(Array.isArray(json.pages) ? json.pages : []);
    } finally {
      setLoadingPages(false);
    }
  }, []);

  useEffect(() => {
    void loadPages();
  }, [loadPages]);

  async function build() {
    setBuilding(true);
    setMsg(null);
    setResults(null);
    const { ok, json } = await post({
      action: "build",
      emails,
      sourceUrl: single && sourceUrl.trim() ? sourceUrl.trim() : null,
      name: single && nameOverride.trim() ? nameOverride.trim() : null,
    });
    setBuilding(false);
    if (!ok) {
      setMsg({ kind: "err", text: String(json.error || "Build failed.") });
      return;
    }
    setResults((json.results as BuildRow[]) || []);
    void loadPages();
  }

  async function sendInvite(id: string, name: string) {
    if (!confirm(`Send the invite email for ${name}? This goes to a real venue and can't be undone.`)) return;
    setBusyId(id);
    setMsg(null);
    const { ok, json } = await post({
      action: "send",
      businessId: id,
      city: cityById[id] || undefined,
      hook: hookById[id] || undefined,
    });
    setBusyId(null);
    setMsg(
      ok
        ? { kind: "ok", text: `Sent to ${String(json.to)} — "${String(json.subject)}"` }
        : { kind: "err", text: String(json.error || "Send failed.") }
    );
    void loadPages();
  }

  async function previewInvite(id: string) {
    setBusyId(id);
    const { ok, json } = await post({ action: "preview", businessId: id, hook: hookById[id] || undefined });
    setBusyId(null);
    if (!ok) {
      setMsg({ kind: "err", text: String(json.error || "Preview failed.") });
      return;
    }
    setPreview({ subject: String(json.subject), html: String(json.html), to: String(json.to) });
  }

  async function discard(id: string, name: string) {
    if (!confirm(`Delete the page for ${name}? Use this for pages we built wrong — it does not record a takedown request.`))
      return;
    setBusyId(id);
    const { ok, json } = await post({ action: "discard", businessId: id });
    setBusyId(null);
    if (!ok) setMsg({ kind: "err", text: String(json.error || "Delete failed.") });
    void loadPages();
  }

  return (
    <div className="space-y-6">
      {/* ─── Build ─────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="font-semibold text-slate-900">Build pages from email addresses</h3>
        <p className="text-sm text-slate-500 mt-1">
          Paste one address or a whole list. Each one gets its website read and a live page built. Nothing is
          emailed by this button.
        </p>

        <textarea
          value={emails}
          onChange={(e) => setEmails(e.target.value)}
          rows={4}
          spellCheck={false}
          placeholder={"info@thealgiersinn.ie\nbookings@somewhere.co.uk"}
          className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-400"
        />

        {single && (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Input
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="Website / Facebook / Google Maps link (optional)"
            />
            <Input
              value={nameOverride}
              onChange={(e) => setNameOverride(e.target.value)}
              placeholder="Venue name (optional)"
            />
          </div>
        )}
        {!single && emailCount > 1 && (
          <p className="mt-2 text-xs text-slate-500">
            {emailCount} addresses — the URL and name overrides only apply to a single address.
          </p>
        )}

        <div className="mt-4 flex items-center gap-3">
          <Button onClick={build} disabled={building || emailCount === 0}>
            {building ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            {building ? "Building…" : `Build ${emailCount || ""} page${emailCount === 1 ? "" : "s"}`.trim()}
          </Button>
          {building && (
            <span className="text-xs text-slate-500">
              Reading each site and reconciling it — about 20&ndash;40s per address.
            </span>
          )}
        </div>
      </div>

      {msg && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm flex items-start gap-2 ${
            msg.kind === "ok"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          {msg.kind === "ok" ? (
            <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
          ) : (
            <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
          )}
          <span>{msg.text}</span>
        </div>
      )}

      {/* ─── Build results ─────────────────────────────────────────────── */}
      {results && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-900 mb-3">Build results</h3>
          <div className="space-y-3">
            {results.map((r) => (
              <div
                key={r.email}
                className={`rounded-lg border px-4 py-3 text-sm ${
                  r.ok ? "border-emerald-200 bg-emerald-50/50" : "border-amber-200 bg-amber-50/50"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900">
                      {r.ok ? r.name : r.email}
                    </p>
                    {r.ok ? (
                      <p className="text-slate-600 text-xs mt-0.5">
                        {r.email} &middot; built from {r.sourceUrl}
                      </p>
                    ) : (
                      <p className="text-amber-800 text-xs mt-0.5">{r.error}</p>
                    )}
                    {r.ok && r.address && <p className="text-slate-600 text-xs mt-1">{r.address}</p>}
                    {r.ok && r.warnings && r.warnings.length > 0 && (
                      <ul className="mt-2 space-y-0.5">
                        {r.warnings.map((w, i) => (
                          <li key={i} className="text-xs text-amber-700 flex gap-1.5">
                            <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                            {w}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {r.ok && r.slug && (
                    <a
                      href={`/v/${r.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-orange-600 hover:underline text-xs whitespace-nowrap flex items-center gap-1"
                    >
                      Open page <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                {!r.ok && r.needsUrl && (
                  <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                    <Link2 className="h-3 w-3" /> Paste this address on its own with a link to retry.
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Existing pages ───────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-semibold text-slate-900">Prospect pages</h3>
          <Button variant="outline" size="sm" onClick={() => void loadPages()} disabled={loadingPages}>
            {loadingPages ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-sm text-slate-500 mb-4">
          Look at the page before sending. Send is one click and cannot be recalled.
        </p>

        {loadingPages && pages.length === 0 ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : pages.length === 0 ? (
          <p className="text-sm text-slate-400">No prospect pages yet.</p>
        ) : (
          <div className="space-y-3">
            {pages.map((p) => (
              <div key={p.id} className="rounded-lg border border-slate-200 px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-slate-900">{p.name}</span>
                      {p.invited ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                          invited
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          not sent
                        </span>
                      )}
                      {p.leadStatus && !p.invited && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                          lead: {p.leadStatus}
                        </span>
                      )}
                      {p.noIndex && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 flex items-center gap-1">
                          <EyeOff className="h-3 w-3" /> noindex
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                      {p.email || "no email"}
                      {p.address ? ` · ${p.address}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.slug && (
                      <a
                        href={`/v/${p.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-orange-600 hover:underline flex items-center gap-1"
                      >
                        /v/{p.slug} <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>

                {!p.invited && p.email && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-[140px_1fr_auto_auto]">
                    <Input
                      value={cityById[p.id] || ""}
                      onChange={(e) => setCityById((s) => ({ ...s, [p.id]: e.target.value }))}
                      placeholder="Town (subject)"
                      className="text-sm"
                    />
                    <Input
                      value={hookById[p.id] || ""}
                      onChange={(e) => setHookById((s) => ({ ...s, [p.id]: e.target.value }))}
                      placeholder="One personal line — proves a human looked (optional)"
                      className="text-sm"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void previewInvite(p.id)}
                      disabled={busyId === p.id}
                    >
                      <Eye className="h-4 w-4 mr-1" /> Preview
                    </Button>
                    <Button size="sm" onClick={() => void sendInvite(p.id, p.name)} disabled={busyId === p.id}>
                      {busyId === p.id ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4 mr-1" />
                      )}
                      Send invite
                    </Button>
                  </div>
                )}

                <div className="mt-2">
                  <button
                    onClick={() => void discard(p.id, p.name)}
                    disabled={busyId === p.id}
                    className="text-xs text-slate-400 hover:text-red-600 flex items-center gap-1"
                  >
                    <Trash2 className="h-3 w-3" /> Delete page (built wrong)
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Invite preview ───────────────────────────────────────────── */}
      {preview && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-6 overflow-y-auto"
          onClick={() => setPreview(null)}
        >
          <div
            className="bg-white rounded-xl max-w-2xl w-full p-5 mt-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <p className="text-xs text-slate-500">To {preview.to}</p>
                <p className="font-semibold text-slate-900">{preview.subject}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setPreview(null)}>
                Close
              </Button>
            </div>
            <div
              className="border border-slate-200 rounded-lg p-4 text-sm"
              dangerouslySetInnerHTML={{ __html: preview.html }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
