"use client";

/**
 * Unified CRM dashboard.
 *
 * Everything here is read-only on purpose. It answers the four questions a
 * manager actually asks: who is worth looking after, who has gone quiet, what
 * did we take this month, and what is queued to go out.
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  Crown,
  Cake,
  Users,
  Euro,
  CalendarClock,
  Mail,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const SYMBOLS: Record<string, string> = { EUR: "€", GBP: "£", USD: "$", CAD: "$", AUD: "$" };

const TIER_STYLES: Record<string, string> = {
  bronze: "bg-amber-100 text-amber-800 border-amber-300",
  silver: "bg-slate-100 text-slate-700 border-slate-300",
  gold: "bg-yellow-100 text-yellow-800 border-yellow-300",
  vip: "bg-purple-100 text-purple-800 border-purple-300",
};

interface DashboardData {
  currency: string;
  venue: string;
  loyaltyEnabled: boolean;
  guests: { total: number; withConsent: number; lapsed30: number; neverVisited: number; birthdaysThisMonth: number };
  spend: {
    lifetime: number;
    averagePerGuest: number;
    thisMonth: number;
    lastMonth: number;
    thisMonthTransactions: number;
    lastMonthTransactions: number;
    changePct: number | null;
  };
  loyalty: {
    pointsOutstanding: number;
    pointValue: number;
    liabilityValue: number;
    tiers: { key: string; name: string; guests: number; totalSpend: number; points: number }[];
  };
  topGuests: {
    id: string;
    name: string;
    totalSpend: number;
    visitCount: number;
    loyaltyTier: string;
    loyaltyPoints: number;
    lastVisitAt: string | null;
  }[];
  birthdaysThisWeek: { id: string; name: string; birthday: string | null; loyaltyTier: string; gdprConsent: boolean }[];
  upcomingReservations: number;
  recentTransactions: {
    id: string;
    date: string;
    totalSpend: number;
    source: string;
    customer: { id: string; name: string } | null;
  }[];
  campaigns: {
    id: string;
    name: string;
    segment: string;
    channel: string;
    status: string;
    automationRule: string | null;
    active: boolean;
    lastRunAt: string | null;
    _count: { sends: number };
  }[];
  sends: {
    counts: Record<string, number>;
    recent: { id: string; channel: string; sentAt: string | null; subject: string | null; campaign: { id: string; name: string } }[];
  };
}

export default function CrmDashboardTab({ onOpenCampaigns }: { onOpenCampaigns?: () => void }) {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/crm/dashboard");
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Could not load dashboard");
      setData(await res.json());
    } catch (err: any) {
      setError(err?.message || "Could not load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-4 flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-3">
        <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
        <p className="text-xs text-red-800">{error || "No data"}</p>
      </div>
    );
  }

  const sym = SYMBOLS[data.currency] ?? "€";
  const money = (n: number) =>
    `${sym}${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "—";

  const queued = (data.sends.counts.draft ?? 0) + (data.sends.counts.approved ?? 0);
  const noSpendYet = data.spend.lifetime === 0;

  return (
    <div className="px-4 pb-6 space-y-3">
      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-3">
          <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
            <Users className="h-3 w-3" /> Guests
          </div>
          <div className="mt-1 text-xl font-bold text-slate-900">{data.guests.total}</div>
          <div className="text-[10px] text-slate-500">
            {data.guests.withConsent} with marketing consent
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-3">
          <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
            <Euro className="h-3 w-3" /> This month
          </div>
          <div className="mt-1 text-xl font-bold text-slate-900">{money(data.spend.thisMonth)}</div>
          <div className="flex items-center gap-1 text-[10px]">
            {data.spend.changePct === null ? (
              <span className="text-slate-500">{data.spend.thisMonthTransactions} bill(s) recorded</span>
            ) : data.spend.changePct >= 0 ? (
              <span className="flex items-center gap-0.5 text-emerald-600">
                <TrendingUp className="h-3 w-3" /> {data.spend.changePct}% vs last month
              </span>
            ) : (
              <span className="flex items-center gap-0.5 text-red-600">
                <TrendingDown className="h-3 w-3" /> {Math.abs(data.spend.changePct)}% vs last month
              </span>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-3">
          <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
            <TrendingDown className="h-3 w-3" /> Gone quiet
          </div>
          <div className="mt-1 text-xl font-bold text-red-700">{data.guests.lapsed30}</div>
          <div className="text-[10px] text-slate-500">no visit in 30+ days</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-3">
          <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
            <CalendarClock className="h-3 w-3" /> Upcoming
          </div>
          <div className="mt-1 text-xl font-bold text-slate-900">{data.upcomingReservations}</div>
          <div className="text-[10px] text-slate-500">reservations booked ahead</div>
        </div>
      </div>

      {noSpendYet && (
        <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
          <p className="text-xs leading-snug text-amber-900">
            No guest spend recorded yet. Add a bill on a guest profile, or import a CSV, and tiers, points
            and lifetime spend fill in from there. Your POS totals are day-level only, so they cannot be
            split per guest.
          </p>
        </div>
      )}

      {/* Lifetime + loyalty liability */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-3 text-center">
          <div className="text-sm font-bold text-slate-900">{money(data.spend.lifetime)}</div>
          <div className="text-[10px] leading-tight text-slate-500">Lifetime spend</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-3 text-center">
          <div className="text-sm font-bold text-slate-900">{money(data.spend.averagePerGuest)}</div>
          <div className="text-[10px] leading-tight text-slate-500">Avg per guest</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-3 text-center">
          <div className="text-sm font-bold text-slate-900">{data.loyalty.pointsOutstanding.toLocaleString()}</div>
          <div className="text-[10px] leading-tight text-slate-500">
            Points out ({money(data.loyalty.liabilityValue)})
          </div>
        </div>
      </div>

      {/* Tier split */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3">
        <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-900">
          <Crown className="h-3.5 w-3.5 text-yellow-600" /> Loyalty tiers
          {!data.loyaltyEnabled && (
            <Badge variant="outline" className="ml-1 text-[9px]">
              switched off
            </Badge>
          )}
        </h3>
        <div className="space-y-1.5">
          {data.loyalty.tiers.map((t) => {
            const pct = data.guests.total ? Math.round((t.guests / data.guests.total) * 100) : 0;
            return (
              <div key={t.key} className="flex items-center gap-2">
                <span
                  className={cn(
                    "w-16 flex-shrink-0 rounded-full border px-2 py-0.5 text-center text-[10px] font-semibold",
                    TIER_STYLES[t.key] ?? "border-slate-300 bg-slate-100 text-slate-700"
                  )}
                >
                  {t.name}
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-indigo-400" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-16 flex-shrink-0 text-right text-[10px] text-slate-600">
                  {t.guests} guest{t.guests === 1 ? "" : "s"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top guests */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3">
        <h3 className="mb-2 text-xs font-semibold text-slate-900">Top guests by spend</h3>
        {data.topGuests.length === 0 ? (
          <p className="text-[11px] text-slate-500">Nothing recorded yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {data.topGuests.map((g) => (
              <button
                key={g.id}
                onClick={() => router.push(`/crm/${g.id}`)}
                className="flex w-full items-center gap-2 py-2 text-left"
              >
                <span
                  className={cn(
                    "flex-shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase",
                    TIER_STYLES[g.loyaltyTier] ?? "border-slate-300 bg-slate-100 text-slate-700"
                  )}
                >
                  {g.loyaltyTier}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-900">{g.name}</span>
                <span className="flex-shrink-0 text-[10px] text-slate-500">
                  {g.visitCount} visit{g.visitCount === 1 ? "" : "s"}
                </span>
                <span className="w-16 flex-shrink-0 text-right text-xs font-semibold text-slate-900">
                  {money(g.totalSpend)}
                </span>
                <ChevronRight className="h-3 w-3 flex-shrink-0 text-slate-300" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Birthdays */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3">
        <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-900">
          <Cake className="h-3.5 w-3.5 text-pink-500" /> Birthdays this week
          <span className="text-[10px] font-normal text-slate-500">
            ({data.guests.birthdaysThisMonth} this month)
          </span>
        </h3>
        {data.birthdaysThisWeek.length === 0 ? (
          <p className="text-[11px] text-slate-500">
            None in the next 7 days. Birthdays only show for guests whose date of birth you hold.
          </p>
        ) : (
          <div className="space-y-1.5">
            {data.birthdaysThisWeek.map((g) => (
              <button
                key={g.id}
                onClick={() => router.push(`/crm/${g.id}`)}
                className="flex w-full items-center gap-2 text-left"
              >
                <span className="min-w-0 flex-1 truncate text-xs text-slate-900">{g.name}</span>
                <span className="text-[10px] text-slate-500">{fmtDate(g.birthday)}</span>
                {!g.gdprConsent && (
                  <Badge variant="outline" className="text-[9px] text-amber-700">
                    no consent
                  </Badge>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Recent bills */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3">
        <h3 className="mb-2 text-xs font-semibold text-slate-900">Recent bills</h3>
        {data.recentTransactions.length === 0 ? (
          <p className="text-[11px] text-slate-500">No spend recorded yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {data.recentTransactions.map((t) => (
              <div key={t.id} className="flex items-center gap-2 py-1.5">
                <span className="w-12 flex-shrink-0 text-[10px] text-slate-500">{fmtDate(t.date)}</span>
                <span className="min-w-0 flex-1 truncate text-xs text-slate-900">
                  {t.customer?.name ?? "Unknown guest"}
                </span>
                {t.source !== "manual" && (
                  <Badge variant="outline" className="text-[9px] uppercase">
                    {t.source}
                  </Badge>
                )}
                <span className="flex-shrink-0 text-xs font-semibold text-slate-900">{money(t.totalSpend)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Campaign summary */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
            <Mail className="h-3.5 w-3.5 text-indigo-600" /> Campaigns
          </h3>
          {onOpenCampaigns && (
            <button onClick={onOpenCampaigns} className="text-[10px] font-semibold text-indigo-600">
              Manage →
            </button>
          )}
        </div>
        <div className="mb-2 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-slate-50 p-2">
            <div className="text-sm font-bold text-slate-900">{queued}</div>
            <div className="text-[10px] text-slate-500">awaiting review</div>
          </div>
          <div className="rounded-xl bg-slate-50 p-2">
            <div className="text-sm font-bold text-emerald-700">{data.sends.counts.sent ?? 0}</div>
            <div className="text-[10px] text-slate-500">sent</div>
          </div>
          <div className="rounded-xl bg-slate-50 p-2">
            <div className="text-sm font-bold text-slate-500">{data.sends.counts.skipped ?? 0}</div>
            <div className="text-[10px] text-slate-500">skipped</div>
          </div>
        </div>
        {data.campaigns.length === 0 ? (
          <p className="text-[11px] text-slate-500">
            No campaigns yet. Automations queue drafts for review, they never send on their own.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {data.campaigns.map((c) => (
              <div key={c.id} className="flex items-center gap-2 py-1.5">
                <span className="min-w-0 flex-1 truncate text-xs text-slate-900">{c.name}</span>
                {c.automationRule && (
                  <Badge variant="outline" className="text-[9px]">
                    auto
                  </Badge>
                )}
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[9px]",
                    c.status === "sent" && "border-emerald-300 text-emerald-700",
                    c.status === "review" && "border-amber-300 text-amber-700"
                  )}
                >
                  {c.status}
                </Badge>
                <span className="w-10 flex-shrink-0 text-right text-[10px] text-slate-500">
                  {c._count.sends}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
