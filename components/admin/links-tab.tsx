"use client";

/**
 * Off-site visibility pipeline.
 *
 * The one SEO gap the automated stack doesn't cover: rotahr.com has no inbound
 * links, which is why 144 indexable pages and 71 articles have produced 5
 * pages with any impressions at all. This tab tracks the manual asks that fix
 * it — directories, trade press, associations, guest posts.
 *
 * No send button by design. These contacts convert once; a cron would burn the
 * list. The tab's job is that nothing is forgotten and nothing is asked twice.
 */

import { useCallback, useEffect, useState } from "react";
import {
  ExternalLink,
  Link2,
  Loader2,
  RefreshCw,
  Clock,
  CheckCircle2,
  Copy,
  Check,
  AlertTriangle,
} from "lucide-react";

type Row = {
  id: string;
  name: string;
  url: string;
  kind: string;
  region: string;
  contactEmail: string | null;
  contactName: string | null;
  contactNote: string | null;
  weight: number;
  angle: string | null;
  status: string;
  liveUrl: string | null;
  sentAt: string | null;
  liveAt: string | null;
  followUpAt: string | null;
  notes: string | null;
  source: string | null;
  discoveredVia: string | null;
  submitUrl: string | null;
  pitch: string | null;
  lastCheckedAt: string | null;
  lastCheckOk: boolean | null;
  checkFailures: number;
  taskedAt: string | null;
};

type Payload = {
  rows: Row[];
  stats: {
    total: number;
    byStatus: Record<string, number>;
    live: number;
    dueFollowUps: number;
    checksFailing: number;
    handedToYou: number;
  };
};

const STATUSES = ["new", "queued", "sent", "live", "rejected", "no_reply"];

const KIND_LABEL: Record<string, string> = {
  directory: "Directory",
  press: "Press",
  guest_post: "Guest post",
  podcast: "Podcast",
  community: "Community",
  partner: "Partner",
};

function statusClass(s: string) {
  if (s === "live") return "bg-emerald-100 text-emerald-700";
  if (s === "sent") return "bg-amber-100 text-amber-700";
  if (s === "queued") return "bg-blue-100 text-blue-700";
  if (s === "rejected") return "bg-red-100 text-red-700";
  if (s === "no_reply") return "bg-slate-200 text-slate-600";
  return "bg-slate-100 text-slate-500";
}

export function LinksTab() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/links");
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function patch(id: string, body: Record<string, unknown>) {
    setBusy(id);
    try {
      const res = await fetch("/api/admin/links", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...body }),
      });
      if (res.ok) await load();
    } finally {
      setBusy(null);
    }
  }

  function copy(text: string, id: string) {
    void navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  }

  if (loading && !data) {
    return (
      <div className="flex items-center gap-2 py-12 text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading pipeline…
      </div>
    );
  }
  if (!data) return <p className="py-12 text-slate-500">Could not load the pipeline.</p>;

  const kinds = ["all", ...Array.from(new Set(data.rows.map((r) => r.kind)))];
  const rows = kindFilter === "all" ? data.rows : data.rows.filter((r) => r.kind === kindFilter);

  return (
    <div className="space-y-5">
      {/* Why this tab exists — the numbers that justify the manual work. */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-medium">Every free placement, and whether it is still up.</p>
        <p className="mt-1 text-amber-800">
          Discovery adds new targets every Tuesday. Two a week are pushed to you as Navigator
          tasks under <span className="font-medium">Visibility</span> with the copy already
          written — that is where you do them. This tab is the ledger: what was submitted, what
          went live, and which live links have quietly stopped pointing at rotahr.com. The
          liveness check runs every Saturday.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Links live" value={data.stats.live} tone="emerald" />
        <Stat
          label="Handed to you"
          value={data.stats.handedToYou}
          tone={data.stats.handedToYou ? "amber" : "slate"}
        />
        <Stat
          label="Follow-ups due"
          value={data.stats.dueFollowUps}
          tone={data.stats.dueFollowUps ? "red" : "slate"}
        />
        <Stat
          label="Live links broken"
          value={data.stats.checksFailing}
          tone={data.stats.checksFailing ? "red" : "slate"}
        />
      </div>

      {/* Filter */}
      <div className="flex flex-wrap items-center gap-2">
        {kinds.map((k) => (
          <button
            key={k}
            onClick={() => setKindFilter(k)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              kindFilter === k
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {k === "all" ? "All" : KIND_LABEL[k] ?? k}
          </button>
        ))}
        <button
          onClick={() => void load()}
          className="ml-auto flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {/* Rows */}
      <div className="space-y-2">
        {rows.map((r) => {
          const isOpen = open === r.id;
          const overdue =
            r.status === "sent" && r.followUpAt && new Date(r.followUpAt).getTime() <= Date.now();
          return (
            <div key={r.id} className="rounded-lg border border-slate-200 bg-white">
              <div className="flex flex-wrap items-center gap-2 p-3">
                <button
                  onClick={() => setOpen(isOpen ? null : r.id)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <span className="truncate font-medium text-slate-900">{r.name}</span>
                  <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500">
                    {KIND_LABEL[r.kind] ?? r.kind}
                  </span>
                  {r.region !== "general" && (
                    <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] uppercase text-slate-500">
                      {r.region}
                    </span>
                  )}
                  <span className="shrink-0 text-[11px] text-slate-400">w{r.weight}</span>
                </button>

                {r.taskedAt && r.status !== "live" && (
                  <span
                    className="shrink-0 rounded bg-indigo-100 px-1.5 py-0.5 text-[11px] font-medium text-indigo-700"
                    title={`Handed to you as a Navigator task on ${new Date(r.taskedAt).toLocaleDateString()}`}
                  >
                    in your queue
                  </span>
                )}

                {r.lastCheckOk === false && (
                  <span
                    className="flex shrink-0 items-center gap-1 rounded bg-red-100 px-1.5 py-0.5 text-[11px] font-medium text-red-700"
                    title="The page no longer returns 200 with a rotahr mention"
                  >
                    <AlertTriangle className="h-3 w-3" /> link gone? ({r.checkFailures})
                  </span>
                )}

                {overdue && (
                  <span className="flex shrink-0 items-center gap-1 rounded bg-red-100 px-1.5 py-0.5 text-[11px] font-medium text-red-700">
                    <Clock className="h-3 w-3" /> follow up
                  </span>
                )}

                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${statusClass(r.status)}`}
                >
                  {r.status}
                </span>

                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-slate-400 hover:text-slate-700"
                  title={r.url}
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>

              {isOpen && (
                <div className="space-y-3 border-t border-slate-100 p-3 text-sm">
                  {r.angle && (
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Angle
                      </p>
                      <p className="text-slate-700">{r.angle}</p>
                    </div>
                  )}

                  {r.contactNote && (
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                        How to submit
                      </p>
                      <p className="text-slate-600">{r.contactNote}</p>
                    </div>
                  )}

                  {r.contactEmail && (
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Contact
                      </p>
                      <code className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-800">
                        {r.contactEmail}
                      </code>
                      {r.contactName && (
                        <span className="text-xs text-slate-500">{r.contactName}</span>
                      )}
                      <button
                        onClick={() => copy(r.contactEmail!, r.id)}
                        className="flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                      >
                        {copied === r.id ? (
                          <>
                            <Check className="h-3 w-3" /> copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" /> copy
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {r.submitUrl && (
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Submission form
                      </p>
                      <a
                        href={r.submitUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 break-all text-xs text-blue-700 hover:underline"
                      >
                        <ExternalLink className="h-3 w-3 shrink-0" /> {r.submitUrl}
                      </a>
                    </div>
                  )}

                  {r.pitch && (
                    <div>
                      <div className="mb-1 flex items-center gap-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Copy to paste
                        </p>
                        <button
                          onClick={() => copy(r.pitch!, `${r.id}:pitch`)}
                          className="flex items-center gap-1 rounded border border-slate-200 px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-50"
                        >
                          {copied === `${r.id}:pitch` ? (
                            <>
                              <Check className="h-3 w-3" /> copied
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" /> copy
                            </>
                          )}
                        </button>
                      </div>
                      <p className="whitespace-pre-wrap rounded bg-slate-50 p-2 text-xs leading-relaxed text-slate-700">
                        {r.pitch}
                      </p>
                    </div>
                  )}

                  {/* Status control */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {STATUSES.map((s) => (
                      <button
                        key={s}
                        disabled={busy === r.id || r.status === s}
                        onClick={() => void patch(r.id, { status: s })}
                        className={`rounded px-2 py-1 text-xs font-medium transition-colors disabled:opacity-40 ${
                          r.status === s
                            ? statusClass(s)
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                    {busy === r.id && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />}
                  </div>

                  {/* Live URL — the only outcome that counts. */}
                  <LiveUrlField row={r} onSave={(v) => patch(r.id, { liveUrl: v, status: v ? "live" : r.status })} />

                  <p className="text-xs text-slate-400">
                    {r.sentAt && <>sent {new Date(r.sentAt).toLocaleDateString()}</>}
                    {r.sentAt && r.followUpAt && (
                      <> · follow up {new Date(r.followUpAt).toLocaleDateString()}</>
                    )}
                    {r.liveAt && <> · live {new Date(r.liveAt).toLocaleDateString()}</>}
                    {r.lastCheckedAt && (
                      <>
                        {" "}
                        · checked {new Date(r.lastCheckedAt).toLocaleDateString()}{" "}
                        <span className={r.lastCheckOk === false ? "text-red-600" : "text-emerald-600"}>
                          {r.lastCheckOk === false
                            ? `failed ${r.checkFailures}×`
                            : "still pointing at rotahr.com"}
                        </span>
                      </>
                    )}
                    {r.source === "discovery" && (
                      <> · found automatically{r.discoveredVia ? ` (${r.discoveredVia})` : ""}</>
                    )}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LiveUrlField({ row, onSave }: { row: Row; onSave: (v: string) => void }) {
  const [v, setV] = useState(row.liveUrl ?? "");
  const dirty = v.trim() !== (row.liveUrl ?? "");
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Live mention URL
      </p>
      <div className="flex gap-2">
        <input
          value={v}
          onChange={(e) => setV(e.target.value)}
          placeholder="https://…"
          className="min-w-0 flex-1 rounded border border-slate-200 px-2 py-1.5 text-xs focus:border-slate-400 focus:outline-none"
        />
        <button
          disabled={!dirty}
          onClick={() => onSave(v.trim())}
          className="flex shrink-0 items-center gap-1 rounded bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-30"
        >
          <CheckCircle2 className="h-3.5 w-3.5" /> Save
        </button>
      </div>
      {row.liveUrl && (
        <a
          href={row.liveUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex items-center gap-1 text-xs text-emerald-700 hover:underline"
        >
          <Link2 className="h-3 w-3" /> {row.liveUrl}
        </a>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: number;
  tone?: "slate" | "emerald" | "amber" | "red";
}) {
  const tones = {
    slate: "text-slate-900",
    emerald: "text-emerald-600",
    amber: "text-amber-600",
    red: "text-red-600",
  };
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-0.5 text-xl font-semibold ${tones[tone]}`}>{value}</p>
    </div>
  );
}
