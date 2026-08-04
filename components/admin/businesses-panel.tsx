"use client";

import { Fragment, useEffect, useState, useCallback } from "react";
import {
  Loader2, Building2, ChevronDown, ChevronRight, AlertTriangle,
  Users, Filter, MapPin, Search,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface BizRow {
  id: string;
  name: string;
  createdAt: string;
  onboardingComplete: boolean;
  currency: string;
  country: string;
  lsPlan: string;
  lsStatus: string;
  users: number;
  employees: number;
  venues: number;
  reservations: number;
  actions30: number;
  lastLoginAt: string | null;
  isProspect: boolean;
  publicSlug: string | null;
  claimable: boolean | null;
  indexable: boolean | null;
}

interface BizUser {
  id: string;
  name: string | null;
  email: string;
  role: string;
  createdAt: string;
  lastLoginAt: string | null;
  loginCount: number;
}

interface DetailPayload {
  id: string;
  name: string;
  createdAt: string;
  onboardingComplete: boolean;
  currency: string;
  country: string;
  lsPlan: string | null;
  lsStatus: string | null;
  lsRenewsAt: string | null;
  lsEndsAt: string | null;
  venues: { id: string; name: string; address: string | null; phone: string | null }[];
  users: BizUser[];
  _count: {
    users: number; employees: number; venues: number;
    reservations: number; expenses: number; customers: number;
  };
  actions30: number;
  views30: number;
  lastAction: { createdAt: string; action: string; userName: string | null } | null;
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" });
}

function fmtDateTime(iso: string | null) {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString("en-IE", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

const PLAN_STYLE: Record<string, string> = {
  enterprise: "bg-violet-100 text-violet-700",
  pro: "bg-emerald-100 text-emerald-700",
  starter: "bg-blue-100 text-blue-700",
  none: "bg-slate-100 text-slate-500",
};

const ROLE_STYLE: Record<string, string> = {
  ADMIN: "bg-rose-100 text-rose-700",
  MANAGER: "bg-amber-100 text-amber-700",
  STAFF: "bg-slate-100 text-slate-600",
};

export function BusinessesPanel({
  activeFilter,
  onFilter,
}: {
  activeFilter?: string;
  onFilter?: (businessId: string) => void;
}) {
  const [rows, setRows] = useState<BizRow[] | null>(null);
  const [summary, setSummary] = useState<{
    total: number; realTotal: number; prospects: number;
    paying: number; empty: number; unclaimable: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, DetailPayload>>({});
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/businesses");
        const json = await res.json();
        if (json.error) setError(json.error);
        else {
          setRows(json.businesses);
          setSummary({
            total: json.total,
            realTotal: json.realTotal ?? json.total,
            prospects: json.prospects ?? 0,
            paying: json.paying,
            empty: json.empty,
            unclaimable: json.unclaimable ?? 0,
          });
        }
      } catch {
        setError("Failed to load businesses");
      }
    })();
  }, []);

  const toggle = useCallback(async (id: string) => {
    if (openId === id) { setOpenId(null); return; }
    setOpenId(id);
    if (details[id]) return;
    setLoadingDetail(id);
    try {
      const res = await fetch(`/api/admin/businesses?businessId=${encodeURIComponent(id)}`);
      const json = await res.json();
      if (json.business) setDetails((d) => ({ ...d, [id]: json.business }));
    } finally {
      setLoadingDetail(null);
    }
  }, [openId, details]);

  if (error) {
    return <div className="bg-white border border-slate-200 rounded-xl p-4 text-sm text-red-500">{error}</div>;
  }

  if (!rows) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 flex justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }

  const needle = q.trim().toLowerCase();
  const filtered = needle
    ? rows.filter((r) => r.name.toLowerCase().includes(needle) || r.id.toLowerCase().includes(needle))
    : rows;

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
        <p className="font-semibold text-slate-800 flex items-center gap-2 text-sm">
          <Building2 className="h-4 w-4 text-slate-400" /> All Businesses
          <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2 py-0.5 rounded-full">
            {summary?.total ?? rows.length}
          </span>
        </p>
        <div className="flex items-center gap-3">
          {summary && summary.paying > 0 && (
            <span className="text-xs text-emerald-600 font-medium">{summary.paying} paying</span>
          )}
          {summary && summary.prospects > 0 && (
            <span className="text-xs text-sky-600 font-medium">
              {summary.prospects} prospect {summary.prospects === 1 ? "page" : "pages"}
            </span>
          )}
          {summary && summary.empty > 0 && (
            <span className="text-xs text-amber-600 font-medium flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> {summary.empty} with no users
            </span>
          )}
          {summary && summary.unclaimable > 0 && (
            <span className="text-xs text-amber-600 font-medium flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> {summary.unclaimable} unclaimable
            </span>
          )}
          <div className="relative">
            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search"
              className="pl-8 pr-2 py-1.5 text-xs border border-slate-200 rounded-lg w-32 sm:w-44 focus:outline-none focus:ring-1 focus:ring-emerald-400"
            />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="text-left font-medium px-4 py-2">Business</th>
              <th className="text-left font-medium px-3 py-2">Plan</th>
              <th className="text-right font-medium px-3 py-2">Users</th>
              <th className="text-right font-medium px-3 py-2">Staff</th>
              <th className="text-right font-medium px-3 py-2">Venues</th>
              <th className="text-right font-medium px-3 py-2">Bookings</th>
              <th className="text-right font-medium px-3 py-2">Actions 30d</th>
              <th className="text-left font-medium px-3 py-2">Last login</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.map((b) => {
              const open = openId === b.id;
              const detail = details[b.id];
              return (
                <Fragment key={b.id}>
                  <tr
                    onClick={() => toggle(b.id)}
                    className={cn("cursor-pointer transition-colors", open ? "bg-slate-50" : "hover:bg-slate-50")}
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        {open ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-400" />}
                        <div className="min-w-0">
                          <p className="font-medium text-slate-800 truncate flex items-center gap-1.5">
                            {b.name}
                            {b.isProspect && (
                              <span
                                title="Marketing page for a venue we don't run — no user account by design"
                                className="bg-sky-100 text-sky-700 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide shrink-0"
                              >
                                Prospect
                              </span>
                            )}
                            {!b.isProspect && b.users === 0 && (
                              <span title="No user account attached — nobody can log in" className="text-amber-500">
                                <AlertTriangle className="h-3.5 w-3.5" />
                              </span>
                            )}
                            {b.isProspect && b.claimable === false && (
                              <span title="No claim token — this page can never be claimed by the owner" className="text-amber-500">
                                <AlertTriangle className="h-3.5 w-3.5" />
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-slate-400">
                            {b.isProspect ? (
                              <>
                                Created {fmtDate(b.createdAt)}
                                {b.publicSlug && ` · /v/${b.publicSlug}`}
                                {b.claimable === false && " · not claimable"}
                                {b.indexable ? " · indexable" : " · noindex"}
                              </>
                            ) : (
                              <>
                                Joined {fmtDate(b.createdAt)} · {b.country} · {b.currency}
                                {!b.onboardingComplete && " · onboarding incomplete"}
                              </>
                            )}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", PLAN_STYLE[b.lsPlan] ?? PLAN_STYLE.none)}>
                        {b.lsPlan}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-700">{b.users}</td>
                    <td className="px-3 py-2.5 text-right text-slate-700">{b.employees}</td>
                    <td className="px-3 py-2.5 text-right text-slate-700">{b.venues}</td>
                    <td className="px-3 py-2.5 text-right text-slate-700">{b.reservations}</td>
                    <td className="px-3 py-2.5 text-right text-slate-700">{b.actions30}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-500 whitespace-nowrap">{fmtDateTime(b.lastLoginAt)}</td>
                    <td className="px-3 py-2.5 text-right">
                      {onFilter && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onFilter(b.id); }}
                          title="Filter activity feed to this business"
                          className={cn(
                            "p-1.5 rounded-lg transition-colors",
                            activeFilter === b.id ? "bg-emerald-100 text-emerald-700" : "text-slate-400 hover:bg-slate-100"
                          )}
                        >
                          <Filter className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>

                  {open && (
                    <tr className="bg-slate-50/60">
                      <td colSpan={9} className="px-4 py-4">
                        {loadingDetail === b.id || !detail ? (
                          <div className="flex justify-center py-4">
                            <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                              {[
                                ["Users", detail._count.users],
                                ["Staff records", detail._count.employees],
                                ["Bookings", detail._count.reservations],
                                ["Expenses", detail._count.expenses],
                                ["Customers", detail._count.customers],
                                ["Page views 30d", detail.views30],
                              ].map(([label, val]) => (
                                <div key={String(label)} className="bg-white border border-slate-200 rounded-lg px-3 py-2">
                                  <p className="text-xs text-slate-400">{label}</p>
                                  <p className="font-semibold text-slate-800">{val as number}</p>
                                </div>
                              ))}
                            </div>

                            {detail.venues.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {detail.venues.map((v) => (
                                  <span key={v.id} className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-600 flex items-center gap-1.5">
                                    <MapPin className="h-3 w-3 text-slate-400" />
                                    {v.name}{v.address ? ` · ${v.address}` : ""}
                                  </span>
                                ))}
                              </div>
                            )}

                            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                              <div className="px-3 py-2 border-b border-slate-100 flex items-center gap-2">
                                <Users className="h-3.5 w-3.5 text-slate-400" />
                                <p className="text-xs font-semibold text-slate-700">
                                  Users in {detail.name} ({detail.users.length})
                                </p>
                              </div>
                              {detail.users.length === 0 ? (
                                <p className="px-3 py-4 text-xs text-amber-600 flex items-center gap-1.5">
                                  <AlertTriangle className="h-3.5 w-3.5" />
                                  No user account is attached to this business — the signup never completed.
                                </p>
                              ) : (
                                <div className="overflow-x-auto">
                                  <table className="w-full min-w-[520px] text-xs">
                                    <thead className="bg-slate-50 text-slate-500">
                                      <tr>
                                        <th className="text-left font-medium px-3 py-1.5">Name</th>
                                        <th className="text-left font-medium px-3 py-1.5">Email</th>
                                        <th className="text-left font-medium px-3 py-1.5">Role</th>
                                        <th className="text-left font-medium px-3 py-1.5">Last login</th>
                                        <th className="text-right font-medium px-3 py-1.5">Logins</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                      {detail.users.map((u) => (
                                        <tr key={u.id}>
                                          <td className="px-3 py-1.5 text-slate-800">{u.name ?? "—"}</td>
                                          <td className="px-3 py-1.5 text-slate-500">{u.email}</td>
                                          <td className="px-3 py-1.5">
                                            <span className={cn("px-1.5 py-0.5 rounded font-medium", ROLE_STYLE[u.role] ?? ROLE_STYLE.STAFF)}>
                                              {u.role}
                                            </span>
                                          </td>
                                          <td className="px-3 py-1.5 text-slate-500 whitespace-nowrap">{fmtDateTime(u.lastLoginAt)}</td>
                                          <td className="px-3 py-1.5 text-right text-slate-600">{u.loginCount}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>

                            <p className="text-xs text-slate-400 font-mono">id: {detail.id}</p>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {filtered.length === 0 && (
        <p className="text-center py-8 text-xs text-slate-400">No business matches “{q}”</p>
      )}
    </div>
  );
}
