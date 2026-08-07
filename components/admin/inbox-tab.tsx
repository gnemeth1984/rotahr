"use client";

/**
 * AI Inbox — review and send replies to mail arriving at sales@rotahr.com.
 *
 * The assistant never sends on its own. Every reply here is read by a human and
 * sent with an explicit click, which is why the draft is an editable textarea
 * and not a read-only preview.
 */

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  RefreshCw,
  Send,
  Archive,
  Sparkles,
  AlertTriangle,
  Mail,
  CheckCircle2,
  Bot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface InboxMessage {
  id: string;
  fromEmail: string;
  fromName: string | null;
  subject: string;
  bodyText: string;
  receivedAt: string;
  isAutomated: boolean;
  category: string | null;
  intent: string | null;
  sentiment: string | null;
  confidence: number | null;
  needsHuman: boolean;
  escalationReason: string | null;
  draftSubject: string | null;
  draftBody: string | null;
  status: string;
  sentAt: string | null;
  error: string | null;
}

interface Stats {
  byStatus: Record<string, number>;
  byCategory: Record<string, number>;
  needsHuman: number;
  withErrors: number;
  lastSyncAt: string | null;
  lastError: string | null;
  imapConfigured: boolean;
}

const FILTERS = [
  { key: "drafted", label: "Ready to review" },
  { key: "needs-human", label: "Needs you" },
  { key: "sent", label: "Replied" },
  { key: "ignored", label: "Ignored" },
  { key: "archived", label: "Archived" },
  { key: "all", label: "All" },
];

const CATEGORY_STYLES: Record<string, string> = {
  sales: "bg-emerald-100 text-emerald-700",
  "outreach-reply": "bg-blue-100 text-blue-700",
  partner: "bg-violet-100 text-violet-700",
  support: "bg-amber-100 text-amber-700",
  billing: "bg-rose-100 text-rose-700",
  press: "bg-sky-100 text-sky-700",
  spam: "bg-slate-200 text-slate-600",
  other: "bg-slate-100 text-slate-600",
};

export function InboxTab() {
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [filter, setFilter] = useState("drafted");
  const [selected, setSelected] = useState<InboxMessage | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/inbox/messages?status=${filter}&limit=60`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load");
      setMessages(json.messages ?? []);
      setStats(json.stats ?? null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load inbox");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  useEffect(() => {
    setDraft(selected?.draftBody ?? "");
  }, [selected]);

  async function sync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/inbox/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ limit: 25 }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || "Sync failed");
      toast.success(
        `Fetched ${json.fetched} · drafted ${json.analysed}` +
          (json.skippedAutomated ? ` · skipped ${json.skippedAutomated} automated` : "")
      );
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  async function patch(id: string, body: Record<string, unknown>, okMsg?: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/inbox/messages/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      if (okMsg) toast.success(okMsg);
      if (json.message) setSelected(json.message);
      await load();
      return json.message as InboxMessage;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function send(msg: InboxMessage) {
    if (!draft.trim()) return toast.error("Draft is empty");
    if (!confirm(`Send this reply to ${msg.fromEmail}?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/inbox/messages/${msg.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: draft }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Send failed");
      toast.success(`Replied to ${msg.fromEmail}`);
      setSelected(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Send failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading inbox…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Setup warning */}
      {stats && !stats.imapConfigured && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Mailbox not connected</p>
            <p>Set INBOX_IMAP_PASSWORD in the environment to let Rotahr read sales@rotahr.com.</p>
          </div>
        </div>
      )}
      {stats?.lastError && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Last sync failed</p>
            <p className="break-all">{stats.lastError}</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <Bot className="h-5 w-5 text-emerald-600" /> AI Inbox
          </h2>
          <p className="text-sm text-slate-500">
            sales@rotahr.com · drafts are never sent automatically
            {stats?.lastSyncAt && ` · last checked ${new Date(stats.lastSyncAt).toLocaleString()}`}
          </p>
        </div>
        <Button onClick={sync} disabled={syncing} size="sm">
          {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Check for new mail
        </Button>
      </div>

      {/* Counters */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Ready to review" value={stats.byStatus.drafted ?? 0} tone="emerald" />
          <Stat label="Needs you" value={stats.needsHuman} tone="amber" />
          <Stat label="Replied" value={stats.byStatus.sent ?? 0} tone="slate" />
          <Stat label="Ignored" value={stats.byStatus.ignored ?? 0} tone="slate" />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => {
              setFilter(f.key);
              setSelected(null);
            }}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filter === f.key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        {/* List */}
        <div className="space-y-2">
          {messages.length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
              <Mail className="mx-auto mb-2 h-5 w-5 text-slate-400" />
              Nothing here.
            </div>
          )}
          {messages.map((m) => (
            <button
              key={m.id}
              onClick={() => setSelected(m)}
              className={`w-full rounded-lg border p-3 text-left transition-colors ${
                selected?.id === m.id
                  ? "border-emerald-500 bg-emerald-50"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="truncate text-sm font-medium text-slate-900">
                  {m.fromName || m.fromEmail}
                </span>
                <span className="shrink-0 text-[11px] text-slate-400">
                  {new Date(m.receivedAt).toLocaleDateString()}
                </span>
              </div>
              <p className="truncate text-xs text-slate-600">{m.subject}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1">
                {m.category && (
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${CATEGORY_STYLES[m.category] ?? CATEGORY_STYLES.other}`}>
                    {m.category}
                  </span>
                )}
                {m.needsHuman && (
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                    needs you
                  </span>
                )}
                {m.status === "sent" && (
                  <span className="inline-flex items-center gap-0.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                    <CheckCircle2 className="h-2.5 w-2.5" /> replied
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Detail */}
        <div>
          {!selected ? (
            <div className="rounded-lg border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">
              Select a message to review its draft.
            </div>
          ) : (
            <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">{selected.subject}</p>
                <p className="text-xs text-slate-500">
                  {selected.fromName ? `${selected.fromName} · ` : ""}
                  {selected.fromEmail} · {new Date(selected.receivedAt).toLocaleString()}
                </p>
              </div>

              {selected.intent && (
                <div className="rounded bg-slate-50 p-2.5 text-xs text-slate-600">
                  <span className="font-medium text-slate-700">What they want: </span>
                  {selected.intent}
                  {typeof selected.confidence === "number" && (
                    <span className="ml-1 text-slate-400">
                      (confidence {Math.round(selected.confidence * 100)}%)
                    </span>
                  )}
                </div>
              )}

              {selected.needsHuman && (
                <div className="flex items-start gap-2 rounded border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-800">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    <strong>Write this one yourself.</strong>{" "}
                    {selected.escalationReason || "Flagged for human review."}
                  </span>
                </div>
              )}

              <details className="rounded border border-slate-200">
                <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-slate-600">
                  Original message
                </summary>
                <pre className="max-h-64 overflow-auto whitespace-pre-wrap px-3 pb-3 text-xs text-slate-700">
                  {selected.bodyText}
                </pre>
              </details>

              {selected.status === "sent" ? (
                <div className="rounded border border-emerald-200 bg-emerald-50 p-3">
                  <p className="mb-1 text-xs font-medium text-emerald-800">
                    Replied {selected.sentAt ? new Date(selected.sentAt).toLocaleString() : ""}
                  </p>
                  <pre className="whitespace-pre-wrap text-xs text-slate-700">{selected.draftBody}</pre>
                </div>
              ) : (
                <>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">
                      Reply (edit before sending)
                    </label>
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      rows={12}
                      placeholder="No draft — write the reply yourself."
                      className="w-full rounded-lg border border-slate-300 p-3 text-sm focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => send(selected)} disabled={busy || !draft.trim()} size="sm">
                      {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                      Send reply
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => patch(selected.id, { regenerate: true }, "Draft regenerated")}
                    >
                      <Sparkles className="mr-2 h-4 w-4" /> Regenerate
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy || draft === selected.draftBody}
                      onClick={() => patch(selected.id, { draftBody: draft }, "Draft saved")}
                    >
                      Save draft
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => patch(selected.id, { status: "archived" }, "Archived")}
                    >
                      <Archive className="mr-2 h-4 w-4" /> Archive
                    </Button>
                  </div>
                </>
              )}

              {selected.error && (
                <p className="rounded bg-rose-50 p-2 text-xs text-rose-700">{selected.error}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  const tones: Record<string, string> = {
    emerald: "text-emerald-700",
    amber: "text-amber-700",
    slate: "text-slate-700",
  };
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-xl font-semibold ${tones[tone] ?? tones.slate}`}>{value}</p>
    </div>
  );
}
