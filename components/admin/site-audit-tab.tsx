"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Gauge,
  Globe,
  Info,
  Loader2,
  Search,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Severity = "critical" | "warning" | "notice" | "pass";
type Category = "technical" | "onpage" | "performance" | "structured-data" | "ai-readiness";

interface Issue {
  code: string;
  category: Category;
  severity: Severity;
  title: string;
  detail: string;
  urls: string[];
  fix: string;
  priority: number;
}

interface Report {
  domain: string;
  origin: string;
  durationMs: number;
  pagesCrawled: number;
  score: number;
  scoreBreakdown: Record<Category, number>;
  issues: Issue[];
  warnings: string[];
  robots: { found: boolean; sitemaps: string[]; blocksEverything: boolean };
  sitemap: { found: boolean; url: string | null; urlCount: number };
  ai: {
    llmsTxt: boolean;
    answerShapedPages: number;
    questionHeadings: number;
    faqSchemaPages: number;
    blockedAiCrawlers: string[];
  };
  psi: {
    ok: boolean;
    error?: string;
    performance: number | null;
    seo: number | null;
    accessibility: number | null;
    bestPractices: number | null;
    lcp: number | null;
    cls: number | null;
    tbt: number | null;
    hasFieldData: boolean;
    fieldLcp: number | null;
    fieldCls: number | null;
    fieldInp: number | null;
  } | null;
  pages: {
    url: string;
    status: number;
    wordCount: number;
    title: string | null;
    titleLength: number;
    metaDescription: string | null;
    h1: string[];
    schemaTypes: string[];
    noindex: boolean;
    imagesMissingAlt: number;
    error?: string;
  }[];
}

interface HistoryRow {
  id: string;
  domain: string;
  score: number;
  pagesCrawled: number;
  issueCount: number;
  criticalCount: number;
  warningCount: number;
  performance: number | null;
  createdAt: string;
}

const SEVERITY_STYLE: Record<Severity, { badge: string; icon: typeof AlertCircle; label: string }> = {
  critical: { badge: "bg-red-100 text-red-700", icon: AlertCircle, label: "Critical" },
  warning: { badge: "bg-amber-100 text-amber-700", icon: AlertTriangle, label: "Warning" },
  notice: { badge: "bg-slate-100 text-slate-600", icon: Info, label: "Notice" },
  pass: { badge: "bg-emerald-100 text-emerald-700", icon: CheckCircle2, label: "Pass" },
};

const CATEGORY_LABEL: Record<Category, string> = {
  technical: "Technical",
  onpage: "On-page",
  performance: "Performance",
  "structured-data": "Structured data",
  "ai-readiness": "AI readiness",
};

function scoreColor(n: number) {
  if (n >= 90) return "text-emerald-600";
  if (n >= 70) return "text-amber-600";
  if (n >= 50) return "text-orange-600";
  return "text-red-600";
}

function scoreRing(n: number) {
  if (n >= 90) return "#059669";
  if (n >= 70) return "#d97706";
  if (n >= 50) return "#ea580c";
  return "#dc2626";
}

function ScoreDial({ score }: { score: number }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const filled = (score / 100) * c;
  return (
    <div className="relative h-28 w-28 shrink-0">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#e2e8f0" strokeWidth="9" />
        <circle
          cx="50" cy="50" r={r} fill="none"
          stroke={scoreRing(score)}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${c}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("text-2xl font-bold leading-none", scoreColor(score))}>{score}</span>
        <span className="text-[10px] text-slate-400 font-medium mt-0.5">/ 100</span>
      </div>
    </div>
  );
}

function Metric({ label, value, good }: { label: string; value: string; good: boolean | null }) {
  return (
    <div className="bg-slate-50 rounded-lg px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">{label}</p>
      <p className={cn("text-sm font-bold mt-0.5",
        good === null ? "text-slate-400" : good ? "text-emerald-600" : "text-red-600")}>
        {value}
      </p>
    </div>
  );
}

export function SiteAuditTab() {
  const [domain, setDomain] = useState("");
  const [maxPages, setMaxPages] = useState(25);
  const [skipPsi, setSkipPsi] = useState(false);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [domains, setDomains] = useState<{ domain: string; runs: number }[]>([]);
  const [psiConfigured, setPsiConfigured] = useState(true);
  const [openIssue, setOpenIssue] = useState<string | null>(null);
  const [catFilter, setCatFilter] = useState<Category | "all">("all");
  const [showPages, setShowPages] = useState(false);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/site-audit");
      if (!res.ok) return;
      const json = await res.json();
      setHistory(json.history ?? []);
      setDomains(json.domains ?? []);
      setPsiConfigured(json.psiConfigured !== false);
    } catch { /* history is non-critical */ }
  }, []);

  useEffect(() => { void loadHistory(); }, [loadHistory]);

  // Elapsed timer, so a long crawl doesn't look frozen.
  useEffect(() => {
    if (!running) return;
    setElapsed(0);
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  const run = useCallback(async () => {
    const d = domain.trim();
    if (!d) { setError("Enter a domain first."); return; }
    setRunning(true);
    setError(null);
    setReport(null);
    setOpenIssue(null);
    try {
      const res = await fetch("/api/admin/site-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: d, maxPages, skipPsi }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Audit failed."); return; }
      setReport(json.report);
      void loadHistory();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Audit failed.");
    } finally {
      setRunning(false);
    }
  }, [domain, maxPages, skipPsi, loadHistory]);

  const loadAudit = useCallback(async (id: string) => {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/site-audit?id=${id}`);
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Could not load that audit."); return; }
      setReport(json.audit.report);
    } finally {
      setRunning(false);
    }
  }, []);

  const issues = report
    ? catFilter === "all" ? report.issues : report.issues.filter((i) => i.category === catFilter)
    : [];

  return (
    <div className="space-y-4">
      {/* ── Runner ─────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Search className="h-4 w-4 text-slate-400" />
          <h3 className="font-semibold text-slate-800 text-sm">Site Audit</h3>
          <span className="text-xs text-slate-400">— works on any domain</span>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Globe className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !running && void run()}
              placeholder="example.com"
              disabled={running}
              className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:bg-slate-50"
            />
          </div>
          <button
            onClick={() => void run()}
            disabled={running}
            className="px-5 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center gap-2 shrink-0"
          >
            {running
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Auditing… {elapsed}s</>
              : <>Run audit</>}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-slate-500">
          <label className="flex items-center gap-1.5">
            Pages
            <select
              value={maxPages}
              onChange={(e) => setMaxPages(Number(e.target.value))}
              disabled={running}
              className="border border-slate-200 rounded px-1.5 py-1 focus:outline-none"
            >
              {[10, 25, 40, 60].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={skipPsi} onChange={(e) => setSkipPsi(e.target.checked)} disabled={running} />
            Skip performance (faster)
          </label>
          {!psiConfigured && !skipPsi && (
            <span className="text-amber-600 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> No PAGESPEED_API_KEY — performance may be rate limited
            </span>
          )}
        </div>

        {domains.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-slate-100">
            <span className="text-xs text-slate-400 mr-1">Recent:</span>
            {domains.slice(0, 8).map((d) => (
              <button
                key={d.domain}
                onClick={() => setDomain(d.domain)}
                className="text-xs px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-md"
              >
                {d.domain}
                <span className="text-slate-400 ml-1">{d.runs}</span>
              </button>
            ))}
          </div>
        )}

        {error && (
          <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /> <span>{error}</span>
          </div>
        )}
      </div>

      {running && !report && (
        <div className="bg-white border border-slate-200 rounded-xl p-8 flex flex-col items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          <p className="text-sm text-slate-500">
            Crawling{skipPsi ? "" : " and running Lighthouse"} — {elapsed}s elapsed
          </p>
          <p className="text-xs text-slate-400">Performance analysis can take up to a minute.</p>
        </div>
      )}

      {report && (
        <>
          {/* ── Headline ─────────────────────────────────────────── */}
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
              <ScoreDial score={report.score} />
              <div className="flex-1 min-w-0 w-full">
                <div className="flex flex-wrap items-baseline gap-2">
                  <p className="font-bold text-slate-800 text-lg truncate">{report.domain}</p>
                  <a href={report.origin} target="_blank" rel="noopener noreferrer"
                     className="text-xs text-emerald-600 hover:underline">{report.origin}</a>
                </div>
                <p className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span>{report.pagesCrawled} pages crawled</span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />{(report.durationMs / 1000).toFixed(1)}s
                  </span>
                  <span className="text-red-600 font-medium">
                    {report.issues.filter((i) => i.severity === "critical").length} critical
                  </span>
                  <span className="text-amber-600 font-medium">
                    {report.issues.filter((i) => i.severity === "warning").length} warnings
                  </span>
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-3">
                  {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => (
                    <button
                      key={c}
                      onClick={() => setCatFilter(catFilter === c ? "all" : c)}
                      className={cn(
                        "text-left px-2.5 py-2 rounded-lg border transition-colors",
                        catFilter === c ? "border-slate-900 bg-slate-50" : "border-slate-100 hover:bg-slate-50",
                      )}
                    >
                      <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold truncate">
                        {CATEGORY_LABEL[c]}
                      </p>
                      <p className={cn("text-base font-bold", scoreColor(report.scoreBreakdown[c] ?? 100))}>
                        {report.scoreBreakdown[c] ?? 100}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {report.warnings.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-100 space-y-1">
                {report.warnings.map((w, i) => (
                  <p key={i} className="text-xs text-amber-600 flex items-start gap-1.5">
                    <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" /> {w}
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* ── Core Web Vitals ─────────────────────────────────── */}
          {report.psi && (
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Gauge className="h-4 w-4 text-slate-400" />
                <h3 className="font-semibold text-slate-800 text-sm">Core Web Vitals</h3>
                {report.psi.hasFieldData && (
                  <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold uppercase">
                    Real user data
                  </span>
                )}
              </div>
              {report.psi.ok ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                    <Metric label="Performance" value={`${report.psi.performance ?? "—"}`}
                            good={report.psi.performance === null ? null : report.psi.performance >= 90} />
                    <Metric label="SEO" value={`${report.psi.seo ?? "—"}`}
                            good={report.psi.seo === null ? null : report.psi.seo >= 90} />
                    <Metric label="Accessibility" value={`${report.psi.accessibility ?? "—"}`}
                            good={report.psi.accessibility === null ? null : report.psi.accessibility >= 90} />
                    <Metric label="Best practices" value={`${report.psi.bestPractices ?? "—"}`}
                            good={report.psi.bestPractices === null ? null : report.psi.bestPractices >= 90} />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Metric label="LCP" value={report.psi.lcp === null ? "—" : `${(report.psi.lcp / 1000).toFixed(2)}s`}
                            good={report.psi.lcp === null ? null : report.psi.lcp <= 2500} />
                    <Metric label="CLS" value={report.psi.cls === null ? "—" : report.psi.cls.toFixed(3)}
                            good={report.psi.cls === null ? null : report.psi.cls <= 0.1} />
                    <Metric label="TBT" value={report.psi.tbt === null ? "—" : `${Math.round(report.psi.tbt)}ms`}
                            good={report.psi.tbt === null ? null : report.psi.tbt <= 200} />
                  </div>
                  {report.psi.hasFieldData && (
                    <p className="text-xs text-slate-500 mt-2">
                      Field data (28-day real users):
                      {report.psi.fieldLcp !== null && ` LCP ${(report.psi.fieldLcp / 1000).toFixed(2)}s`}
                      {report.psi.fieldCls !== null && ` · CLS ${report.psi.fieldCls.toFixed(3)}`}
                      {report.psi.fieldInp !== null && ` · INP ${report.psi.fieldInp}ms`}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-amber-600 flex items-start gap-1.5">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  {report.psi.error ?? "Performance data unavailable."}
                </p>
              )}
            </div>
          )}

          {/* ── AI readiness ────────────────────────────────────── */}
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-slate-400" />
              <h3 className="font-semibold text-slate-800 text-sm">AI search readiness</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Metric label="llms.txt" value={report.ai.llmsTxt ? "Present" : "Missing"} good={report.ai.llmsTxt} />
              <Metric label="Answer-shaped" value={`${report.ai.answerShapedPages}/${report.pagesCrawled}`}
                      good={report.pagesCrawled ? report.ai.answerShapedPages / report.pagesCrawled >= 0.3 : null} />
              <Metric label="FAQ schema" value={`${report.ai.faqSchemaPages} pages`} good={report.ai.faqSchemaPages > 0} />
              <Metric label="AI crawlers"
                      value={report.ai.blockedAiCrawlers.length ? `${report.ai.blockedAiCrawlers.length} blocked` : "All allowed"}
                      good={report.ai.blockedAiCrawlers.length === 0} />
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-slate-500">
              <span>robots.txt: {report.robots.found ? "found" : "missing"}</span>
              <span>
                sitemap: {report.sitemap.found ? `${report.sitemap.urlCount} URLs` : "missing"}
              </span>
              <span>question headings: {report.ai.questionHeadings} pages</span>
            </div>
          </div>

          {/* ── Issues ──────────────────────────────────────────── */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-slate-800 text-sm">
                {catFilter === "all" ? "All issues" : CATEGORY_LABEL[catFilter]}
                <span className="ml-2 bg-slate-100 text-slate-600 text-xs font-bold px-2 py-0.5 rounded-full">
                  {issues.length}
                </span>
              </p>
              {catFilter !== "all" && (
                <button onClick={() => setCatFilter("all")} className="text-xs text-emerald-600 hover:underline">
                  Show all
                </button>
              )}
            </div>

            {issues.length === 0 ? (
              <div className="p-8 text-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-sm text-slate-600 font-medium">No issues in this category.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {issues.map((issue) => {
                  const S = SEVERITY_STYLE[issue.severity];
                  const open = openIssue === issue.code;
                  return (
                    <div key={issue.code}>
                      <button
                        onClick={() => setOpenIssue(open ? null : issue.code)}
                        className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-start gap-3"
                      >
                        {open
                          ? <ChevronDown className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                          : <ChevronRight className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded uppercase", S.badge)}>
                              {S.label}
                            </span>
                            <span className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold">
                              {CATEGORY_LABEL[issue.category]}
                            </span>
                          </div>
                          <p className="text-sm font-medium text-slate-800 mt-1">{issue.title}</p>
                        </div>
                      </button>
                      {open && (
                        <div className="px-4 pb-4 pl-11 space-y-3">
                          <p className="text-sm text-slate-600">{issue.detail}</p>
                          <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                            <p className="text-[10px] uppercase tracking-wide text-emerald-700 font-bold mb-0.5">
                              How to fix
                            </p>
                            <p className="text-sm text-emerald-900">{issue.fix}</p>
                          </div>
                          {issue.urls.length > 0 && (
                            <div>
                              <p className="text-[10px] uppercase tracking-wide text-slate-400 font-bold mb-1">
                                Affected ({issue.urls.length})
                              </p>
                              <div className="space-y-0.5 max-h-52 overflow-y-auto">
                                {issue.urls.map((u, i) => (
                                  <p key={i} className="text-xs text-slate-500 font-mono truncate">{u}</p>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Crawled pages ───────────────────────────────────── */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <button
              onClick={() => setShowPages(!showPages)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50"
            >
              <p className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                {showPages ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                Crawled pages
                <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2 py-0.5 rounded-full">
                  {report.pages.length}
                </span>
              </p>
            </button>
            {showPages && (
              <div className="overflow-x-auto border-t border-slate-100">
                <table className="w-full text-sm min-w-[720px]">
                  <thead className="bg-slate-50 text-xs text-slate-500">
                    <tr>
                      <th className="text-left font-medium px-4 py-2">URL</th>
                      <th className="text-right font-medium px-3 py-2">Status</th>
                      <th className="text-right font-medium px-3 py-2">Words</th>
                      <th className="text-left font-medium px-3 py-2">Title</th>
                      <th className="text-left font-medium px-3 py-2">Schema</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {report.pages.map((p) => (
                      <tr key={p.url} className="hover:bg-slate-50">
                        <td className="px-4 py-2 max-w-[260px]">
                          <p className="truncate text-xs font-mono text-slate-600" title={p.url}>
                            {p.url.replace(report.origin, "") || "/"}
                          </p>
                          {p.error && <p className="text-[10px] text-red-500">{p.error}</p>}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <span className={cn("text-xs font-bold",
                            p.status === 200 ? "text-emerald-600" : p.status >= 400 ? "text-red-600" : "text-amber-600")}>
                            {p.status || "ERR"}
                          </span>
                          {p.noindex && <span className="ml-1 text-[10px] text-amber-600">noindex</span>}
                        </td>
                        <td className={cn("px-3 py-2 text-right text-xs",
                          p.wordCount < 300 ? "text-amber-600 font-medium" : "text-slate-600")}>
                          {p.wordCount}
                        </td>
                        <td className="px-3 py-2 max-w-[220px]">
                          <p className="truncate text-xs text-slate-600" title={p.title ?? ""}>
                            {p.title ?? <span className="text-red-500">missing</span>}
                          </p>
                        </td>
                        <td className="px-3 py-2">
                          <p className="text-[10px] text-slate-500 truncate max-w-[140px]" title={p.schemaTypes.join(", ")}>
                            {p.schemaTypes.length ? p.schemaTypes.join(", ") : <span className="text-slate-300">none</span>}
                          </p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── History ───────────────────────────────────────────── */}
      {history.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="font-semibold text-slate-800 text-sm">Audit history</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="text-left font-medium px-4 py-2">Domain</th>
                  <th className="text-right font-medium px-3 py-2">Score</th>
                  <th className="text-right font-medium px-3 py-2">Pages</th>
                  <th className="text-right font-medium px-3 py-2">Critical</th>
                  <th className="text-right font-medium px-3 py-2">Perf</th>
                  <th className="text-left font-medium px-3 py-2">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {history.map((h) => (
                  <tr key={h.id} onClick={() => void loadAudit(h.id)}
                      className="hover:bg-slate-50 cursor-pointer">
                    <td className="px-4 py-2 font-medium text-slate-700 text-xs">{h.domain}</td>
                    <td className={cn("px-3 py-2 text-right font-bold text-xs", scoreColor(h.score))}>{h.score}</td>
                    <td className="px-3 py-2 text-right text-xs text-slate-600">{h.pagesCrawled}</td>
                    <td className="px-3 py-2 text-right text-xs">
                      {h.criticalCount > 0
                        ? <span className="text-red-600 font-medium">{h.criticalCount}</span>
                        : <span className="text-slate-300">0</span>}
                    </td>
                    <td className="px-3 py-2 text-right text-xs text-slate-600">{h.performance ?? "—"}</td>
                    <td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">
                      {new Date(h.createdAt).toLocaleString("en-IE", {
                        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
