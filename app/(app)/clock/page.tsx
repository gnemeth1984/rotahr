"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Clock, LogIn, LogOut, Users, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type ClockEvent = {
  id: string;
  type: "in" | "out";
  timestamp: string;
  note?: string;
};

type StaffStatus = {
  employeeId: string;
  firstName: string;
  lastName: string;
  status: "in" | "out" | "no-events";
  lastEvent?: string;
};

export default function ClockPage() {
  const { data: session } = useSession();
  const [events, setEvents] = useState<ClockEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [clocking, setClocking] = useState(false);
  const [staffStatuses, setStaffStatuses] = useState<StaffStatus[]>([]);
  const [now, setNow] = useState(new Date());
  const isManager = session?.user?.role === "MANAGER" || session?.user?.role === "ADMIN";

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  async function fetchEvents() {
    const res = await fetch("/api/clock");
    const d = await res.json();
    setEvents(d.events ?? []);
    setLoading(false);
  }

  async function fetchStaff() {
    const res = await fetch("/api/clock?allStaff=true");
    const d = await res.json();
    setStaffStatuses(d.staffStatuses ?? []);
  }

  useEffect(() => {
    fetchEvents();
    if (isManager) fetchStaff();
  }, [isManager]);

  // Determine current state
  const todayEvents = events.filter((e) => {
    const d = new Date(e.timestamp);
    const today = new Date();
    return (
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate()
    );
  });

  const lastEvent = todayEvents[todayEvents.length - 1];
  const isClockedIn = lastEvent?.type === "in";

  // Calculate hours worked today (sum of in→out pairs)
  let totalMinutes = 0;
  for (let i = 0; i < todayEvents.length - 1; i++) {
    if (todayEvents[i].type === "in") {
      const inTime = new Date(todayEvents[i].timestamp);
      const outEvent = todayEvents.find(
        (e, j) => j > i && e.type === "out"
      );
      if (outEvent) {
        totalMinutes += (new Date(outEvent.timestamp).getTime() - inTime.getTime()) / 60000;
      } else if (isClockedIn) {
        // Still in — count up to now
        totalMinutes += (now.getTime() - inTime.getTime()) / 60000;
      }
    }
  }
  if (todayEvents.length === 1 && isClockedIn) {
    totalMinutes = (now.getTime() - new Date(todayEvents[0].timestamp).getTime()) / 60000;
  }

  const hoursWorked = Math.floor(totalMinutes / 60);
  const minsWorked = Math.floor(totalMinutes % 60);

  async function clockInOut() {
    setClocking(true);
    await fetch("/api/clock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: isClockedIn ? "out" : "in" }),
    });
    await fetchEvents();
    if (isManager) await fetchStaff();
    setClocking(false);
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Clock className="h-6 w-6 text-blue-500" />
          Clock In / Out
        </h1>
        <p className="text-slate-500 mt-1">Track your work hours</p>
      </div>

      {/* Live time */}
      <div className="text-center">
        <p className="text-6xl font-mono font-bold text-slate-900">
          {now.toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </p>
        <p className="text-slate-500 mt-1">
          {now.toLocaleDateString("en-IE", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* Status + Clock button */}
      <div className="flex flex-col items-center gap-4">
        <Badge
          variant={isClockedIn ? "default" : "secondary"}
          className={`text-sm px-4 py-1.5 ${isClockedIn ? "bg-green-500 hover:bg-green-500" : ""}`}
        >
          {isClockedIn ? "● Clocked In" : "○ Clocked Out"}
        </Badge>
        <Button
          onClick={clockInOut}
          disabled={clocking || loading}
          size="lg"
          className={`h-20 w-20 rounded-full text-white font-bold text-lg shadow-lg transition-all ${
            isClockedIn
              ? "bg-red-500 hover:bg-red-600 shadow-red-200"
              : "bg-green-500 hover:bg-green-600 shadow-green-200"
          }`}
        >
          {isClockedIn ? <LogOut className="h-8 w-8" /> : <LogIn className="h-8 w-8" />}
        </Button>
        <p className="text-sm text-slate-500">
          {isClockedIn ? "Tap to clock out" : "Tap to clock in"}
        </p>
      </div>

      {/* Hours today */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 text-center">
        <p className="text-sm text-slate-500 mb-1">Hours worked today</p>
        <p className="text-4xl font-bold text-slate-900">
          {hoursWorked}h {minsWorked}m
        </p>
      </div>

      {/* Today's events */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Today's Events</h2>
        </div>
        {todayEvents.length === 0 ? (
          <p className="px-6 py-8 text-center text-slate-400 text-sm">No events today</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {todayEvents.map((ev) => (
              <div key={ev.id} className="flex items-center gap-4 px-6 py-3">
                <div
                  className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    ev.type === "in" ? "bg-green-100" : "bg-red-100"
                  }`}
                >
                  {ev.type === "in" ? (
                    <LogIn className="h-4 w-4 text-green-600" />
                  ) : (
                    <LogOut className="h-4 w-4 text-red-600" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900 capitalize">
                    Clocked {ev.type}
                  </p>
                  <p className="text-xs text-slate-400">
                    {new Date(ev.timestamp).toLocaleTimeString("en-IE", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Manager: all staff status */}
      {isManager && staffStatuses.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
            <Users className="h-5 w-5 text-slate-400" />
            <h2 className="font-semibold text-slate-900">Staff Status</h2>
            <span className="ml-auto text-sm text-green-600 font-medium">
              {staffStatuses.filter((s) => s.status === "in").length} clocked in
            </span>
          </div>
          <div className="divide-y divide-slate-100">
            {staffStatuses.map((s) => (
              <div key={s.employeeId} className="flex items-center gap-4 px-6 py-3">
                <div
                  className={`h-2 w-2 rounded-full flex-shrink-0 ${
                    s.status === "in" ? "bg-green-500" : "bg-slate-300"
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900">
                    {s.firstName} {s.lastName}
                  </p>
                </div>
                <Badge
                  variant={s.status === "in" ? "default" : "secondary"}
                  className={`text-xs ${s.status === "in" ? "bg-green-500 hover:bg-green-500" : ""}`}
                >
                  {s.status === "in" ? "In" : "Out"}
                </Badge>
                {s.lastEvent && (
                  <span className="text-xs text-slate-400">
                    {new Date(s.lastEvent).toLocaleTimeString("en-IE", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
