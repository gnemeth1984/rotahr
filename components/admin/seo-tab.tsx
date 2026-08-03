"use client";

/**
 * SEO Autopilot tab.
 *
 * Shows the three loops and lets Gabor run any of them on demand:
 *   Harvest keywords  → free research (Google Suggest + Search Console)
 *   Publish article   → writes the next highest-scoring query
 *   Refresh           → improves whatever ranks 4-20
 *
 * Deliberately shows the setup state up front: without Search Console connected
 * the system still publishes, but it's blind to rankings, and pretending
 * otherwise would be worse than saying so.
 */

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  Search,
  Sparkles,
  RefreshCw,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type QueueRow = {
  id: string;
  keyword: string;
  cluster: string;
  intent: string;
  priority: number;
  impressions: number;
  clicks: number;
  position: number | null;
  source: string;
};

type StrikingRow = {
  id: string;
  keyword: string;
  position: number | null;
  impressions: number;
  clicks: number;
  status: string;
};

type RunRow = { id: string; task: string; ok: boolean; detail: string; createdAt: string };

type SeoData = {
  config: { searchConsole: boolean; indexNow: boolean; openai: boolean; cronSecret: boolean };
  counts: {
    totalKeywords: number;
    queued: number;
    written: number;
    skipped: number;
    posts: number;
    withKeyword: number;
    refreshed: number;
  };
  topQueue: QueueRow[];
  striking: StrikingRow[];
  clusters: { cluster: string; count: number }[];
  runs: RunRow[];
  recentPosts: {
    slug: string;
    title: string;
    keyword: string | null;
    wordCount: number | null;
    refreshCount: number;
    createdAt: string;
  }[];
  trend: { date: string; clicks: number; impressions: number }[];
};

const INTENT_STYLE: Record<string, string> = {
  transactional: "bg-rose-50 text-rose-700 border-rose-200",
  commercial: "bg-amber-50 text-amber-700 border-amber-200",
  local: "bg-sky-50 text-sky-700 border-sky-200",
  informational: "bg-slate-50 text-slate-600 border-slate-200",
};

export function SeoTab() {
  const [data, setData] = useState<SeoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/seo", { cache: "no-store" });
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function run(task: "keywords" | "publish" | "refresh") {
    const endpoint =
      task === "keywords"
        ? "/api/cron/seo-keywords"
        : task === "publish"
        ? "/api/cron/generate-blog"
        : "/api/cron/seo-refresh";

    setRunning(task);
    setMessage(null);
    try {
      const res = await fetch(endpoint, { method: "POST", cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(`Failed: ${json.error ?? res.status}`);
      } else if (task === "keywords") {
        setMessage(
          `Harvested ${json.suggested ?? 0} suggestions — ${json.created ?? 0} new keywords, ${json.rescored ?? 0} rescored from Search Console.`
        );
      } else if (task === "publish") {
        setMessage(
          json.slug
            ? `Published "${json.title}" for "${json.keyword ?? "topic pool"}".`
            : json.message || "Nothing published."
        );
      } else {
        setMessage(
          json.refreshed
            ? `Refreshed /blog/${json.slug} for ${(json.addedFor ?? []).join(", ")}.`
            : json.reason || "Nothing to refresh."
        );
      }
      await load();
    } catch (err) {
      setMessage(`Failed: ${String(err)}`);
    } finally {
      setRunning(null);
    }
  }

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }
  if (!data) return <p className="text-sm text-slate-500">Couldn&apos;t load SEO data.</p>;

  const { config, counts } = data;
  const clicks30 = data.trend.reduce((n, t) => n + t.clicks, 0);
  const impressions30 = data.trend.reduce((n, t) => n + t.impressions, 0);

  return (
    <div className="space-y-6">
      {/* Setup state — be honest about what is and isn't wired up */}
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { label: "OpenAI (writing)", ok: config.openai, hint: "OPENAI_API_KEY" },
          { label: "Search Console (rankings)", ok: config.searchConsole, hint: "GSC_CLIENT_EMAIL / GSC_PRIVATE_KEY / GSC_SITE_URL" },
          { label: "IndexNow (instant indexing)", ok: config.indexNow, hint: "INDEXNOW_KEY" },
          { label: "Cron secret (automation)", ok: config.cronSecret, hint: "CRON_SECRET" },
        ].map((c) => (
          <div
            key={c.label}
            className={`rounded-xl border p-3 ${
              c.ok ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"
            }`}
          >
            <div className="flex items-center gap-1.5">
              {c.ok ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
              )}
              <p className="text-xs font-semibold text-slate-800">{c.label}</p>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">{c.ok ? "Connected" : `Set ${c.hint}`}</p>
          </div>
        ))}
      </div>

      {/* Run the loops */}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => run("keywords")} disabled={!!running}>
          {running === "keywords" ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Search className="mr-1.5 h-3.5 w-3.5" />
          )}
          Harvest keywords
        </Button>
        <Button size="sm" variant="outline" onClick={() => run("publish")} disabled={!!running}>
          {running === "publish" ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
          )}
          Publish next article
        </Button>
        <Button size="sm" variant="outline" onClick={() => run("refresh")} disabled={!!running}>
          {running === "refresh" ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          )}
          Refresh a near-ranking page
        </Button>
        <span className="text-xs text-slate-400">
          Runs automatically: keywords weekly, one article daily, one refresh weekly.
        </span>
      </div>

      {message && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          {message}
        </div>
      )}

      {/* Numbers */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        {[
          { label: "Keywords found", value: counts.totalKeywords },
          { label: "In queue", value: counts.queued },
          { label: "Articles live", value: counts.posts },
          { label: "Clicks (28d)", value: config.searchConsole ? clicks30 : "—" },
          { label: "Impressions (28d)", value: config.searchConsole ? impressions30 : "—" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">{s.label}</p>
            <p className="text-2xl font-bold text-slate-900">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Striking distance — the money list */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
          <TrendingUp className="h-4 w-4 text-emerald-600" />
          <h3 className="text-sm font-semibold text-slate-900">
            Striking distance — ranking 4-20, one improvement from page-one traffic
          </h3>
        </div>
        {!config.searchConsole ? (
          <p className="px-4 py-6 text-sm text-slate-500">
            Connect Search Console to see this. It&apos;s the highest-value list in the whole system.
          </p>
        ) : data.striking.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">
            Nothing here yet — keep publishing, this fills up once pages start ranking.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2 font-medium">Query</th>
                <th className="px-4 py-2 font-medium">Position</th>
                <th className="px-4 py-2 font-medium">Impressions</th>
                <th className="px-4 py-2 font-medium">Clicks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.striking.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2 text-slate-800">{r.keyword}</td>
                  <td className="px-4 py-2 font-medium text-amber-700">
                    {r.position?.toFixed(1) ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-slate-600">{r.impressions}</td>
                  <td className="px-4 py-2 text-slate-600">{r.clicks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Queue */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-900">
            Next up — highest-scoring queries not written yet
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Score favours long-tail, buying intent, and anything already getting impressions.
          </p>
        </div>
        {data.topQueue.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">
            Queue is empty — hit &ldquo;Harvest keywords&rdquo;.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2 font-medium">Query</th>
                <th className="px-4 py-2 font-medium">Cluster</th>
                <th className="px-4 py-2 font-medium">Intent</th>
                <th className="px-4 py-2 font-medium">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.topQueue.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2 text-slate-800">{r.keyword}</td>
                  <td className="px-4 py-2 text-slate-500">{r.cluster}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${
                        INTENT_STYLE[r.intent] ?? INTENT_STYLE.informational
                      }`}
                    >
                      {r.intent}
                    </span>
                  </td>
                  <td className="px-4 py-2 font-medium text-slate-700">{r.priority}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Clusters + recent posts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Topical map</h3>
          <div className="space-y-2">
            {data.clusters.map((c) => (
              <div key={c.cluster} className="flex items-center gap-2">
                <span className="w-44 shrink-0 truncate text-xs text-slate-600">{c.cluster}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, (c.count / (data.clusters[0]?.count || 1)) * 100)}%`,
                      backgroundImage: "linear-gradient(90deg, #FF6B35, #E8365D)",
                    }}
                  />
                </div>
                <span className="w-8 text-right text-xs text-slate-500">{c.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Latest articles</h3>
          <div className="space-y-2">
            {data.recentPosts.map((p) => (
              <div key={p.slug} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <a
                    href={`/blog/${p.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 truncate text-sm text-slate-800 hover:text-emerald-700"
                  >
                    {p.title}
                    <ExternalLink className="h-3 w-3 shrink-0 text-slate-300" />
                  </a>
                  <p className="truncate text-[11px] text-slate-500">
                    {p.keyword ? `target: ${p.keyword}` : "topic pool"}
                    {p.wordCount ? ` · ${p.wordCount} words` : ""}
                    {p.refreshCount ? ` · refreshed ${p.refreshCount}×` : ""}
                  </p>
                </div>
                <span className="shrink-0 text-[11px] text-slate-400">
                  {new Date(p.createdAt).toLocaleDateString("en-IE", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Run log */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-900">Autopilot log</h3>
        </div>
        {data.runs.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">No runs yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {data.runs.map((r) => (
              <div key={r.id} className="flex items-start gap-3 px-4 py-2 text-xs">
                <span
                  className={`mt-0.5 rounded px-1.5 py-0.5 font-medium ${
                    r.ok ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {r.task}
                </span>
                <span className="flex-1 break-all text-slate-600">{r.detail}</span>
                <span className="shrink-0 text-slate-400">
                  {new Date(r.createdAt).toLocaleString("en-IE", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
