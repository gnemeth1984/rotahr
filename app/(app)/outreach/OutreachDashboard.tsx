"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Mail, Users, Send, TrendingUp, RefreshCw, Eye, MousePointerClick,
  ChevronLeft, ChevronRight, Search, Globe, Filter,
  CheckCircle2, XCircle, AlertTriangle, Zap, ShieldCheck, Beaker,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────
interface Stats {
  total: number;
  new_count: number;
  contacted: number;
  followup1: number;
  followup2: number;
  followup3: number;
  replied: number;
  cold: number;
  unsubscribed: number;
  bounced: number;
  sentToday: number;
  dailyLimit: number;
  byCountry: { country: string; cnt: number }[];
  bySegment: { segment: string; cnt: number }[];
  totalSends: number;
  opened: number;
  clicked: number;
  failed: number;
  openRate: number;
  clickRate: number;
  suppressed: number;
  brevoConfigured: boolean;
  updatedAt: string;
}

interface Lead {
  id: string;
  name: string;
  email: string;
  segment: string;
  city: string;
  county: string;
  country: string;
  status: string;
  contactCount: number;
  last_contacted: string | null;
  created_at: string;
}

interface SendRow {
  id: string;
  email: string;
  segment: string;
  step: string;
  subject: string;
  sent_at: string;
  opened: boolean;
  clicked: boolean;
  failedReason: string | null;
}

interface Outcome {
  email: string;
  step: string;
  sent: boolean;
  subject?: string;
  reason?: string;
}

interface BatchResult {
  dryRun: boolean;
  sent: number;
  skipped: number;
  attempted: number;
  dailyLimit: number;
  sentToday: number;
  reason?: string;
  outcomes: Outcome[];
}

// ── Status helpers ────────────────────────────────────────────────────────────
const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  new:          { label: "New",         color: "text-blue-600",   bg: "bg-blue-50" },
  contacted:    { label: "Contacted",   color: "text-yellow-600", bg: "bg-yellow-50" },
  followup_1:   { label: "Follow-up 1", color: "text-orange-500", bg: "bg-orange-50" },
  followup_2:   { label: "Follow-up 2", color: "text-orange-600", bg: "bg-orange-50" },
  followup_3:   { label: "Follow-up 3", color: "text-red-500",    bg: "bg-red-50" },
  replied:      { label: "Replied",     color: "text-green-600",  bg: "bg-green-50" },
  cold:         { label: "Cold",        color: "text-slate-400",  bg: "bg-slate-50" },
  unsubscribed: { label: "Unsub",       color: "text-slate-400",  bg: "bg-slate-50" },
  bounced:      { label: "Bounced",     color: "text-red-600",    bg: "bg-red-50" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status] ?? { label: status, color: "text-slate-500", bg: "bg-slate-50" };
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium", cfg.bg, cfg.color)}>
      {cfg.label}
    </span>
  );
}

const COUNTRIES: { value: string; label: string }[] = [
  { value: "all", label: "All markets" },
  { value: "ie", label: "🇮🇪 Ireland" },
  { value: "uk", label: "🇬🇧 UK" },
  { value: "us", label: "🇺🇸 US" },
  { value: "ca", label: "🇨🇦 Canada" },
  { value: "au", label: "🇦🇺 Australia" },
];

// ── Main component ────────────────────────────────────────────────────────────
export function OutreachDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [sends, setSends] = useState<SendRow[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadsTotal, setLeadsTotal] = useState(0);
  const [leadsPage, setLeadsPage] = useState(1);
  const [leadsPages, setLeadsPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"sends" | "leads">("sends");
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  // Batch controls
  const [batchCountry, setBatchCountry] = useState("all");
  const [batchLimit, setBatchLimit] = useState("10");
  const [previewing, setPreviewing] = useState(false);
  const [sending, setSending] = useState(false);
  const [preview, setPreview] = useState<BatchResult | null>(null);

  // Test send
  const [testTo, setTestTo] = useState("");
  const [testing, setTesting] = useState(false);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 5000);
  };

  const fetchStats = useCallback(async () => {
    const r = await fetch("/api/outreach/stats");
    if (r.ok) setStats(await r.json());
  }, []);

  const fetchSends = useCallback(async () => {
    const r = await fetch("/api/outreach/sends?limit=50");
    if (r.ok) { const d = await r.json(); setSends(d.sends ?? []); }
  }, []);

  const fetchLeads = useCallback(async () => {
    const params = new URLSearchParams({ page: String(leadsPage), limit: "50" });
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (countryFilter !== "all") params.set("country", countryFilter);
    if (search.trim()) params.set("search", search.trim());
    const r = await fetch(`/api/outreach/leads?${params}`);
    if (r.ok) {
      const d = await r.json();
      setLeads(d.leads ?? []);
      setLeadsTotal(d.total ?? 0);
      setLeadsPages(d.pages ?? 1);
    }
  }, [leadsPage, statusFilter, countryFilter, search]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchStats(), fetchSends(), fetchLeads()]);
    setLoading(false);
  }, [fetchStats, fetchSends, fetchLeads]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { setLeadsPage(1); }, [statusFilter, countryFilter, search]);
  useEffect(() => { if (tab === "leads") fetchLeads(); }, [leadsPage, statusFilter, countryFilter, tab, fetchLeads]);

  const batchBody = () => ({
    country: batchCountry,
    limit: Math.max(1, Math.min(200, Number(batchLimit) || 10)),
  });

  /** Dry run: reports exactly who would be emailed, contacts nobody. */
  const runPreview = async () => {
    setPreviewing(true);
    setPreview(null);
    try {
      const r = await fetch("/api/outreach/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(batchBody()),
      });
      const d: BatchResult = await r.json();
      setPreview(d);
      if (!d.outcomes?.length) showToast(d.reason || "Nothing eligible to send", false);
    } catch {
      showToast("Preview failed", false);
    } finally {
      setPreviewing(false);
    }
  };

  /** The only path that actually sends. Requires an explicit confirmation. */
  const sendForReal = async () => {
    const n = preview?.outcomes?.length ?? 0;
    if (!n) return;
    const ok = window.confirm(
      `Send ${n} real cold email${n === 1 ? "" : "s"} now?\n\n` +
      `These go to people who have not asked to hear from you. This cannot be undone.`
    );
    if (!ok) return;

    setSending(true);
    try {
      const r = await fetch("/api/outreach/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...batchBody(), confirm: true }),
      });
      const d: BatchResult = await r.json();
      setPreview(d);
      if (d.reason && !d.sent) showToast(d.reason, false);
      else showToast(`Sent ${d.sent}, skipped ${d.skipped}`);
      await Promise.all([fetchStats(), fetchSends()]);
    } catch {
      showToast("Send failed", false);
    } finally {
      setSending(false);
    }
  };

  const runTestSend = async () => {
    if (!testTo.trim()) return;
    setTesting(true);
    try {
      const r = await fetch("/api/outreach/test-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testTo.trim() }),
      });
      const d = await r.json();
      showToast(d.sent ? `Test email sent to ${d.email}` : `Failed: ${d.reason || d.error}`, !!d.sent);
    } catch {
      showToast("Test send failed", false);
    } finally {
      setTesting(false);
    }
  };

  const sentPct = stats ? Math.round((stats.sentToday / stats.dailyLimit) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Email Outreach</h1>
          <p className="text-sm text-slate-500 mt-0.5">5-touch cold sequence · sent via Brevo, separate from customer mail</p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4 mr-1.5", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Brevo status */}
      {stats && !stats.brevoConfigured && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <span className="font-semibold">BREVO_API_KEY is not set.</span>{" "}
            Previews work and show exactly who would be contacted, but nothing can actually send until the key is added in Vercel.
          </div>
        </div>
      )}

      {/* Stat cards */}
      {stats && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard icon={Users} label="Total Leads" value={stats.total} color="blue" />
            <StatCard icon={Mail} label="Never Contacted" value={stats.new_count} color="blue" />
            <StatCard icon={Send} label="In Sequence" value={stats.contacted + stats.followup1 + stats.followup2 + stats.followup3} color="yellow" />
            <StatCard icon={CheckCircle2} label="Replied" value={stats.replied} color="green" />
            <StatCard icon={XCircle} label="Bounced" value={stats.bounced} color="red" />
            <StatCard icon={ShieldCheck} label="Unsubscribed" value={stats.unsubscribed + stats.suppressed} color="slate" />
          </div>

          {/* Engagement */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard icon={Send} label="Emails Sent" value={stats.totalSends} color="blue" />
            <StatCard icon={Eye} label="Opened" value={stats.opened} suffix={`${stats.openRate}%`} color="green" />
            <StatCard icon={MousePointerClick} label="Clicked" value={stats.clicked} suffix={`${stats.clickRate}%`} color="orange" />
            <StatCard icon={AlertTriangle} label="Failed" value={stats.failed} color="red" />
          </div>

          {/* Daily limit bar */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                <Zap className="h-4 w-4 text-violet-500" />
                Sent today
              </span>
              <span className="text-sm font-semibold text-slate-800">
                {stats.sentToday} <span className="text-slate-400 font-normal">/ {stats.dailyLimit}</span>
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2">
              <div
                className="h-2 rounded-full bg-violet-500 transition-all duration-500"
                style={{ width: `${Math.min(sentPct, 100)}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-slate-400">
              The daily cap is stored in the database, so it holds even when several runs overlap.
            </p>
          </div>

          {/* Breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <BreakdownCard title="By Market" rows={stats.byCountry.map(r => ({ label: r.country.toUpperCase(), value: r.cnt, total: stats.total }))} />
            <BreakdownCard title="By Segment" rows={stats.bySegment.map(r => ({ label: r.segment, value: r.cnt, total: stats.total }))} />
          </div>
        </>
      )}

      {/* Batch runner */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Run a batch</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Preview first — it lists every recipient and subject line without contacting anyone. Sending is a separate, confirmed step.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Market</label>
            <Select value={batchCountry} onValueChange={(v) => { setBatchCountry(v); setPreview(null); }}>
              <SelectTrigger className="w-40 h-9 text-sm">
                <Globe className="h-3.5 w-3.5 mr-1.5 text-slate-400" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">How many</label>
            <Input
              type="number"
              min={1}
              max={200}
              value={batchLimit}
              onChange={e => { setBatchLimit(e.target.value); setPreview(null); }}
              className="w-24 h-9 text-sm"
            />
          </div>
          <Button size="sm" variant="outline" onClick={runPreview} disabled={previewing || sending}>
            <Eye className={cn("h-4 w-4 mr-1.5", previewing && "animate-pulse")} />
            {previewing ? "Building preview…" : "Preview batch"}
          </Button>
        </div>

        {/* Preview result */}
        {preview && (
          <div className="rounded-lg border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-slate-50 border-b border-slate-200">
              <div className="text-xs text-slate-600">
                {preview.dryRun ? (
                  <>
                    <span className="font-semibold text-slate-800">Preview only — nothing sent.</span>{" "}
                    {preview.outcomes.length} lead{preview.outcomes.length === 1 ? "" : "s"} would be contacted.
                  </>
                ) : (
                  <>
                    <span className="font-semibold text-green-700">Sent {preview.sent}</span>
                    {preview.skipped > 0 && <span className="text-red-600"> · skipped {preview.skipped}</span>}
                  </>
                )}
                {preview.reason && <span className="text-slate-400"> · {preview.reason}</span>}
              </div>
              {preview.dryRun && preview.outcomes.length > 0 && (
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white shrink-0"
                  onClick={sendForReal}
                  disabled={sending || !stats?.brevoConfigured}
                >
                  <Send className="h-4 w-4 mr-1.5" />
                  {sending ? "Sending…" : `Send these ${preview.outcomes.length}`}
                </Button>
              )}
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-slate-500">
                  <th className="text-left px-4 py-2 font-medium">Email</th>
                  <th className="text-left px-4 py-2 font-medium">Step</th>
                  <th className="text-left px-4 py-2 font-medium hidden md:table-cell">Subject</th>
                  <th className="text-left px-4 py-2 font-medium">Result</th>
                </tr>
              </thead>
              <tbody>
                {preview.outcomes.map((o, i) => (
                  <tr key={`${o.email}-${i}`} className="border-b border-slate-50">
                    <td className="px-4 py-2 font-mono text-xs text-slate-700">{o.email}</td>
                    <td className="px-4 py-2"><StepBadge step={o.step} /></td>
                    <td className="px-4 py-2 text-slate-500 hidden md:table-cell max-w-xs truncate">{o.subject}</td>
                    <td className="px-4 py-2 text-xs">
                      {preview.dryRun
                        ? <span className="text-slate-400">{o.reason?.startsWith("would skip") ? o.reason : "would send"}</span>
                        : o.sent
                          ? <span className="text-green-600 font-medium">sent</span>
                          : <span className="text-red-600">{o.reason || "failed"}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Test send */}
        <div className="border-t border-slate-100 pt-3">
          <label className="block text-xs text-slate-500 mb-1">Send yourself a test copy</label>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="you@example.com"
              value={testTo}
              onChange={e => setTestTo(e.target.value)}
              className="w-64 h-9 text-sm"
            />
            <Button size="sm" variant="outline" onClick={runTestSend} disabled={testing || !testTo.trim()}>
              <Beaker className="h-4 w-4 mr-1.5" />
              {testing ? "Sending…" : "Send test"}
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <div className="flex gap-0">
          {(["sends", "leads"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                tab === t
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              )}
            >
              {t === "sends" ? `Recent Sends (${sends.length})` : `Leads (${leadsTotal.toLocaleString()})`}
            </button>
          ))}
        </div>
      </div>

      {/* Recent Sends */}
      {tab === "sends" && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 font-medium text-slate-500">Time</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">Email</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 hidden sm:table-cell">Segment</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">Step</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 hidden md:table-cell">Subject</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">Engagement</th>
              </tr>
            </thead>
            <tbody>
              {sends.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10 text-slate-400">No sends yet</td></tr>
              ) : sends.map((s) => (
                <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap text-xs">
                    {new Date(s.sent_at).toLocaleString("en-IE", { dateStyle: "short", timeStyle: "short" })}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-700">{s.email}</td>
                  <td className="px-4 py-2.5 text-slate-600 hidden sm:table-cell">{s.segment}</td>
                  <td className="px-4 py-2.5"><StepBadge step={s.step} /></td>
                  <td className="px-4 py-2.5 text-slate-500 hidden md:table-cell max-w-xs truncate">{s.subject}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5 text-xs">
                      {s.failedReason && <span className="text-red-600">failed</span>}
                      {s.clicked && <span className="text-orange-600 flex items-center gap-1"><MousePointerClick className="h-3 w-3" />clicked</span>}
                      {!s.clicked && s.opened && <span className="text-green-600 flex items-center gap-1"><Eye className="h-3 w-3" />opened</span>}
                      {!s.clicked && !s.opened && !s.failedReason && <span className="text-slate-300">—</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Lead list */}
      {tab === "leads" && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search email, name or city…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 w-60 h-9 text-sm"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40 h-9 text-sm">
                <Filter className="h-3.5 w-3.5 mr-1.5 text-slate-400" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {Object.entries(statusConfig).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={countryFilter} onValueChange={setCountryFilter}>
              <SelectTrigger className="w-36 h-9 text-sm">
                <Globe className="h-3.5 w-3.5 mr-1.5 text-slate-400" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <span className="text-sm text-slate-400">{leadsTotal.toLocaleString()} leads</span>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Name / Email</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500 hidden sm:table-cell">Segment</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500 hidden md:table-cell">Location</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Market</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500 hidden lg:table-cell">Emails</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500 hidden lg:table-cell">Last Contact</th>
                </tr>
              </thead>
              <tbody>
                {leads.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-10 text-slate-400">No leads found</td></tr>
                ) : leads.map((l) => (
                  <tr key={l.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-slate-800 text-xs">{l.name}</div>
                      <div className="text-slate-400 font-mono text-xs">{l.email}</div>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 hidden sm:table-cell">{l.segment}</td>
                    <td className="px-4 py-2.5 text-slate-500 hidden md:table-cell">{[l.city, l.county].filter(Boolean).join(", ") || "—"}</td>
                    <td className="px-4 py-2.5 text-slate-600 uppercase text-xs">{l.country}</td>
                    <td className="px-4 py-2.5"><StatusBadge status={l.status} /></td>
                    <td className="px-4 py-2.5 text-slate-500 text-xs hidden lg:table-cell">{l.contactCount}</td>
                    <td className="px-4 py-2.5 text-slate-400 text-xs hidden lg:table-cell">
                      {l.last_contacted ? new Date(l.last_contacted).toLocaleDateString("en-IE") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {leadsPages > 1 && (
            <div className="flex items-center justify-between text-sm text-slate-500">
              <span>Page {leadsPage} of {leadsPages}</span>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" disabled={leadsPage <= 1} onClick={() => setLeadsPage(p => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" disabled={leadsPage >= leadsPages} onClick={() => setLeadsPage(p => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={cn(
          "fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium",
          toast.ok ? "bg-green-600" : "bg-red-600"
        )}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────
function StatCard({
  icon: Icon, label, value, color, suffix,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  color: string;
  suffix?: string;
}) {
  const colors: Record<string, string> = {
    blue: "text-blue-600 bg-blue-50",
    yellow: "text-yellow-600 bg-yellow-50",
    orange: "text-orange-500 bg-orange-50",
    green: "text-green-600 bg-green-50",
    red: "text-red-500 bg-red-50",
    slate: "text-slate-500 bg-slate-100",
  };
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className={cn("inline-flex p-2 rounded-lg mb-2", colors[color])}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="text-2xl font-bold text-slate-900 flex items-baseline gap-1.5">
        {value.toLocaleString()}
        {suffix && <span className="text-xs font-medium text-slate-400">{suffix}</span>}
      </div>
      <div className="text-xs text-slate-500 mt-0.5">{label}</div>
    </div>
  );
}

function BreakdownCard({ title, rows }: { title: string; rows: { label: string; value: number; total: number }[] }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <h3 className="text-sm font-semibold text-slate-700 mb-3">{title}</h3>
      <div className="space-y-2">
        {rows.length === 0 && <p className="text-xs text-slate-400">No leads yet</p>}
        {rows.map(r => (
          <div key={r.label} className="flex items-center gap-2">
            <span className="text-xs text-slate-600 w-24 truncate">{r.label}</span>
            <div className="flex-1 bg-slate-100 rounded-full h-1.5">
              <div
                className="h-1.5 rounded-full bg-blue-500 transition-all"
                style={{ width: `${r.total ? Math.round((r.value / r.total) * 100) : 0}%` }}
              />
            </div>
            <span className="text-xs font-medium text-slate-700 w-10 text-right">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StepBadge({ step }: { step: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    new:        { label: "1 · intro",      cls: "bg-blue-50 text-blue-600" },
    contacted:  { label: "2 · follow-up",  cls: "bg-yellow-50 text-yellow-600" },
    followup_1: { label: "3 · follow-up",  cls: "bg-orange-50 text-orange-500" },
    followup_2: { label: "4 · follow-up",  cls: "bg-orange-100 text-orange-600" },
    followup_3: { label: "5 · last one",   cls: "bg-red-50 text-red-500" },
  };
  const cfg = map[step] ?? { label: step, cls: "bg-slate-100 text-slate-500" };
  return <span className={cn("px-1.5 py-0.5 rounded text-xs font-medium whitespace-nowrap", cfg.cls)}>{cfg.label}</span>;
}
