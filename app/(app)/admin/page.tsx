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
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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

interface Stats {
  totalUsers: number;
  totalBusinesses: number;
  last7days: number;
  last30days: number;
}

interface ApiResponse {
  users: UserRow[];
  total: number;
  page: number;
  pages: number;
  stats: Stats;
}

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

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");

  // Redirect non-admins
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

  if (status === "loading" || (status === "authenticated" && session?.user?.role !== "ADMIN")) {
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
        <p className="text-slate-500 text-sm mt-1">All registered users across Rotahr</p>
      </div>

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
                onClick={() => { setSearch(""); setSearchInput(""); setPage(1); }}
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
    </div>
  );
}
