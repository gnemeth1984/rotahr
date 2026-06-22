"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Users,
  Building2,
  TrendingUp,
  Calendar,
  Search,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  BadgeCheck,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  BarChart2,
  Globe,
  Eye,
  Link2,
  FileText,
  Mail,
} from "lucide-react";
import { EmailCampaignsTab } from "@/components/admin/email-campaigns-tab";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserRow {
  id: string;
  name: string | null;
  email: string;
  role: string;
  createdAt: string;
  businessId: string | null;
  business: {
    id: string;
    name: string;
    onboardingComplete: boolean;
    createdAt: string;
  } | null;
  employees: { id: string }[];
}

interface UserStats {
  totalUsers: number;
  totalBusinesses: number;
  last7days: number;
  last30days: number;
}

interface UserApiResponse {
  users: UserRow[];
  total: number;
  page: number;
  pages: number;
  stats: UserStats;
}

interface AnalyticsData {
  stats: {
    today: number;
    last7days: number;
    last30days: number;
    uniqueSessions: number;
  };
  topPages: { path: string; count: number }[];
  topCountries: { country: string; count: number }[];
  topReferrers: { referrer: string; count: number }[];
  daily: { date: string; count: number }[];
  recent: {
    id: string;
    path: string;
    country: string | null;
    city: string | null;
    referrer: string | null;
    createdAt: string;
  }[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  if (role === "ADMIN")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
        <ShieldCheck className="h-3 w-3" /> Admin
      </span>
    );
  if (role === "MANAGER")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
        <BadgeCheck className="h-3 w-3" /> Manager
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
      <Users className="h-3 w-3" /> Staff
    </span>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-IE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function shortRef(ref: string | null): string {
  if (!ref) return "Direct";
  try {
    const u = new URL(ref);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return ref.slice(0, 30);
  }
}

// Simple CSS bar chart — no extra deps
function MiniBar({ value, max }: { value: number; max: number }) {
  const pct = max === 0 ? 0 : Math.max(4, Math.round((value / max) * 100));
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
        <div
          className="h-2 rounded-full bg-emerald-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-slate-500 w-8 text-right">{value}</span>
    </div>
  );
}

// ─── Analytics Tab ────────────────────────────────────────────────────────────

function AnalyticsTab() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/analytics")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch(() => setError("Failed to load analytics"))
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );

  if (error)
    return (
      <div className="text-center py-16 text-red-500 text-sm">{error}</div>
    );

  if (!data) return null;

  const { stats, topPages, topCountries, topReferrers, daily, recent } = data;
  const maxDaily = Math.max(...daily.map((d) => d.count), 1);
  const maxPage = Math.max(...topPages.map((p) => p.count), 1);
  const maxCountry = Math.max(...topCountries.map((c) => c.count), 1);
  const maxRef = Math.max(...topReferrers.map((r) => r.count), 1);

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Today</p>
          <p className="text-2xl font-bold text-slate-900">{stats.today}</p>
          <div className="flex items-center gap-1 mt-1">
            <Eye className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-xs text-slate-400">page views</span>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Last 7 Days</p>
          <p className="text-2xl font-bold text-emerald-600">{stats.last7days}</p>
          <div className="flex items-center gap-1 mt-1">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-xs text-slate-400">page views</span>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Last 30 Days</p>
          <p className="text-2xl font-bold text-blue-600">{stats.last30days}</p>
          <div className="flex items-center gap-1 mt-1">
            <Calendar className="h-3.5 w-3.5 text-blue-400" />
            <span className="text-xs text-slate-400">page views</span>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Unique Sessions</p>
          <p className="text-2xl font-bold text-violet-600">{stats.uniqueSessions}</p>
          <div className="flex items-center gap-1 mt-1">
            <Users className="h-3.5 w-3.5 text-violet-400" />
            <span className="text-xs text-slate-400">visitors (30d)</span>
          </div>
        </div>
      </div>

      {/* Daily chart — last 14 days */}
      {daily.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-slate-400" /> Daily Views (last 14 days)
          </p>
          <div className="flex items-end gap-1.5 h-24">
            {daily.map((d) => {
              const h = maxDaily === 0 ? 4 : Math.max(4, Math.round((d.count / maxDaily) * 96));
              return (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group">
                  <div
                    className="w-full rounded-t bg-emerald-400 group-hover:bg-emerald-500 transition-colors cursor-default"
                    style={{ height: `${h}px` }}
                    title={`${d.date}: ${d.count} views`}
                  />
                  <span className="text-[9px] text-slate-400 hidden sm:block">
                    {d.date.slice(5)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Top pages + countries + referrers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Top pages */}
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="font-semibold text-slate-800 mb-3 flex items-center gap-2 text-sm">
            <FileText className="h-4 w-4 text-slate-400" /> Top Pages
          </p>
          {topPages.length === 0 ? (
            <p className="text-xs text-slate-400">No data yet</p>
          ) : (
            <div className="space-y-2">
              {topPages.map((p) => (
                <div key={p.path}>
                  <p className="text-xs text-slate-700 truncate mb-0.5" title={p.path}>
                    {p.path}
                  </p>
                  <MiniBar value={p.count} max={maxPage} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top countries */}
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="font-semibold text-slate-800 mb-3 flex items-center gap-2 text-sm">
            <Globe className="h-4 w-4 text-slate-400" /> Top Countries
          </p>
          {topCountries.length === 0 ? (
            <p className="text-xs text-slate-400">No data yet</p>
          ) : (
            <div className="space-y-2">
              {topCountries.map((c) => (
                <div key={c.country}>
                  <p className="text-xs text-slate-700 mb-0.5">{c.country || "Unknown"}</p>
                  <MiniBar value={c.count} max={maxCountry} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top referrers */}
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="font-semibold text-slate-800 mb-3 flex items-center gap-2 text-sm">
            <Link2 className="h-4 w-4 text-slate-400" /> Top Referrers
          </p>
          {topReferrers.length === 0 ? (
            <p className="text-xs text-slate-400">No data yet</p>
          ) : (
            <div className="space-y-2">
              {topReferrers.map((r) => (
                <div key={r.referrer ?? "direct"}>
                  <p className="text-xs text-slate-700 mb-0.5">{shortRef(r.referrer)}</p>
                  <MiniBar value={r.count} max={maxRef} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent views */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <p className="font-semibold text-slate-800 text-sm">Recent Page Views</p>
        </div>
        {recent.length === 0 ? (
          <p className="text-center py-10 text-slate-400 text-sm">No views recorded yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-slate-500 uppercase tracking-wide">
                  <th className="px-4 py-2.5 text-left">Path</th>
                  <th className="px-4 py-2.5 text-left">Country</th>
                  <th className="px-4 py-2.5 text-left">City</th>
                  <th className="px-4 py-2.5 text-left">Referrer</th>
                  <th className="px-4 py-2.5 text-left">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {recent.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-2.5 font-mono text-slate-700">{v.path}</td>
                    <td className="px-4 py-2.5 text-slate-600">{v.country || "—"}</td>
                    <td className="px-4 py-2.5 text-slate-600">{v.city || "—"}</td>
                    <td className="px-4 py-2.5 text-slate-500">{shortRef(v.referrer)}</td>
                    <td className="px-4 py-2.5 text-slate-400">{fmtDateTime(v.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Admin Page ──────────────────────────────────────────────────────────

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"users" | "analytics" | "email">("users");
  const [data, setData] = useState<UserApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");

  useEffect(() => {
    if (status === "authenticated" && session?.user?.role !== "ADMIN") {
      router.replace("/dashboard");
    }
  }, [status, session, router]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (search) params.set("search", search);
      const res = await fetch(`/api/admin/users?${params}`);
      const json = await res.json();
      setData(json);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    if (status === "authenticated" && session?.user?.role === "ADMIN") {
      load();
    }
  }, [load, status, session]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  if (
    status === "loading" ||
    (status === "authenticated" && session?.user?.role !== "ADMIN")
  ) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  const stats = data?.stats;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-red-600" />
          Platform Admin
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          {activeTab === "users"
            ? "All registered users across Rotahr"
            : activeTab === "analytics"
            ? "Landing page visitor analytics"
            : "Email marketing campaigns & audiences"}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        <button
          onClick={() => setActiveTab("users")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "users"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" /> Users
          </span>
        </button>
        <button
          onClick={() => setActiveTab("analytics")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "analytics"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <span className="flex items-center gap-1.5">
            <BarChart2 className="h-3.5 w-3.5" /> Analytics
          </span>
        </button>
        <button
          onClick={() => setActiveTab("email")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "email"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5" /> Email Campaigns
          </span>
        </button>
      </div>

      {/* Analytics tab */}
      {activeTab === "analytics" && <AnalyticsTab />}

      {/* Email Campaigns tab */}
      {activeTab === "email" && <EmailCampaignsTab />}

      {/* Users tab */}
      {activeTab === "users" && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Total Users</p>
              <p className="text-2xl font-bold text-slate-900">{stats?.totalUsers ?? "—"}</p>
              <div className="flex items-center gap-1 mt-1">
                <Users className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-xs text-slate-400">all time</span>
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Businesses</p>
              <p className="text-2xl font-bold text-slate-900">{stats?.totalBusinesses ?? "—"}</p>
              <div className="flex items-center gap-1 mt-1">
                <Building2 className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-xs text-slate-400">registered venues</span>
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Last 7 Days</p>
              <p className="text-2xl font-bold text-emerald-600">{stats?.last7days ?? "—"}</p>
              <div className="flex items-center gap-1 mt-1">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-xs text-slate-400">new signups</span>
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Last 30 Days</p>
              <p className="text-2xl font-bold text-blue-600">{stats?.last30days ?? "—"}</p>
              <div className="flex items-center gap-1 mt-1">
                <Calendar className="h-3.5 w-3.5 text-blue-400" />
                <span className="text-xs text-slate-400">new signups</span>
              </div>
            </div>
          </div>

          {/* Search + table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
              <p className="font-semibold text-slate-800">
                Users {data ? `(${data.total})` : ""}
              </p>
              <form onSubmit={handleSearch} className="flex gap-2">
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search name or email..."
                  className="h-8 text-sm w-56"
                />
                <Button type="submit" size="sm" variant="outline" className="h-8">
                  <Search className="h-3.5 w-3.5" />
                </Button>
                {search && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 text-xs"
                    onClick={() => {
                      setSearch("");
                      setSearchInput("");
                      setPage(1);
                    }}
                  >
                    Clear
                  </Button>
                )}
              </form>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
              </div>
            ) : !data?.users.length ? (
              <div className="text-center py-16 text-slate-400 text-sm">No users found</div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                        <th className="px-4 py-2.5 text-left">User</th>
                        <th className="px-4 py-2.5 text-left">Role</th>
                        <th className="px-4 py-2.5 text-left">Business</th>
                        <th className="px-4 py-2.5 text-left">Onboarding</th>
                        <th className="px-4 py-2.5 text-left">Signed Up</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {data.users.map((u) => (
                        <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-800">{u.name ?? "—"}</p>
                            <p className="text-xs text-slate-400">{u.email}</p>
                          </td>
                          <td className="px-4 py-3">
                            <RoleBadge role={u.role} />
                          </td>
                          <td className="px-4 py-3">
                            {u.business ? (
                              <div>
                                <p className="text-slate-700 font-medium">{u.business.name}</p>
                                <p className="text-xs text-slate-400">
                                  since {fmtDate(u.business.createdAt)}
                                </p>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-xs">No business</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {u.business ? (
                              u.business.onboardingComplete ? (
                                <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                                  <CheckCircle2 className="h-3.5 w-3.5" /> Complete
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                                  <Clock className="h-3.5 w-3.5" /> Pending
                                </span>
                              )
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                                <XCircle className="h-3.5 w-3.5" /> None
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-500 text-xs">
                            {fmtDateTime(u.createdAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="md:hidden divide-y divide-slate-100">
                  {data.users.map((u) => (
                    <div key={u.id} className="px-4 py-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-slate-800 text-sm">{u.name ?? u.email}</p>
                        <RoleBadge role={u.role} />
                      </div>
                      <p className="text-xs text-slate-400">{u.email}</p>
                      {u.business && (
                        <p className="text-xs text-slate-500">
                          {u.business.name} ·{" "}
                          {u.business.onboardingComplete ? (
                            <span className="text-emerald-600">Onboarded</span>
                          ) : (
                            <span className="text-amber-600">Pending</span>
                          )}
                        </p>
                      )}
                      <p className="text-xs text-slate-400">{fmtDateTime(u.createdAt)}</p>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {data.pages > 1 && (
                  <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
                    <p className="text-xs text-slate-400">
                      Page {data.page} of {data.pages}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 w-7 p-0"
                        disabled={page <= 1}
                        onClick={() => setPage((p) => p - 1)}
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 w-7 p-0"
                        disabled={page >= data.pages}
                        onClick={() => setPage((p) => p + 1)}
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
