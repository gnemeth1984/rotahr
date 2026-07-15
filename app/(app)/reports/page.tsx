"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, TrendingUp, TrendingDown, AlertTriangle, Info } from "lucide-react";
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";

interface WeekRow {
  weekStart: string;
  weekLabel: string;
  labourCost: number;
  totalHours: number;
  overtimeHours: number;
  revenue: number | null;
  revenueIsEstimate: boolean;
  labourPct: number | null;
}

interface Summary {
  avgLabourPct: number | null;
  totalLabourCost: number;
  totalOvertimeHours: number;
  hasRevenueData: boolean;
}

const RANGE_OPTIONS = [
  { label: "8 weeks", value: 8 },
  { label: "12 weeks", value: 12 },
  { label: "26 weeks", value: 26 },
];

export default function ReportsPage() {
  const { data: session } = useSession();
  const [weeksParam, setWeeksParam] = useState(12);
  const [weeks, setWeeks] = useState<WeekRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reports/labor-cost?weeks=${weeksParam}`)
      .then((r) => r.json())
      .then((d) => {
        setWeeks(d.weeks || []);
        setSummary(d.summary || null);
      })
      .finally(() => setLoading(false));
  }, [weeksParam]);

  const symbol = "€"; // TODO: derive from business currency setting if needed elsewhere

  const trendDirection = (() => {
    if (weeks.length < 2) return null;
    const withPct = weeks.filter((w) => w.labourPct !== null);
    if (withPct.length < 2) return null;
    const first = withPct[0].labourPct!;
    const last = withPct[withPct.length - 1].labourPct!;
    return last - first;
  })();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reports &amp; Insights</h1>
          <p className="mt-1 text-sm text-slate-500">
            Labour cost vs revenue over time — spot patterns before they hit your margin.
          </p>
        </div>
        <div className="flex gap-2">
          {RANGE_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              size="sm"
              variant={weeksParam === opt.value ? "default" : "outline"}
              onClick={() => setWeeksParam(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="mt-16 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : (
        <>
          {summary && !summary.hasRevenueData && (
            <div className="mt-6 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                No POS revenue data connected yet — revenue figures below are estimated from your weekly
                revenue target (set on the Rota page). Connect a POS under Settings for real figures.
              </span>
            </div>
          )}

          {/* Summary cards */}
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">Avg. labour cost %</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-slate-900">
                    {summary?.avgLabourPct !== null && summary?.avgLabourPct !== undefined
                      ? `${summary.avgLabourPct}%`
                      : "—"}
                  </span>
                  {trendDirection !== null && trendDirection !== undefined && (
                    <Badge
                      variant={trendDirection > 0 ? "destructive" : "success"}
                      className="gap-1"
                    >
                      {trendDirection > 0 ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      {Math.abs(trendDirection).toFixed(1)}pt
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-400">Healthy hospitality target: 25–35%</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">Total labour cost</CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-3xl font-bold text-slate-900">
                  {symbol}
                  {summary?.totalLabourCost.toLocaleString("en-IE", { maximumFractionDigits: 0 }) ?? "—"}
                </span>
                <p className="mt-1 text-xs text-slate-400">Across the selected period</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">Overtime hours</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-slate-900">
                    {summary?.totalOvertimeHours ?? "—"}
                  </span>
                  {summary && summary.totalOvertimeHours > 20 && (
                    <Badge variant="warning" className="gap-1">
                      <AlertTriangle className="h-3 w-3" /> High
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-400">Paid at 1.5x in labour cost above</p>
              </CardContent>
            </Card>
          </div>

          {/* Labour cost vs revenue chart */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-base">Labour cost vs revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={weeks} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="weekLabel" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(value: any, name: any) => [
                        `${symbol}${Number(value).toLocaleString("en-IE", { maximumFractionDigits: 0 })}`,
                        name,
                      ]}
                    />
                    <Legend />
                    <Bar dataKey="revenue" name="Revenue" fill="#93c5fd" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="labourCost" name="Labour cost" fill="#f97316" radius={[4, 4, 0, 0]} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Labour % trend */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-base">Labour cost as % of revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={weeks} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="weekLabel" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} unit="%" />
                    <Tooltip formatter={(value: any) => [`${value}%`, "Labour %"]} />
                    <ReferenceLine y={35} stroke="#ef4444" strokeDasharray="4 4" label={{ value: "35% target", fontSize: 11, fill: "#ef4444" }} />
                    <Line
                      type="monotone"
                      dataKey="labourPct"
                      name="Labour %"
                      stroke="#e8365d"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      connectNulls
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Overtime trend */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-base">Overtime hours per week</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={weeks} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="weekLabel" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="overtimeHours" name="Overtime hours" fill="#facc15" radius={[4, 4, 0, 0]} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
