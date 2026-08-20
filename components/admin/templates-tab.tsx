"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Download, Mail, RefreshCw } from "lucide-react";
import { freeTemplates } from "@/lib/templates";

interface RequestRow {
  id: string;
  request: string;
  email: string | null;
  venueType: string | null;
  status: string;
  fulfilledBy: string | null;
  notifiedAt: string | null;
  adminNote: string | null;
  createdAt: string;
}

const STATUSES = ["new", "planned", "shipped", "rejected"] as const;

const STATUS_STYLE: Record<string, string> = {
  new: "bg-amber-100 text-amber-700",
  planned: "bg-blue-100 text-blue-700",
  shipped: "bg-emerald-100 text-emerald-700",
  rejected: "bg-slate-100 text-slate-500",
};

export function TemplatesTab() {
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [downloads, setDownloads] = useState<{ slug: string; count: number }[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/template-requests");
      const data = await res.json();
      setRows(data.requests ?? []);
      setDownloads(data.downloads7d ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function patch(id: string, body: Record<string, unknown>) {
    setBusy(id);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/template-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...body }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || "Failed");
        return;
      }
      if (data.emailed) setMsg("Emailed the requester.");
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...data.request } : r)),
      );
    } finally {
      setBusy(null);
    }
  }

  const visible =
    filter === "all" ? rows : rows.filter((r) => r.status === filter);
  const totalDownloads = downloads.reduce((a, b) => a + b.count, 0);
  const dlMap = new Map(downloads.map((d) => [d.slug, d.count]));

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Templates live
          </p>
          <p className="text-2xl font-semibold text-slate-900">
            {freeTemplates.length}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Downloads (7d)
          </p>
          <p className="text-2xl font-semibold text-slate-900">
            {totalDownloads}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Open requests
          </p>
          <p className="text-2xl font-semibold text-slate-900">
            {rows.filter((r) => r.status === "new").length}
          </p>
        </div>
      </div>

      {msg && (
        <p className="rounded-lg bg-slate-100 px-4 py-2 text-sm text-slate-700">
          {msg}
        </p>
      )}

      <div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-900">Requests</h3>
          <div className="ml-auto flex items-center gap-2">
            {["all", ...STATUSES].map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  filter === s
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {s}
              </button>
            ))}
            <button
              onClick={load}
              className="rounded-full bg-slate-100 p-1.5 text-slate-600 hover:bg-slate-200"
              title="Reload"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : visible.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
            No requests {filter === "all" ? "yet" : `with status "${filter}"`}.
          </p>
        ) : (
          <div className="space-y-3">
            {visible.map((r) => (
              <div
                key={r.id}
                className="rounded-xl border border-slate-200 bg-white p-4"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span
                    className={`rounded-full px-2 py-0.5 font-medium ${
                      STATUS_STYLE[r.status] ?? "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {r.status}
                  </span>
                  <span>{new Date(r.createdAt).toLocaleDateString()}</span>
                  {r.venueType && <span>· {r.venueType}</span>}
                  {r.email ? (
                    <span>· {r.email}</span>
                  ) : (
                    <span>· no email</span>
                  )}
                  {r.notifiedAt && (
                    <span className="text-emerald-600">
                      · emailed {new Date(r.notifiedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <p className="mb-3 text-sm text-slate-800">{r.request}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={r.status}
                    onChange={(e) => patch(r.id, { status: e.target.value })}
                    disabled={busy === r.id}
                    className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <select
                    value={r.fulfilledBy ?? ""}
                    onChange={(e) =>
                      patch(r.id, { fulfilledBy: e.target.value || null })
                    }
                    disabled={busy === r.id}
                    className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                  >
                    <option value="">— answered by —</option>
                    {freeTemplates.map((t) => (
                      <option key={t.slug} value={t.slug}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() =>
                      patch(r.id, { notify: true, status: "shipped" })
                    }
                    disabled={
                      busy === r.id ||
                      !r.email ||
                      !r.fulfilledBy ||
                      Boolean(r.notifiedAt)
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1 text-xs font-medium text-white disabled:opacity-40"
                    title={
                      !r.email
                        ? "No email address on this request"
                        : !r.fulfilledBy
                          ? "Pick the template that answers it first"
                          : r.notifiedAt
                            ? "Already emailed"
                            : "Email the requester"
                    }
                  >
                    {busy === r.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Mail className="h-3 w-3" />
                    )}
                    Email it
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-900">
          Downloads by template (last 7 days)
        </h3>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <tbody>
              {freeTemplates
                .map((t) => ({ t, n: dlMap.get(t.slug) ?? 0 }))
                .sort((a, b) => b.n - a.n)
                .map(({ t, n }) => (
                  <tr key={t.slug} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-2 text-slate-800">{t.name}</td>
                    <td className="px-4 py-2 text-right font-medium text-slate-900">
                      {n}
                    </td>
                    <td className="w-10 px-4 py-2 text-right">
                      <a
                        href={`/templates/${t.slug}`}
                        target="_blank"
                        rel="noopener"
                        className="text-slate-400 hover:text-slate-700"
                        title="Open page"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </a>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Counted from the click beacon on each template page. Someone linking a
          PDF directly won&apos;t appear here.
        </p>
      </div>
    </div>
  );
}
