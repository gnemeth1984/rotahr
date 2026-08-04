"use client";

/**
 * SEO trend chart — "is this actually working?" in one glance.
 *
 * Two things matter and they move on different scales, so impressions get the
 * left axis and clicks the right. Plotting both on one axis would flatten
 * clicks into the baseline and hide the only number that means visits.
 *
 * A 7-day rolling average is drawn alongside the raw daily bars because
 * organic search is violently weekly — Saturday always looks like a collapse
 * next to Tuesday. Judging progress on raw daily numbers leads to panicking at
 * weekends and celebrating on Mondays.
 */

import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

export type TrendPoint = {
  date: string;
  clicks: number;
  impressions: number;
  position: number;
  ctr: number;
};

export type Delta = {
  days: number;
  clicks: { now: number; before: number; changePct: number };
  impressions: { now: number; before: number; changePct: number };
  position: { now: number; before: number; change: number } | null;
} | null;

type Props = {
  trend: TrendPoint[];
  deltas: { week: Delta; month: Delta };
  connected: boolean;
};

const RANGES = [
  { label: "28d", days: 28 },
  { label: "90d", days: 90 },
  { label: "6m", days: 180 },
  { label: "All", days: 100000 },
];

/** Rolling mean over `window` days, so weekday spikes stop reading as trend. */
function rollingAvg(rows: TrendPoint[], key: "clicks" | "impressions", window = 7) {
  return rows.map((_, i) => {
    const from = Math.max(0, i - window + 1);
    const slice = rows.slice(from, i + 1);
    return slice.reduce((s, r) => s + r[key], 0) / slice.length;
  });
}

function DeltaPill({
  label,
  value,
  changePct,
  change,
  invert = false,
  format,
}: {
  label: string;
  value: number;
  changePct?: number;
  change?: number;
  invert?: boolean;
  format?: (n: number) => string;
}) {
  // `change` is used for average position, where the API already flipped the
  // sign so positive always means improvement.
  const raw = changePct ?? change ?? 0;
  const flat = Math.abs(raw) < 0.5;
  const good = invert ? raw < 0 : raw > 0;

  const tone = flat
    ? "text-slate-500 bg-slate-50 border-slate-200"
    : good
    ? "text-emerald-700 bg-emerald-50 border-emerald-200"
    : "text-rose-700 bg-rose-50 border-rose-200";

  const Icon = flat ? Minus : good ? ArrowUpRight : ArrowDownRight;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-1 flex flex-wrap items-baseline gap-2">
        <p className="text-xl font-bold text-slate-900 sm:text-2xl">
          {format ? format(value) : value.toLocaleString()}
        </p>
        <span
          className={`inline-flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold ${tone}`}
        >
          <Icon className="h-3 w-3" />
          {changePct !== undefined
            ? `${Math.abs(changePct).toFixed(0)}%`
            : Math.abs(raw).toFixed(1)}
        </span>
      </div>
    </div>
  );
}

export function SeoTrendChart({ trend, deltas, connected }: Props) {
  const [rangeDays, setRangeDays] = useState(90);

  const rows = useMemo(() => {
    const slice = rangeDays >= trend.length ? trend : trend.slice(-rangeDays);
    const clicksAvg = rollingAvg(slice, "clicks");
    const imprAvg = rollingAvg(slice, "impressions");
    return slice.map((r, i) => ({
      ...r,
      clicksAvg: Number(clicksAvg[i].toFixed(1)),
      impressionsAvg: Number(imprAvg[i].toFixed(1)),
      label: new Date(`${r.date}T00:00:00Z`).toLocaleDateString("en-IE", {
        day: "numeric",
        month: "short",
      }),
    }));
  }, [trend, rangeDays]);

  if (!connected) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <h3 className="text-sm font-semibold text-slate-900">Search performance</h3>
        <p className="mt-1 text-sm text-slate-600">
          Connect Search Console to chart this. Until then the autopilot still publishes — it just
          can&apos;t see what any of it ranks for.
        </p>
      </div>
    );
  }

  if (trend.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-900">Search performance</h3>
        <p className="mt-1 text-sm text-slate-600">
          No snapshots stored yet. Hit &ldquo;Sync Search Console&rdquo; — the first run backfills 90
          days, so the chart starts with real history instead of one dot.
        </p>
      </div>
    );
  }

  const w = deltas.week;
  const m = deltas.month;

  return (
    <div className="space-y-4">
      {/* Week-over-week: the honest read on whether this is working */}
      {w && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <DeltaPill label="Clicks · 7d" value={w.clicks.now} changePct={w.clicks.changePct} />
          <DeltaPill
            label="Impressions · 7d"
            value={w.impressions.now}
            changePct={w.impressions.changePct}
          />
          {w.position && (
            <DeltaPill
              label="Avg position · 7d"
              value={w.position.now}
              change={w.position.change}
              format={(n) => n.toFixed(1)}
            />
          )}
          {m && <DeltaPill label="Clicks · 28d" value={m.clicks.now} changePct={m.clicks.changePct} />}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Search performance</h3>
            <p className="text-[11px] text-slate-500">
              Bars are daily. Lines are the 7-day average — search traffic is weekly, so judge the
              line, not the bars.
            </p>
          </div>
          <div className="flex gap-1 rounded-lg bg-slate-100 p-0.5">
            {RANGES.map((r) => (
              <button
                key={r.label}
                onClick={() => setRangeDays(r.days)}
                className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${
                  rangeDays === r.days
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div className="h-64 w-full sm:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rows} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="imprFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FF6B35" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="#E8365D" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                interval="preserveStartEnd"
                minTickGap={28}
                tickLine={false}
                axisLine={{ stroke: "#e2e8f0" }}
              />
              <YAxis
                yAxisId="impr"
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={false}
                width={44}
              />
              <YAxis
                yAxisId="clicks"
                orientation="right"
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={false}
                width={32}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid #e2e8f0",
                  fontSize: 12,
                  boxShadow: "0 8px 24px rgba(15,28,53,0.08)",
                }}
                formatter={(value, name) => [
                  typeof value === "number" ? value.toLocaleString() : String(value ?? "—"),
                  String(name ?? ""),
                ]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
              <Area
                yAxisId="impr"
                type="monotone"
                dataKey="impressions"
                name="Impressions"
                stroke="#FF6B35"
                strokeWidth={1}
                fill="url(#imprFill)"
              />
              <Line
                yAxisId="impr"
                type="monotone"
                dataKey="impressionsAvg"
                name="Impressions (7d avg)"
                stroke="#E8365D"
                strokeWidth={2}
                dot={false}
              />
              <Line
                yAxisId="clicks"
                type="monotone"
                dataKey="clicks"
                name="Clicks"
                stroke="#0f766e"
                strokeWidth={1}
                strokeOpacity={0.35}
                dot={false}
              />
              <Line
                yAxisId="clicks"
                type="monotone"
                dataKey="clicksAvg"
                name="Clicks (7d avg)"
                stroke="#0f766e"
                strokeWidth={2.5}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
