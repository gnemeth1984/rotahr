"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, Users, Receipt, AlertCircle, RefreshCw, Plug } from "lucide-react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { toast } from "sonner";

interface HourlyBucket {
  hour: number;
  revenue: number;
  transactions: number;
}

interface TopItem {
  name: string;
  count: number;
  revenue: number;
}

interface Snapshot {
  totalRevenue: number;
  totalCovers: number;
  totalTransactions: number;
  hourlyData: HourlyBucket[];
  topItems: TopItem[];
  labourCost: number;
  labourPct: number | null;
  provider: string;
}

interface PosStatus {
  connected: boolean;
  provider?: string;
  lastSyncAt?: string;
}

export default function PosRevenueWidget() {
  const { data: session } = useSession();
  const [status, setStatus] = useState<PosStatus | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);

  const isManagerOrAdmin =
    session?.user?.role === "ADMIN" || session?.user?.role === "MANAGER";

  useEffect(() => {
    if (!isManagerOrAdmin) {
      setLoading(false);
      return;
    }
    fetchAll();
  }, [isManagerOrAdmin]);

  async function fetchAll() {
    setLoading(true);
    try {
      const [statusRes, snapRes] = await Promise.all([
        fetch("/api/pos/status"),
        fetch("/api/pos/snapshot"),
      ]);
      if (!statusRes.ok || !snapRes.ok) {
        setStatus({ connected: false });
        setSnapshot(null);
        return;
      }
      const statusData = await statusRes.json();
      const snapData = await snapRes.json();
      setStatus(statusData);
      setSnapshot(snapData.snapshot ?? null);
    } catch {
      setStatus({ connected: false });
      setSnapshot(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/pos/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("POS data updated");
      fetchAll();
    } catch (err) {
      toast.error(`Sync failed: ${err}`);
    } finally {
      setSyncing(false);
    }
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(n);

  const hourLabel = (h: number) => {
    const ampm = h >= 12 ? "pm" : "am";
    const hour = h % 12 || 12;
    return `${hour}${ampm}`;
  };

  // Employees don't see this widget at all
  if (!isManagerOrAdmin) return null;

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-6 text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Loading POS data…
        </CardContent>
      </Card>
    );
  }

  if (!status?.connected) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center space-y-3">
          <Plug className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="font-medium">No POS connected</p>
          <p className="text-sm text-muted-foreground">
            Connect Lightspeed or Square to see live revenue alongside your rota
          </p>
          <Button asChild size="sm" variant="outline">
            <Link href="/settings/pos">Connect POS →</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const labourColour =
    !snapshot || snapshot.labourPct === null
      ? "text-muted-foreground"
      : snapshot.labourPct > 35
        ? "text-red-600"
        : snapshot.labourPct > 28
          ? "text-amber-600"
          : "text-green-600";

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Today&apos;s Revenue
            <Badge variant="outline" className="text-xs capitalize">
              {status.provider}
            </Badge>
          </CardTitle>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleSync}
            disabled={syncing}
            className="h-7 text-xs"
          >
            <RefreshCw className={`h-3 w-3 mr-1 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing…" : "Sync"}
          </Button>
        </div>
        {status.lastSyncAt && (
          <p className="text-xs text-muted-foreground">
            Last synced{" "}
            {new Date(status.lastSyncAt).toLocaleTimeString("en-IE", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        )}
      </CardHeader>

      <CardContent className="space-y-5">
        {!snapshot ? (
          <div className="flex items-center gap-2 text-muted-foreground py-4">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">No data for today yet. Hit Sync to pull from your POS.</span>
          </div>
        ) : (
          <>
            {/* KPI row */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Revenue</p>
                <p className="text-xl font-bold">{fmt(snapshot.totalRevenue)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  Covers
                </p>
                <p className="text-xl font-bold">{snapshot.totalCovers}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                  <Receipt className="h-3 w-3" />
                  Labour %
                </p>
                <p className={`text-xl font-bold ${labourColour}`}>
                  {snapshot.labourPct !== null ? `${snapshot.labourPct}%` : "—"}
                </p>
                {snapshot.labourCost > 0 && (
                  <p className="text-xs text-muted-foreground">{fmt(snapshot.labourCost)}</p>
                )}
              </div>
            </div>

            {/* Labour % warning */}
            {snapshot.labourPct !== null && snapshot.labourPct > 35 && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-950 rounded-md px-3 py-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                Labour cost is above 35% — review your rota.
              </div>
            )}

            {/* Hourly chart */}
            {snapshot.hourlyData.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">Revenue by hour</p>
                <ResponsiveContainer width="100%" height={120}>
                  <BarChart
                    data={snapshot.hourlyData}
                    margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="hour"
                      tickFormatter={hourLabel}
                      tick={{ fontSize: 10 }}
                      className="text-muted-foreground"
                    />
                    <YAxis tick={{ fontSize: 10 }} className="text-muted-foreground" />
                    <Tooltip
                      formatter={(v) => [fmt(Number(v)), "Revenue"]}
                      labelFormatter={(l) => hourLabel(Number(l))}
                      contentStyle={{ fontSize: 12 }}
                    />
                    <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Top items */}
            {snapshot.topItems.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">Top sellers today</p>
                <div className="space-y-1">
                  {snapshot.topItems.slice(0, 5).map((item) => (
                    <div key={item.name} className="flex items-center justify-between text-sm">
                      <span className="truncate max-w-[60%]">{item.name}</span>
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <span>×{item.count}</span>
                        <span className="font-medium text-foreground">{fmt(item.revenue)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
