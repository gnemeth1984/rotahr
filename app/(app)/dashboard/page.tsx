import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { UserRole as Role } from "@/types/roles";
import {
  Calendar,
  Clock,
  Users,
  AlertCircle,
  CheckCircle,
  XCircle,
  TrendingUp,
} from "lucide-react";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth/signin");

  const isManager =
    session.user.role === Role.MANAGER || session.user.role === Role.ADMIN;

  const [upcomingShifts, myTimeOff, allShiftsCount, pendingTimeOff, employeeCount] =
    await Promise.all([
      prisma.shift.findMany({
        where: {
          date: { gte: new Date() },
        },
        orderBy: { date: "asc" },
        take: 5,
        include: { employee: true },
      }),
      prisma.timeOffRequest.findMany({
        orderBy: { createdAt: "desc" },
        take: 3,
        include: { employee: true },
      }),
      isManager
        ? prisma.shift.count({ where: { date: { gte: new Date() } } })
        : Promise.resolve(null),
      isManager
        ? prisma.timeOffRequest.count({ where: { status: "pending" } })
        : Promise.resolve(null),
      isManager ? prisma.employee.count() : Promise.resolve(null),
    ]);

  const statusBadgeVariant = (status: string) => {
    if (status === "approved") return "success";
    if (status === "pending") return "warning";
    return "destructive";
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Good {getGreeting()}, {session.user.name?.split(" ")[0] ?? "there"} 👋
        </h1>
        <p className="text-slate-500 mt-1">
          Here&apos;s what&apos;s happening today.
        </p>
      </div>

      {/* Stats */}
      <div className={`grid gap-4 ${isManager ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-2"}`}>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Upcoming Shifts</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">
                  {upcomingShifts.length}
                </p>
              </div>
              <div className="h-12 w-12 bg-blue-50 rounded-xl flex items-center justify-center">
                <Calendar className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Time Off Requests</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">
                  {myTimeOff.length}
                </p>
              </div>
              <div className="h-12 w-12 bg-purple-50 rounded-xl flex items-center justify-center">
                <Clock className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {isManager && (
          <>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Total Employees</p>
                    <p className="text-3xl font-bold text-slate-900 mt-1">
                      {employeeCount ?? 0}
                    </p>
                  </div>
                  <div className="h-12 w-12 bg-green-50 rounded-xl flex items-center justify-center">
                    <Users className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Pending Requests</p>
                    <p className="text-3xl font-bold text-slate-900 mt-1">
                      {pendingTimeOff ?? 0}
                    </p>
                  </div>
                  <div className="h-12 w-12 bg-orange-50 rounded-xl flex items-center justify-center">
                    <AlertCircle className="h-6 w-6 text-orange-500" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upcoming shifts */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Upcoming Shifts</CardTitle>
            <CardDescription>Next scheduled shifts</CardDescription>
          </CardHeader>
          <CardContent>
            {upcomingShifts.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <Calendar className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No upcoming shifts</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingShifts.map((shift) => (
                  <div
                    key={shift.id}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {shift.employee
                          ? `${shift.employee.firstName} ${shift.employee.lastName}`
                          : "Unassigned"}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {formatDate(shift.date)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium text-slate-700">
                        {shift.role ?? "—"}
                      </p>
                      <Badge className="mt-1 text-xs bg-blue-100 text-blue-700">
                        {shift.published ? "Published" : "Draft"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Time off */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Time Off Requests</CardTitle>
            <CardDescription>Recent requests</CardDescription>
          </CardHeader>
          <CardContent>
            {myTimeOff.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <Clock className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No time off requests</p>
              </div>
            ) : (
              <div className="space-y-3">
                {myTimeOff.map((req) => (
                  <div
                    key={req.id}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      {req.status === "approved" ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : req.status === "rejected" ? (
                        <XCircle className="h-4 w-4 text-red-500" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-orange-500" />
                      )}
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {req.employee.firstName} {req.employee.lastName}
                        </p>
                        <p className="text-xs text-slate-500">
                          {formatDate(req.startDate)} — {formatDate(req.endDate)}
                        </p>
                      </div>
                    </div>
                    <Badge variant={statusBadgeVariant(req.status) as any}>
                      {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {isManager && allShiftsCount !== null && allShiftsCount > 0 && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 bg-blue-50 rounded-xl flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-lg font-semibold text-slate-900">
                  {allShiftsCount} upcoming shift{allShiftsCount !== 1 ? "s" : ""} across the team
                </p>
                <p className="text-sm text-slate-500">
                  Go to{" "}
                  <a href="/shifts" className="text-blue-600 hover:underline">
                    Shifts
                  </a>{" "}
                  to manage them
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}
