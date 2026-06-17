// @ts-nocheck
"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Calendar,
  Users,
  Clock,
  BookOpen,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Banknote,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserRole as Role } from "@/types/roles";
import { cn } from "@/lib/utils";

interface DashboardData {
  todayReservations: number;
  todayCovers: number;
  activeShifts: number;
  pendingTimeOff: number;
  totalEmployees: number;
  upcomingReservations: Array<{
    id: string;
    customerName: string;
    time: string;
    partySize: number;
    status: string;
    tableName?: string;
  }>;
  recentShifts: Array<{
    id: string;
    employeeName: string;
    role?: string;
    startTime: string;
    endTime: string;
  }>;
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
  href,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  color: string;
  href?: string;
}) {
  const content = (
    <Card className={cn("border transition-shadow hover:shadow-md", href && "cursor-pointer")}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-slate-500">{title}</p>
            <p className="text-3xl font-bold text-slate-900 mt-1">{value}</p>
            {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
          </div>
          <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", color)}>
            <Icon className="h-5 w-5 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (href) return <Link href={href}>{content}</Link>;
  return content;
}

function statusColor(status: string) {
  switch (status.toLowerCase()) {
    case "confirmed": return "bg-green-100 text-green-800";
    case "cancelled": return "bg-red-100 text-red-800";
    case "seated": return "bg-blue-100 text-blue-800";
    case "completed": return "bg-slate-100 text-slate-600";
    case "no_show": return "bg-orange-100 text-orange-800";
    default: return "bg-slate-100 text-slate-600";
  }
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const isManager =
    session?.user?.role === Role.MANAGER || session?.user?.role === Role.ADMIN;

  useEffect(() => {
    async function load() {
      try {
        const today = new Date().toISOString().split("T")[0];
        const [resRes, shiftsRes, employeesRes, timeoffRes] = await Promise.allSettled([
          fetch(`/api/reservations?date=${today}`),
          fetch(`/api/shifts/list?from=${today}&to=${today}`),
          fetch("/api/employees"),
          isManager ? fetch("/api/timeoff") : Promise.resolve(null),
        ]);

        const reservations =
          resRes.status === "fulfilled" && resRes.value.ok
            ? (await resRes.value.json()).reservations ?? []
            : [];

        const shifts =
          shiftsRes.status === "fulfilled" && shiftsRes.value.ok
            ? (await shiftsRes.value.json()).shifts ?? []
            : [];

        const employees =
          employeesRes.status === "fulfilled" && employeesRes.value.ok
            ? (await employeesRes.value.json()).employees ?? []
            : [];

        const timeoffRequests =
          isManager &&
          timeoffRes.status === "fulfilled" &&
          timeoffRes.value &&
          timeoffRes.value.ok
            ? await timeoffRes.value.json()
            : [];

        const pending = Array.isArray(timeoffRequests)
          ? timeoffRequests.filter((r: any) => r.status === "PENDING" || r.status === "pending")
          : [];

        const upcoming = reservations
          .filter((r: any) =>
            r.status !== "CANCELLED" && r.status !== "NO_SHOW" && r.status !== "COMPLETED"
          )
          .slice(0, 6)
          .map((r: any) => ({
            id: r.id,
            customerName: r.customerName,
            time: r.time,
            partySize: r.partySize,
            status: r.status,
            tableName: r.table?.name,
          }));

        const recentShifts = shifts.slice(0, 5).map((s: any) => ({
          id: s.id,
          employeeName: s.employee
            ? `${s.employee.firstName} ${s.employee.lastName}`
            : "Unassigned",
          role: s.role,
          startTime: new Date(s.startTime).toLocaleTimeString("en-IE", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }),
          endTime: new Date(s.endTime).toLocaleTimeString("en-IE", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }),
        }));

        setData({
          todayReservations: reservations.length,
          todayCovers: reservations.reduce((sum: number, r: any) => sum + (r.partySize ?? 0), 0),
          activeShifts: shifts.length,
          pendingTimeOff: pending.length,
          totalEmployees: employees.length,
          upcomingReservations: upcoming,
          recentShifts,
        });
      } catch (e) {
        console.error("Dashboard load error:", e);
      } finally {
        setLoading(false);
      }
    }

    if (session) load();
  }, [session, isManager]);

  const todayStr = new Date().toLocaleDateString("en-IE", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Good {getGreeting()}, {session?.user?.name?.split(" ")[0] ?? "there"}
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">{todayStr}</p>
      </div>

      {/* Stats */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-5 h-24 bg-slate-100 rounded-xl" />
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            title="Today's Bookings"
            value={data?.todayReservations ?? 0}
            subtitle={`${data?.todayCovers ?? 0} covers`}
            icon={BookOpen}
            color="bg-violet-500"
            href="/bookings"
          />
          <StatCard
            title="Shifts Today"
            value={data?.activeShifts ?? 0}
            subtitle="Scheduled"
            icon={Calendar}
            color="bg-blue-500"
            href="/shifts"
          />
          <StatCard
            title="Employees"
            value={data?.totalEmployees ?? 0}
            subtitle="Active staff"
            icon={Users}
            color="bg-emerald-500"
            href="/employees"
          />
          {isManager && (
            <StatCard
              title="Time Off Pending"
              value={data?.pendingTimeOff ?? 0}
              subtitle="Awaiting approval"
              icon={Clock}
              color={
                (data?.pendingTimeOff ?? 0) > 0 ? "bg-amber-500" : "bg-slate-400"
              }
              href="/timeoff"
            />
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Reservations */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-violet-600" />
                Today's Reservations
              </CardTitle>
              <Link href="/bookings">
                <Button variant="ghost" size="sm" className="text-xs h-7 gap-1">
                  View all <ChevronRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-10 bg-slate-100 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : data?.upcomingReservations.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No reservations today</p>
              </div>
            ) : (
              <div className="space-y-2">
                {data.upcomingReservations.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900">{r.customerName}</p>
                      <p className="text-xs text-slate-500">
                        {r.time} · {r.partySize} guests
                        {r.tableName && ` · ${r.tableName}`}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "text-xs px-2 py-0.5 rounded-full font-medium capitalize",
                        statusColor(r.status)
                      )}
                    >
                      {r.status.toLowerCase()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Today's Shifts */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-600" />
                Today's Shifts
              </CardTitle>
              <Link href="/shifts">
                <Button variant="ghost" size="sm" className="text-xs h-7 gap-1">
                  View all <ChevronRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-10 bg-slate-100 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : data?.recentShifts.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <Calendar className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No shifts scheduled today</p>
              </div>
            ) : (
              <div className="space-y-2">
                {data.recentShifts.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900">{s.employeeName}</p>
                      <p className="text-xs text-slate-500 capitalize">
                        {s.startTime} – {s.endTime}
                        {s.role && ` · ${s.role}`}
                      </p>
                    </div>
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Link href="/bookings">
              <Button variant="outline" size="sm" className="gap-2">
                <BookOpen className="h-4 w-4" /> New Booking
              </Button>
            </Link>
            <Link href="/rota">
              <Button variant="outline" size="sm" className="gap-2">
                <Calendar className="h-4 w-4" /> View Rota
              </Button>
            </Link>
            {isManager && (
              <>
                <Link href="/employees">
                  <Button variant="outline" size="sm" className="gap-2">
                    <Users className="h-4 w-4" /> Add Employee
                  </Button>
                </Link>
                <Link href="/ai">
                  <Button variant="outline" size="sm" className="gap-2">
                    <TrendingUp className="h-4 w-4" /> Staffing Forecast
                  </Button>
                </Link>
                <Link href="/bookkeeping">
                  <Button variant="outline" size="sm" className="gap-2">
                    <Banknote className="h-4 w-4" /> Bookkeeping
                  </Button>
                </Link>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}
