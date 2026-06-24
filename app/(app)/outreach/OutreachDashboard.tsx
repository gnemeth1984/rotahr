"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Mail, Users, Send, TrendingUp, RefreshCw, Play,
  ChevronLeft, ChevronRight, Search, Globe, Filter,
  CheckCircle2, Clock, XCircle, AlertCircle, Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  sentToday: number;
  dailyLimit: number;
  batchRunning: boolean;
  byCountry: { country: string; cnt: number }[];
  bySegment: { segment: string; cnt: number }[];
  updatedAt: string;
}

interface Lead {
  id: number;
  name: string;
  email: string;
  segment: string;
  city: string;
  county: string;
  country: string;
  status: string;
  last_contacted: string | null;
  created_at: string;
}

interface Send {
  id: number;
  email: string;
  segment: string;
  step: string;
  subject: string;
  sent_at: string;
}

// ── Status helpers ────────────────────────────────────────────────────────────
const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  new:          { label: "New",        color: "text-blue-600",  bg: "bg-blue-50" },
  contacted:    { label: "Contacted",  color: "text-yellow-600",bg: "bg-yellow-50" },
  followup_1:   { label: "Follow-up 1",color: "text-orange-500",bg: "bg-orange-50" },
  followup_2:   { label: "Follow-up 2",color: "text-orange-600",bg: "bg-orange-50" },
  followup_3:   { label: "Follow-up 3",color: "text-red-500",   bg: "bg-red-50" },
  replied:      { label: "Replied",    color: "text-green-600", bg: "bg-green-50" },
  cold:         { label: "Cold",       color: "text-slate-400", bg: "bg-slate-50" },
  unsubscribed: { label: "Unsub",      color: "text-slate-400", bg: "bg-slate-50" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status] ?? { label: status, color: "text-slate-500", bg: "bg-slate-50" };
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium", cfg.bg, cfg.color)}>
      {cfg.label}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function OutreachDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [sends, setSends] = useState<Send[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadsTotal, setLeadsTotal] = useState(0);
  const [leadsPage, setLeadsPage] = useState(1);
  const [leadsPages, setLeadsPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [batchLoading, setBatchLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [tab, setTab] = useState<"sends" | "leads">("sends");

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchStats = useCallback(async () => {
    const r = await fetch("/api/outreach/stats");
    if (r.ok) setStats(await r.json());
  }, []);

  const fetchSends = useCallback(async () => {
    const r = await fetch("/api/outreach/sends?limit=50");
    if (r.ok) { const d = await r.json(); setSends(d.sends); }
  }, []);

  const fetchLeads = useCallback(async () => {
    const params = new URLSearchParams({ page: String(leadsPage), limit: "50" });
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (countryFilter !== "all") params.set("country", countryFilter);
    if (search.trim()) params.set("search", search.trim());
    const r = await fetch(`/api/outreach/leads?${params}`);
    if (r.ok) {
      const d = await r.json();
      setLeads(d.leads);
      setLeadsTotal(d.total);
      setLeadsPages(d.pages);
    }
  }, [leadsPage, statusFilter, countryFilter, search]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchStats(), fetchSends(), fetchLeads()]);
    setLoading(false);
  }, [fetchStats, fetchSends, fetchLeads]);

  useEffect(() => { refresh(); }, [refresh]);

  // re-fetch leads when filters change
  useEffect(() => {
    setLeadsPage(1);
  }, [statusFilter, countryFilter, search]);

  useEffect(() => {
    if (tab === "leads") fetchLeads();
  }, [leadsPage, statusFilter, countryFilter, tab, fetchLeads]);

  const triggerBatch = async (country?: string) => {
    setBatchLoading(true);
    try {
      const r = await fetch("/api/outreach/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(country ? { country } : {}),
      });
      const d = await r.json();
      if (d.skipped) showToast("Batch already running", false);
      else showToast("Batch started — emails sending in background");
      setTimeout(() => refresh(), 3000);
    } catch {
      showToast("Failed to start batch", false);
    } finally {
      setBatchLoading(false);
    }
  };

  const sentPct = stats ? Math.round((stats.sentToday / stats.dailyLimit) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Email Outreach</h1>
          <p className="text-sm text-slate-500 mt-0.5">AI-powered 5-touch sequence · IE + UK leads</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4 mr-1.5", loading && "animate-spin")} />
            Refresh
          </Button>
          <Button
            size="sm"
            className="bg-green-600 hover:bg-green-700 text-white"
            onClick={() => triggerBatch()}
            disabled={batchLoading || stats?.batchRunning}
          >
            <Play className="h-4 w-4 mr-1.5" />
            {stats?.batchRunning ? "Running…" : "Run Batch"}
          </Button>
        </div>
      </div>

      {/* Stat cards */}
      {stats && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
            <StatCard icon={Users} label="Total Leads" value={stats.total} color="blue" />
            <StatCard icon={Mail} label="New" value={stats.new_count} color="blue" />
            <StatCard icon={Send} label="Contacted" value={stats.contacted} color="yellow" />
            <StatCard icon={TrendingUp} label="In Follow-up" value={stats.followup1 + stats.followup2 + stats.followup3} color="orange" />
            <StatCard icon={CheckCircle2} label="Replied" value={stats.replied} color="green" />
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
            <div className="flex items-center justify-between mt-2 text-xs text-slate-400">
              <span>{stats.batchRunning ? <span className="text-green-600 font-medium animate-pulse">● Batch running…</span> : "No batch running"}</span>
              <span>Cron: Mon–Fri 9am Dublin</span>
            </div>
          </div>

          {/* Country + segment breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <BreakdownCard title="By Country" rows={stats.byCountry.map(r => ({ label: r.country.toUpperCase(), value: r.cnt, total: stats.total }))} />
            <BreakdownCard title="By Segment" rows={stats.bySegment.map(r => ({ label: r.segment, value: r.cnt, total: stats.total }))} />
          </div>
        </>
      )}

      {/* Quick country batch buttons */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => triggerBatch("ie")} disabled={batchLoading}>🇮🇪 IE Only</Button>
        <Button variant="outline" size="sm" onClick={() => triggerBatch("uk")} disabled={batchLoading}>🇬🇧 UK Only</Button>
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
                <th className="text-left px-4 py-3 font-medium text-slate-500">Segment</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">Step</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 hidden md:table-cell">Subject</th>
              </tr>
            </thead>
            <tbody>
              {sends.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-10 text-slate-400">No sends yet</td></tr>
              ) : sends.map((s) => (
                <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap text-xs">
                    {new Date(s.sent_at).toLocaleString("en-IE", { dateStyle: "short", timeStyle: "short" })}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-700">{s.email}</td>
                  <td className="px-4 py-2.5 text-slate-600">{s.segment}</td>
                  <td className="px-4 py-2.5"><StepBadge step={s.step} /></td>
                  <td className="px-4 py-2.5 text-slate-500 hidden md:table-cell max-w-xs truncate">{s.subject}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Lead list */}
      {tab === "leads" && (
        <div className="space-y-3">
          {/* Filters */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search email or name…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 w-56 h-9 text-sm"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36 h-9 text-sm">
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
              <SelectTrigger className="w-28 h-9 text-sm">
                <Globe className="h-3.5 w-3.5 mr-1.5 text-slate-400" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="ie">🇮🇪 IE</SelectItem>
                <SelectItem value="uk">🇬🇧 UK</SelectItem>
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
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Country</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500 hidden lg:table-cell">Last Contact</th>
                </tr>
              </thead>
              <tbody>
                {leads.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-10 text-slate-400">No leads found</td></tr>
                ) : leads.map((l) => (
                  <tr key={l.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-slate-800 text-xs">{l.name}</div>
                      <div className="text-slate-400 font-mono text-xs">{l.email}</div>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 hidden sm:table-cell">{l.segment}</td>
                    <td className="px-4 py-2.5 text-slate-500 hidden md:table-cell">{[l.city, l.county].filter(Boolean).join(", ")}</td>
                    <td className="px-4 py-2.5 text-slate-600 uppercase text-xs">{l.country}</td>
                    <td className="px-4 py-2.5"><StatusBadge status={l.status} /></td>
                    <td className="px-4 py-2.5 text-slate-400 text-xs hidden lg:table-cell">
                      {l.last_contacted ? new Date(l.last_contacted).toLocaleDateString("en-IE") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
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
          "fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium transition-all",
          toast.ok ? "bg-green-600" : "bg-red-600"
        )}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    blue: "text-blue-600 bg-blue-50",
    yellow: "text-yellow-600 bg-yellow-50",
    orange: "text-orange-500 bg-orange-50",
    green: "text-green-600 bg-green-50",
    red: "text-red-500 bg-red-50",
  };
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className={cn("inline-flex p-2 rounded-lg mb-2", colors[color])}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="text-2xl font-bold text-slate-900">{value.toLocaleString()}</div>
      <div className="text-xs text-slate-500 mt-0.5">{label}</div>
    </div>
  );
}

function BreakdownCard({ title, rows }: { title: string; rows: { label: string; value: number; total: number }[] }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <h3 className="text-sm font-semibold text-slate-700 mb-3">{title}</h3>
      <div className="space-y-2">
        {rows.map(r => (
          <div key={r.label} className="flex items-center gap-2">
            <span className="text-xs text-slate-600 w-24 truncate">{r.label}</span>
            <div className="flex-1 bg-slate-100 rounded-full h-1.5">
              <div
                className="h-1.5 rounded-full bg-blue-500 transition-all"
                style={{ width: `${Math.round((r.value / r.total) * 100)}%` }}
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
  const map: Record<string, string> = {
    initial: "bg-blue-50 text-blue-600",
    followup_1: "bg-yellow-50 text-yellow-600",
    followup_2: "bg-orange-50 text-orange-500",
    followup_3: "bg-red-50 text-red-500",
    breakup: "bg-slate-100 text-slate-500",
  };
  return (
    <span className={cn("px-1.5 py-0.5 rounded text-xs font-medium", map[step] ?? "bg-slate-100 text-slate-500")}>
      {step}
    </span>
  );
}
