"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Loader2, Radio, Eye, Users, Building2, LogIn, Filter,
  ChevronLeft, ChevronRight, Globe, MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface OnlineUser {
  userId: string;
  name: string;
  businessName: string | null;
  path: string | null;
  lastSeen: string | null;
}

interface FeedItem {
  id: string;
  type: "page_view" | "action";
  label: string;
  path: string | null;
  userName: string | null;
  businessId: string | null;
  country: string | null;
  city: string | null;
  referrer: string | null;
  createdAt: string;
  details?: Record<string, unknown>;
}

interface ByBusiness {
  businessId: string | null;
  businessName: string;
  count: number;
}

interface LoginHistoryRow {
  id: string;
  name: string | null;
  email: string;
  role: string;
  lastLoginAt: string | null;
  loginCount: number;
  business: { name: string } | null;
}

interface ActivityData {
  onlineNow: { loggedIn: OnlineUser[]; anonymousCount: number };
  feed: FeedItem[];
  feedTotal: number;
  page: number;
  pages: number;
  byBusiness: ByBusiness[];
  loginHistory: LoginHistoryRow[];
}

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function fmtDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IE", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
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

export function ActivityTab() {
  const [data, setData] = useState<ActivityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [businessFilter, setBusinessFilter] = useState<string>("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (businessFilter) params.set("businessId", businessFilter);
      const res = await fetch(`/api/admin/activity?${params}`);
      const json = await res.json();
      if (json.error) setError(json.error);
      else { setData(json); setError(null); }
    } catch {
      setError("Failed to load activity");
    } finally {
      setLoading(false);
    }
  }, [page, businessFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => load(true), 15000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh, load]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error) {
    return <div className="text-center py-16 text-red-500 text-sm">{error}</div>;
  }

  if (!data) return null;

  const totalOnline = data.onlineNow.loggedIn.length + data.onlineNow.anonymousCount;

  return (
    <div className="space-y-6">
      {/* Online now */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="font-semibold text-slate-800 flex items-center gap-2 text-sm">
            <Radio className="h-4 w-4 text-emerald-500 animate-pulse" /> Online Now
            <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-0.5 rounded-full">
              {totalOnline}
            </span>
          </p>
          <button
            onClick={() => setAutoRefresh((v) => !v)}
            className={cn(
              "text-xs px-2.5 py-1 rounded-full font-medium border transition-colors",
              autoRefresh ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-slate-50 border-slate-200 text-slate-500"
            )}
          >
            {autoRefresh ? "Live · refreshing every 15s" : "Paused"}
          </button>
        </div>
        {data.onlineNow.loggedIn.length === 0 && data.onlineNow.anonymousCount === 0 ? (
          <p className="text-xs text-slate-400">Nobody active in the last 5 minutes</p>
        ) : (
          <div className="space-y-2">
            {data.onlineNow.loggedIn.map((u) => (
              <div key={u.userId} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 flex-shrink-0" />
                  <span className="font-medium text-slate-800 truncate">{u.name}</span>
                  {u.businessName && <span className="text-xs text-slate-400 truncate">· {u.businessName}</span>}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400 flex-shrink-0">
                  <span className="font-mono">{u.path}</span>
                  <span>{timeAgo(u.lastSeen)}</span>
                </div>
              </div>
            ))}
            {data.onlineNow.anonymousCount > 0 && (
              <div className="flex items-center gap-2 text-sm text-slate-500 pt-1 border-t border-slate-50">
                <Eye className="h-3.5 w-3.5 text-slate-400" />
                {data.onlineNow.anonymousCount} anonymous visitor{data.onlineNow.anonymousCount !== 1 ? "s" : ""} browsing
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Live feed */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
            <p className="font-semibold text-slate-800 text-sm">Live Activity Feed</p>
            {businessFilter && (
              <button
                onClick={() => { setBusinessFilter(""); setPage(1); }}
                className="text-xs text-emerald-600 hover:underline flex items-center gap-1"
              >
                <Filter className="h-3 w-3" /> Clear filter
              </button>
            )}
          </div>
          {data.feed.length === 0 ? (
            <p className="text-center py-10 text-slate-400 text-sm">No activity recorded yet</p>
          ) : (
            <div className="divide-y divide-slate-50 max-h-[560px] overflow-y-auto">
              {data.feed.map((item) => (
                <div key={item.id} className="px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors">
                  <div className="min-w-0 flex items-center gap-2">
                    <span className={cn(
                      "h-1.5 w-1.5 rounded-full flex-shrink-0",
                      item.type === "action" ? "bg-violet-500" : "bg-blue-400"
                    )} />
                    <div className="min-w-0">
                      <p className="text-sm text-slate-800 truncate">
                        <span className="font-medium">{item.userName ?? "Anonymous"}</span>
                        {" — "}
                        {item.label}
                        {item.path && <span className="text-slate-400 font-mono text-xs ml-1">{item.path}</span>}
                      </p>
                      {(item.country || item.referrer) && (
                        <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                          {item.country && (
                            <span className="flex items-center gap-1"><Globe className="h-3 w-3" />{item.city ? `${item.city}, ` : ""}{item.country}</span>
                          )}
                          {item.referrer && <span>via {shortRef(item.referrer)}</span>}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-slate-400 flex-shrink-0">{timeAgo(item.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
          {data.pages > 1 && (
            <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
              <p className="text-xs text-slate-400">Page {data.page} of {data.pages}</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="h-7 w-7 p-0" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="outline" className="h-7 w-7 p-0" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar: by business + login history */}
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="font-semibold text-slate-800 mb-3 flex items-center gap-2 text-sm">
              <Building2 className="h-4 w-4 text-slate-400" /> Most Active Businesses (30d)
            </p>
            {data.byBusiness.length === 0 ? (
              <p className="text-xs text-slate-400">No activity yet</p>
            ) : (
              <div className="space-y-2">
                {data.byBusiness.map((b) => (
                  <button
                    key={b.businessId}
                    onClick={() => { setBusinessFilter(b.businessId ?? ""); setPage(1); }}
                    className={cn(
                      "w-full flex items-center justify-between text-xs px-2 py-1.5 rounded-lg transition-colors",
                      businessFilter === b.businessId ? "bg-emerald-50 text-emerald-700" : "hover:bg-slate-50 text-slate-600"
                    )}
                  >
                    <span className="truncate">{b.businessName}</span>
                    <span className="font-semibold flex-shrink-0 ml-2">{b.count}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <p className="font-semibold text-slate-800 flex items-center gap-2 text-sm">
                <LogIn className="h-4 w-4 text-slate-400" /> Login History
              </p>
            </div>
            {data.loginHistory.length === 0 ? (
              <p className="text-center py-6 text-slate-400 text-xs">No logins recorded yet</p>
            ) : (
              <div className="divide-y divide-slate-50 max-h-[400px] overflow-y-auto">
                {data.loginHistory.map((u) => (
                  <div key={u.id} className="px-4 py-2.5">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-slate-800 truncate">{u.name ?? u.email}</p>
                      <span className="text-xs text-slate-400 flex-shrink-0 ml-2">{u.loginCount}x</span>
                    </div>
                    <p className="text-xs text-slate-400">
                      {u.business?.name ? `${u.business.name} · ` : ""}{fmtDateTime(u.lastLoginAt)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
