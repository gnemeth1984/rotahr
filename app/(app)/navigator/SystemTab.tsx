"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Lightbulb, RefreshCw, TrendingDown, TrendingUp } from "lucide-react";
import { Btn, Empty, Panel, Pill, SectionTitle, Spinner } from "./nav-ui";
import { api, errMsg } from "./api";
import type { IdeasResult, SystemPulse, SystemResponse } from "./types";

/**
 * What Navigator can see of Rotahr.
 *
 * This tab exists as much for trust as for information: if an assistant is
 * going to reason about the business, the founder should be able to look at
 * exactly what it was told, and nothing here is shown to him that isn't also in
 * the prompt.
 */
export function SystemTab() {
  const [res, setRes] = useState<SystemResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [ideas, setIdeas] = useState<IdeasResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRes(await api<SystemResponse>("/system"));
      setError(null);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function refresh() {
    setRefreshing(true);
    try {
      setRes(await api<SystemResponse>("/system", { method: "POST" }));
      setError(null);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setRefreshing(false);
    }
  }

  // Same code path as the daily cron, inbox limit included — this only skips
  // the wait, it is not a way round the backpressure.
  async function askForIdeas() {
    setThinking(true);
    setIdeas(null);
    try {
      setIdeas(await api<IdeasResult>("/ideas", { method: "POST" }));
      setError(null);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setThinking(false);
    }
  }

  if (loading) return <Spinner label="Reading the system" />;

  if (res && !res.systemAccess) {
    return (
      <Empty>
        System access is switched off. Turn it on in Setup and Navigator will start seeing Rotahr.
      </Empty>
    );
  }

  const p = res?.data ?? null;

  return (
    <div className="space-y-5">
      <SectionTitle
        right={
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500">
              {res?.refreshedAt
                ? `updated ${res.ageMinutes != null && res.ageMinutes < 60 ? `${res.ageMinutes}m` : `${Math.floor((res.ageMinutes ?? 0) / 60)}h`} ago`
                : "never refreshed"}
            </span>
            <Btn size="sm" variant="ghost" onClick={askForIdeas} loading={thinking}>
              <Lightbulb className="h-3.5 w-3.5" /> Ideas
            </Btn>
            <Btn size="sm" onClick={refresh} loading={refreshing}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Btn>
          </div>
        }
      >
        What Navigator can see
      </SectionTitle>

      {error && (
        <Panel className="border-rose-400/25 bg-rose-500/[0.06] p-4 text-sm text-rose-200">{error}</Panel>
      )}

      {ideas && (
        <Panel className="p-4">
          <div className="flex items-start gap-2">
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-[#ff6b35]" />
            <div className="min-w-0 text-sm">
              {ideas.created > 0 ? (
                <>
                  <div className="font-semibold text-white">
                    {ideas.created} idea{ideas.created > 1 ? "s" : ""} in your task inbox
                  </div>
                  <ul className="mt-1.5 space-y-1 text-slate-300">
                    {ideas.titles.map((t) => (
                      <li key={t}>· {t}</li>
                    ))}
                  </ul>
                </>
              ) : (
                <div className="text-slate-300">
                  Nothing added{ideas.skipped ? ` — ${ideas.skipped}` : "."}
                </div>
              )}
              {ideas.rejected.length > 0 && (
                <div className="mt-2 text-[11px] text-slate-500">
                  Dropped before you saw them: {ideas.rejected.map((r) => r.reason).join(", ")}.
                </div>
              )}
            </div>
          </div>
        </Panel>
      )}

      {res?.lastError && (
        <Panel className="border-amber-400/25 bg-amber-500/[0.06] p-4">
          <div className="flex items-start gap-2 text-sm text-amber-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-semibold">Last refresh failed — showing the previous figures.</div>
              <div className="mt-1 font-mono text-[11px] text-amber-200/80">{res.lastError}</div>
            </div>
          </div>
        </Panel>
      )}

      {!p ? (
        <Empty>No pulse yet. Hit refresh, or wait for the next scheduled run.</Empty>
      ) : (
        <PulseView p={p} />
      )}

      <p className="px-1 text-[11px] leading-relaxed text-slate-500">
        Ideas run automatically each morning and land in the task inbox as drafts — never as a
        notification. Other businesses appear as numbers only — never a customer name, email, phone or note. That
        boundary is enforced in code: if a personal identifier ever reaches this payload the refresh
        fails instead of publishing it.
      </p>
    </div>
  );
}

function PulseView({ p }: { p: SystemPulse }) {
  const f = p.founder;
  const g = p.growth;
  const v = p.myVenue;
  const h = p.health;

  const venueBits: [string, number][] = [
    ["Bookings today", v.bookingsToday],
    ["Covers today", v.coversToday],
    ["HACCP outstanding", v.haccpOverdue],
    ["Out of stock", v.lowStock],
    ["Time off waiting", v.pendingTimeOff],
    ["Certs expiring", v.expiringCerts],
    ["Open repairs", v.openRepairs],
  ];

  return (
    <div className="space-y-5">
      <Panel className="p-4">
        <SectionTitle>The business</SectionTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Real businesses" value={f.realBusinesses} hint={`${f.listingShells} empty listing shells`} />
          <Stat label="Paying" value={f.payingCustomers} hint={f.byPlan.map((b) => `${b.count} ${b.plan}`).join(", ")} />
          <Stat label="MRR" value={`€${f.mrrEur}`} />
          <Stat label="Active 7d" value={f.activeBusinesses7d} hint={f.atRisk ? `${f.atRisk} quiet 7d+` : undefined} />
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
          {f.signups.change >= 0 ? (
            <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
          ) : (
            <TrendingDown className="h-3.5 w-3.5 text-rose-400" />
          )}
          {f.signups.now} signups in 30 days ({f.signups.change >= 0 ? "+" : ""}
          {f.signups.change} vs the 30 before)
        </div>
      </Panel>

      <Panel className="p-4">
        <SectionTitle>What people actually use</SectionTitle>
        {p.usage.length === 0 ? (
          <Empty>No module data.</Empty>
        ) : (
          <div className="space-y-1.5">
            {[...p.usage]
              .sort((a, b) => b.delta - a.delta || b.total - a.total)
              .map((m) => (
                <div key={m.module} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-slate-300">{m.module}</span>
                  <span className="flex items-center gap-2 text-xs text-slate-500">
                    <span>{m.total} total</span>
                    <span>·</span>
                    <span>{m.tenants} tenant{m.tenants === 1 ? "" : "s"}</span>
                    {m.delta > 0 ? (
                      <Pill tone="green">+{m.delta} 7d</Pill>
                    ) : m.total === 0 || m.tenants <= 1 ? (
                      <Pill tone="amber">no traction</Pill>
                    ) : (
                      <Pill>flat</Pill>
                    )}
                  </span>
                </div>
              ))}
          </div>
        )}
      </Panel>

      <Panel className="p-4">
        <SectionTitle>My venue</SectionTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {venueBits.map(([label, n]) => (
            <Stat key={label} label={label} value={n} muted={n === 0} />
          ))}
        </div>
      </Panel>

      <Panel className="p-4">
        <SectionTitle>Growth</SectionTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Blog posts" value={g.blogPosts} hint={`${g.blogPublished7d} this week`} />
          <Stat
            label="Site score"
            value={g.siteScore ?? "—"}
            hint={g.auditAgeDays != null ? `audited ${g.auditAgeDays}d ago` : undefined}
          />
          <Stat label="Clicks 28d" value={g.gscClicks28d} hint={`${g.gscImpressions28d} impressions`} />
          <Stat label="Open rate" value={`${g.openRate}%`} hint={`${g.sends30d} sent 30d`} />
        </div>
        {g.demandGaps.length > 0 && (
          <div className="mt-4">
            <div className="mb-1.5 text-[11px] uppercase tracking-wider text-slate-500">
              Searched for, never clicked
            </div>
            <div className="space-y-1">
              {g.demandGaps.slice(0, 5).map((x) => (
                <div key={x.query} className="flex justify-between gap-3 text-xs">
                  <span className="truncate text-slate-300">{x.query}</span>
                  <span className="shrink-0 text-slate-500">
                    {x.impressions} imp · pos {Math.round(x.position)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Panel>

      <Panel className="p-4">
        <SectionTitle>Shipping &amp; health</SectionTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Deploys 7d" value={p.build.deploys7d} />
          <Stat
            label="Last ship"
            value={p.build.daysSinceLastShip != null ? `${p.build.daysSinceLastShip}d ago` : "—"}
          />
          <Stat label="Cron runs 24h" value={h.cronRuns24h} />
          <Stat label="Cron failures 24h" value={h.cronFailures24h} muted={h.cronFailures24h === 0} />
        </div>

        {(h.failingJobs.length > 0 || h.seoFailures7d > 0) && (
          <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-500/[0.06] p-3 text-xs text-amber-100">
            {h.failingJobs.map((j) => (
              <div key={j.job}>
                {j.job} failed {j.fails}× in 7 days
              </div>
            ))}
            {h.seoFailures7d > 0 && <div>{h.seoFailures7d} SEO job failures in 7 days</div>}
          </div>
        )}

        {p.build.recent.length > 0 && (
          <div className="mt-4 space-y-1">
            {p.build.recent.map((r) => (
              <div key={`${r.at}-${r.label}`} className="flex justify-between gap-3 text-xs">
                <span className="truncate text-slate-300">{r.label}</span>
                <span className="shrink-0 text-slate-500">{r.at.slice(0, 10)}</span>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {p.myActivity.length > 0 && (
        <Panel className="p-4">
          <SectionTitle>What I did in Rotahr this week</SectionTitle>
          <div className="flex flex-wrap gap-1.5">
            {p.myActivity.map((a) => (
              <Pill key={a.action}>
                {a.action.replace(/_/g, " ")} ×{a.count}
              </Pill>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  muted,
}: {
  label: string;
  value: number | string;
  hint?: string;
  muted?: boolean;
}) {
  return (
    <div>
      <div className={`text-xl font-semibold ${muted ? "text-slate-600" : "text-slate-100"}`}>{value}</div>
      <div className="text-[11px] uppercase tracking-wider text-slate-500">{label}</div>
      {hint && <div className="mt-0.5 text-[11px] text-slate-600">{hint}</div>}
    </div>
  );
}
