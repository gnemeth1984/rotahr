import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { Role } from "@prisma/client";
import {
  Calendar,
  Clock,
  Users,
  CheckCircle,
  XCircle,
  AlertCircle,
  TrendingUp,
} from "lucide-react";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth/signin");

  const isManager =
    session.user.role === Role.MANAGER || session.user.role === Role.ADMIN;

  // Fetch data
  const [upcomingBookings, myTimeOff, allBookings, pendingTimeOff, employeeCount] =
    await Promise.all([
      prisma.booking.findMany({
        where: {
          userId: session.user.id,
          date: { gte: new Date() },
          status: "CONFIRMED",
        },
        orderBy: { date: "asc" },
        take: 5,
      }),
      prisma.timeOffRequest.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: "desc" },
        take: 3,
      }),
      isManager
        ? prisma.booking.count({ where: { date: { gte: new Date() } } })
        : null,
      isManager
        ? prisma.timeOffRequest.count({ where: { status: "PENDING" } })
        : null,
      isManager ? prisma.user.count() : null,
    ]);

  const statusBadgeVariant = (status: string) => {
    if (status === "APPROVED" || status === "CONFIRMED") return "success";
    if (status === "PENDING") return "warning";
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
          Here&apos;s what&apos;s happening with your schedule today.
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
                  {upcomingBookings.length}
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
            <CardDescription>Your next confirmed shifts</CardDescription>
          </CardHeader>
          <CardContent>
            {upcomingBookings.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <Calendar className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No upcoming shifts</p>
                <p className="text-xs mt-1">Use the AI assistant to book one!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingBookings.map((booking) => (
                  <div
                    key={booking.id}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {booking.title}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {formatDate(booking.date)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium text-slate-700">
                        {booking.startTime} — {booking.endTime}
                      </p>
                      <Badge variant="success" className="mt-1 text-xs">
                        Confirmed
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Time off status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Time Off Requests</CardTitle>
            <CardDescription>Your recent requests</CardDescription>
          </CardHeader>
          <CardContent>
            {myTimeOff.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <Clock className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No time off requests</p>
                <p className="text-xs mt-1">Submit one from the Time Off page</p>
              </div>
            ) : (
              <div className="space-y-3">
                {myTimeOff.map((req) => (
                  <div
                    key={req.id}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      {req.status === "APPROVED" ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : req.status === "REJECTED" ? (
                        <XCircle className="h-4 w-4 text-red-500" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-orange-500" />
                      )}
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {formatDate(req.startDate)} — {formatDate(req.endDate)}
                        </p>
                      </div>
                    </div>
                    <Badge variant={statusBadgeVariant(req.status) as any}>
                      {req.status.charAt(0) + req.status.slice(1).toLowerCase()}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Manager: all active bookings overview */}
      {isManager && allBookings !== null && allBookings > 0 && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 bg-blue-50 rounded-xl flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-lg font-semibold text-slate-900">
                  {allBookings} upcoming shift{allBookings !== 1 ? "s" : ""} across the team
                </p>
                <p className="text-sm text-slate-500">
                  Go to <a href="/shifts" className="text-blue-600 hover:underline">Shifts</a> to manage all bookings
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
