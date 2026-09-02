"use client";

/**
 * AI Visibility panel — share of voice inside ChatGPT / Perplexity answers.
 *
 * Google gives you ten blue links and a page two. An AI assistant gives one
 * shortlist of maybe five names, and there is no page two — so "were we named"
 * is closer to pass/fail than to a ranking. That's why this is shown as a
 * percentage of prompts won, plus the verbatim answers, rather than a position.
 *
 * Answers are expandable on purpose. The score tells you where you stand; the
 * wording tells you what to write next, which is the actually useful part.
 */

import { useCallback, useEffect, useState } from "react";
import {
  Bot,
  Loader2,
  Play,
  ChevronDown,
  CheckCircle2,
  XCircle,
  Link2,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type ModelStat = {
  model: string;
  total: number;
  mentioned: number;
  sharePct: number;
  avgRank: number | null;
  cited: number;
};

type LatestRow = {
  id: string;
  prompt: string;
  cluster: string;
  region: string;
  model: string;
  mentioned: boolean;
  rank: number | null;
  cited: boolean;
  competitors: string[];
  answer: string;
  createdAt: string;
};

type Data = {
  configured: boolean;
  perplexity?: boolean;
  lastRun?: { ok: boolean; detail: string; at: string } | null;
  prompts: number;
  checks: number;
  byModel: ModelStat[];
  competitors: { name: string; total: number; beatUs: number; sharePct: number }[];
  trend: { date: string; sharePct: number; total: number }[];
  latest: LatestRow[];
};

const MODEL_LABEL: Record<string, string> = {
  "gpt-4o-mini": "ChatGPT (training data)",
  "gpt-4o-mini-search": "ChatGPT (live web search)",
  sonar: "Perplexity (live web)",
};

/**
 * Why a card reads 0%. Without this the training-data card looks like a broken
 * feature rather than the expected baseline for a brand launched this year.
 */
const MODEL_NOTE: Record<string, string> = {
  "gpt-4o-mini":
    "Answers from a frozen training set that closed before Rotahr existed, so this stays at 0% no matter what you publish. It is the baseline, not the scoreboard.",
  "gpt-4o-mini-search":
    "Browses live before answering, which is what chatgpt.com actually does for questions like these. This is the ChatGPT number that can move.",
  sonar: "Reads live pages, so it reacts within days of publishing. Leading indicator.",
};

export function AiVisibilityPanel() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/ai-visibility", { cache: "no-store" });
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function runCheck() {
    setRunning(true);
    setMessage(null);
    try {
      const res = await fetch("/api/cron/ai-visibility?limit=8", {
        method: "POST",
        cache: "no-store",
      });
      const json = await res.json().catch(() => ({}));
      setMessage(
        json.ok
          ? `Asked ${json.checked} questions — Rotahr named in ${json.mentions}.`
          : json.reason || json.error || "Check failed."
      );
      await load();
    } catch (e) {
      setMessage(String(e));
    } finally {
      setRunning(false);
    }
  }

  if (loading && !data) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 p-4">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Bot className="h-4 w-4 text-violet-600" />
              AI visibility — do assistants recommend Rotahr?
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              {data.prompts} buying questions tracked. An AI answer is one shortlist with no page
              two, so being absent costs more than ranking #11 on Google.
            </p>
          </div>
          <Button size="sm" onClick={runCheck} disabled={running}>
            {running ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="mr-1.5 h-3.5 w-3.5" />
            )}
            Run check
          </Button>
        </div>

        {message && (
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-sm text-slate-700">
            {message}
          </div>
        )}

        {!data.perplexity && (
          <div className="flex items-start gap-2 border-b border-amber-100 bg-amber-50 px-4 py-2.5">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
            <p className="text-[11px] leading-relaxed text-slate-600">
              Only ChatGPT is being checked, which answers from training data — a young brand can be
              absent for months regardless of what you publish. Add{" "}
              <code className="rounded bg-white px-1">PERPLEXITY_API_KEY</code> to also check a
              live-web model; that one reacts within days and is the real leading indicator.
            </p>
          </div>
        )}

        {data.lastRun && !data.lastRun.ok && (
          <div className="flex items-start gap-2 border-b border-red-100 bg-red-50 px-4 py-2.5">
            <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
            <p className="text-[11px] leading-relaxed text-slate-600">
              Last check hit an error, so a model may be missing below:{" "}
              <span className="font-medium text-slate-800">{data.lastRun.detail}</span>
            </p>
          </div>
        )}

        {data.checks === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">
            No checks run yet. Hit &ldquo;Run check&rdquo; — expect to be absent at first. That
            baseline is the point.
          </p>
        ) : (
          <>
            <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
              {data.byModel.map((m) => (
                <div key={m.model} className="rounded-xl border border-slate-200 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">
                    {MODEL_LABEL[m.model] ?? m.model}
                  </p>
                  <div className="mt-1 flex items-baseline gap-2">
                    <p className="text-2xl font-bold text-slate-900">{m.sharePct.toFixed(0)}%</p>
                    <p className="text-xs text-slate-500">
                      named in {m.mentioned} of {m.total}
                    </p>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(2, m.sharePct)}%`,
                        backgroundImage: "linear-gradient(90deg, #7c3aed, #E8365D)",
                      }}
                    />
                  </div>
                  <p className="mt-2 text-[11px] text-slate-500">
                    {m.avgRank ? `Avg place in list: ${m.avgRank.toFixed(1)}` : "Not placed yet"}
                    {m.cited ? ` · cited rotahr.com ${m.cited}×` : ""}
                  </p>
                  {MODEL_NOTE[m.model] && (
                    <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
                      {MODEL_NOTE[m.model]}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {data.competitors.length > 0 && (
              <div className="border-t border-slate-100 p-4">
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Who gets recommended instead
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {data.competitors.map((c) => (
                    <span
                      key={c.name}
                      title={`Named in ${c.total} answers · ${c.beatUs} where Rotahr was absent`}
                      className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-700"
                    >
                      {c.name} <span className="font-semibold">{c.sharePct.toFixed(0)}%</span>
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-slate-500">
                  This is your real competitive set for AI search — not whoever ranks on Google.
                  Anything above 50% is a name the models treat as a default.
                </p>
              </div>
            )}

            <div className="border-t border-slate-100">
              <h4 className="px-4 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Latest answers
              </h4>
              <div className="divide-y divide-slate-100">
                {data.latest.map((r) => (
                  <div key={r.id} className="px-4 py-2.5">
                    <button
                      onClick={() => setOpen(open === r.id ? null : r.id)}
                      className="flex w-full items-start gap-2 text-left"
                    >
                      {r.mentioned ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      ) : (
                        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm text-slate-800">{r.prompt}</span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
                          <span>{MODEL_LABEL[r.model] ?? r.model}</span>
                          {r.mentioned && r.rank && (
                            <span className="font-medium text-emerald-700">#{r.rank} in list</span>
                          )}
                          {r.cited && (
                            <span className="inline-flex items-center gap-0.5 text-violet-700">
                              <Link2 className="h-3 w-3" /> cited
                            </span>
                          )}
                          {!r.mentioned && r.competitors.length > 0 && (
                            <span className="truncate">
                              they got: {r.competitors.slice(0, 3).join(", ")}
                            </span>
                          )}
                        </span>
                      </span>
                      <ChevronDown
                        className={`mt-0.5 h-4 w-4 shrink-0 text-slate-300 transition ${
                          open === r.id ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    {open === r.id && (
                      <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-700">
                        {r.answer}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {data.lastRun && (
              <p className="border-t border-slate-100 px-4 py-2.5 text-[11px] text-slate-400">
                Last check {new Date(data.lastRun.at).toLocaleString("en-IE")} —{" "}
                {data.lastRun.detail}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
