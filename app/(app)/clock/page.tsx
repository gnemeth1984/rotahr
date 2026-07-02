"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import {
  Clock, LogIn, LogOut, Users, MapPin, AlertTriangle,
  CheckCircle2, Loader2, Settings, RefreshCw, Navigation, Coffee, Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { getBreakEntitlement, computeShiftState } from "@/lib/services/clock.service";

// ─── Types ───────────────────────────────────────────────────────────────────

type ClockEvent = {
  id: string;
  type: "in" | "out" | "break_start" | "break_end";
  timestamp: string;
  latitude?: number | null;
  longitude?: number | null;
  note?: string;
};

type StaffStatus = {
  employeeId: string;
  firstName: string;
  lastName: string;
  status: "in" | "out" | "no-events";
  lastEvent?: string;
};

type GeoSettings = {
  geoLat: number | null;
  geoLng: number | null;
  geoRadius: number;
};

type GeoState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "ok"; lat: number; lng: number; distance: number }
  | { status: "outside"; lat: number; lng: number; distance: number }
  | { status: "no-premises" }   // manager hasn't set location yet
  | { status: "denied" }        // user blocked location
  | { status: "unavailable" };  // browser doesn't support

// ─── Haversine distance (metres) ─────────────────────────────────────────────

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ClockPage() {
  const { data: session } = useSession();
  const [events, setEvents] = useState<ClockEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [clocking, setClocking] = useState(false);
  const [staffStatuses, setStaffStatuses] = useState<StaffStatus[]>([]);
  const [now, setNow] = useState(new Date());
  const [breakActionLoading, setBreakActionLoading] = useState(false);
  const notifiedLevelRef = useRef<"none" | "15" | "30">("none");

  const [geoSettings, setGeoSettings] = useState<GeoSettings | null>(null);
  const [geoState, setGeoState] = useState<GeoState>({ status: "idle" });

  // Settings sheet
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [geoForm, setGeoForm] = useState({ lat: "", lng: "", radius: "80" });
  const [savingGeo, setSavingGeo] = useState(false);
  const [geoSaved, setGeoSaved] = useState(false);

  const isManager = session?.user?.role === "MANAGER" || session?.user?.role === "ADMIN";

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchEvents = useCallback(async () => {
    const res = await fetch("/api/clock");
    const d = await res.json();
    setEvents(d.events ?? []);
    setLoading(false);
  }, []);

  const fetchStaff = useCallback(async () => {
    const res = await fetch("/api/clock?allStaff=true");
    const d = await res.json();
    setStaffStatuses(d.staffStatuses ?? []);
  }, []);

  const fetchGeo = useCallback(async () => {
    const res = await fetch("/api/business/geo");
    if (res.ok) {
      const d = await res.json();
      const g = d.geo as GeoSettings;
      setGeoSettings(g);
      setGeoForm({
        lat: g.geoLat?.toString() ?? "",
        lng: g.geoLng?.toString() ?? "",
        radius: g.geoRadius?.toString() ?? "80",
      });
    }
  }, []);

  useEffect(() => {
    fetchEvents();
    fetchGeo();
    if (isManager) fetchStaff();
  }, [isManager, fetchEvents, fetchGeo, fetchStaff]);

  // ── Geolocation check ──────────────────────────────────────────────────────

  const checkLocation = useCallback(() => {
    if (!geoSettings) return;

    if (!geoSettings.geoLat || !geoSettings.geoLng) {
      setGeoState({ status: "no-premises" });
      return;
    }

    if (!navigator.geolocation) {
      setGeoState({ status: "unavailable" });
      return;
    }

    setGeoState({ status: "checking" });

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const dist = Math.round(
          haversine(latitude, longitude, geoSettings.geoLat!, geoSettings.geoLng!)
        );
        if (dist <= geoSettings.geoRadius) {
          setGeoState({ status: "ok", lat: latitude, lng: longitude, distance: dist });
        } else {
          setGeoState({ status: "outside", lat: latitude, lng: longitude, distance: dist });
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setGeoState({ status: "denied" });
        } else {
          setGeoState({ status: "unavailable" });
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [geoSettings]);

  // Auto-check location once geo settings are loaded
  useEffect(() => {
    if (geoSettings !== null) checkLocation();
  }, [geoSettings, checkLocation]);

  // ── Derived state ──────────────────────────────────────────────────────────

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
  const shiftState = computeShiftState(todayEvents, now);
  const isClockedIn = shiftState.isClockedIn;
  const isOnBreak = shiftState.isOnBreak;
  const breakEntitlement = getBreakEntitlement(shiftState);
  const breakMinutesTaken = Math.floor(shiftState.breakMs / 60000);

  const totalMinutes = shiftState.workedMs / 60000;
  const hoursWorked = Math.floor(totalMinutes / 60);
  const minsWorked = Math.floor(totalMinutes % 60);

  // Can clock in/out?
  const canClock =
    geoState.status === "ok" ||
    geoState.status === "no-premises"; // if no premises set, allow (manager hasn't configured yet)

  // ── Clock in/out ───────────────────────────────────────────────────────────

  const hasOpenShift = isClockedIn || isOnBreak;

  async function clockInOut() {
    if (!canClock) return;
    setClocking(true);

    const lat = geoState.status === "ok" ? geoState.lat : undefined;
    const lng = geoState.status === "ok" ? geoState.lng : undefined;

    await fetch("/api/clock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: hasOpenShift ? "out" : "in",
        latitude: lat,
        longitude: lng,
      }),
    });
    notifiedLevelRef.current = "none";
    await fetchEvents();
    if (isManager) await fetchStaff();
    // Re-check location after clocking
    checkLocation();
    setClocking(false);
  }

  // ── On break toggle ───────────────────────────────────────────────────────

  async function breakInOut() {
    setBreakActionLoading(true);
    await fetch("/api/clock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: isOnBreak ? "break_end" : "break_start" }),
    });
    await fetchEvents();
    setBreakActionLoading(false);
  }

  // ── Break entitlement reminder (browser notification) ─────────────────────

  useEffect(() => {
    if (!hasOpenShift || isOnBreak) return;
    if (breakEntitlement.dueLevel === "none" || breakEntitlement.satisfied) return;
    if (notifiedLevelRef.current === breakEntitlement.dueLevel) return;

    notifiedLevelRef.current = breakEntitlement.dueLevel;
    const minutes = breakEntitlement.dueLevel === "30" ? 30 : 15;
    const msg =
      breakEntitlement.dueLevel === "30"
        ? `You're entitled to a 30-minute break (worked 6+ hours). Take it now.`
        : `You're entitled to a 15-minute break (worked 4.5+ hours). Take it now.`;

    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification("Break reminder — Rotahr", { body: msg });
    }
  }, [hasOpenShift, isOnBreak, breakEntitlement]);

  // Ask for browser notification permission once, on mount
  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // ── Save geo settings ──────────────────────────────────────────────────────

  async function saveGeoSettings() {
    setSavingGeo(true);
    const res = await fetch("/api/business/geo", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        geoLat: geoForm.lat ? parseFloat(geoForm.lat) : null,
        geoLng: geoForm.lng ? parseFloat(geoForm.lng) : null,
        geoRadius: parseInt(geoForm.radius) || 80,
      }),
    });
    if (res.ok) {
      await fetchGeo();
      setGeoSaved(true);
      setTimeout(() => setGeoSaved(false), 2000);
    }
    setSavingGeo(false);
  }

  // Use current location as premises
  function useCurrentAsHQ() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      setGeoForm((f) => ({
        ...f,
        lat: pos.coords.latitude.toFixed(6),
        lng: pos.coords.longitude.toFixed(6),
      }));
    }, undefined, { enableHighAccuracy: true });
  }

  // ── Geo status UI helpers ──────────────────────────────────────────────────

  function GeoStatusBadge() {
    if (geoState.status === "checking") {
      return (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking location…
        </div>
      );
    }
    if (geoState.status === "ok") {
      return (
        <div className="flex items-center gap-2 text-sm text-emerald-600">
          <CheckCircle2 className="h-4 w-4" />
          On premises · {geoState.distance}m away
        </div>
      );
    }
    if (geoState.status === "outside") {
      return (
        <div className="flex items-center gap-2 text-sm text-red-600">
          <AlertTriangle className="h-4 w-4" />
          Outside premises · {geoState.distance}m away
          <span className="text-red-400">(max {geoSettings?.geoRadius}m)</span>
        </div>
      );
    }
    if (geoState.status === "denied") {
      return (
        <div className="flex items-center gap-2 text-sm text-amber-600">
          <AlertTriangle className="h-4 w-4" />
          Location access denied — enable in browser settings
        </div>
      );
    }
    if (geoState.status === "no-premises") {
      return (
        <div className="flex items-center gap-2 text-sm text-amber-600">
          <MapPin className="h-4 w-4" />
          Premises location not set
          {isManager && (
            <button
              onClick={() => setSettingsOpen(true)}
              className="underline underline-offset-2 text-amber-700 font-medium"
            >
              Set it now
            </button>
          )}
        </div>
      );
    }
    if (geoState.status === "unavailable") {
      return (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Navigation className="h-4 w-4" />
          Location unavailable
        </div>
      );
    }
    return null;
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Clock className="h-6 w-6 text-blue-500" />
            Clock In / Out
          </h1>
          <p className="text-slate-500 mt-0.5 text-sm">Geofenced to premises</p>
        </div>
        {isManager && (
          <button
            onClick={() => setSettingsOpen(true)}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            title="Location settings"
          >
            <Settings className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Live time */}
      <div className="text-center py-2">
        <p className="text-5xl sm:text-6xl font-mono font-bold text-slate-900 tabular-nums">
          {now.toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </p>
        <p className="text-slate-500 mt-1 text-sm">
          {now.toLocaleDateString("en-IE", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* Geo status */}
      <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-4 py-3">
        <GeoStatusBadge />
        <button
          onClick={checkLocation}
          disabled={geoState.status === "checking"}
          className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 transition-colors"
          title="Refresh location"
        >
          <RefreshCw className={cn("h-4 w-4", geoState.status === "checking" && "animate-spin")} />
        </button>
      </div>

      {/* Outside zone warning */}
      {geoState.status === "outside" && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-4 text-sm text-red-700">
          <p className="font-semibold mb-0.5">You are not on the premises</p>
          <p className="text-red-500">
            You need to be within {geoSettings?.geoRadius}m of {geoSettings?.geoLat?.toFixed(4)}, {geoSettings?.geoLng?.toFixed(4)} to clock in or out.
            Move closer and tap the refresh button above.
          </p>
        </div>
      )}

      {/* Break entitlement reminder banner */}
      {hasOpenShift && !isOnBreak && breakEntitlement.dueLevel !== "none" && !breakEntitlement.satisfied && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-4 text-sm text-amber-800 flex items-start gap-3">
          <Coffee className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">
              {breakEntitlement.dueLevel === "30" ? "30-minute break due" : "15-minute break due"}
            </p>
            <p className="text-amber-700 mt-0.5">
              You've worked {breakEntitlement.dueLevel === "30" ? "6+" : "4.5+"} hours today.
              {" "}{breakEntitlement.minutesShort} min still owed under Irish law.
            </p>
          </div>
          <Button size="sm" onClick={breakInOut} disabled={breakActionLoading} className="bg-amber-600 hover:bg-amber-700 flex-shrink-0">
            Take break
          </Button>
        </div>
      )}

      {/* On-break banner */}
      {isOnBreak && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700 flex items-center gap-2">
          <Coffee className="h-4 w-4" />
          On break — tap "End break" when you're back
        </div>
      )}

      {/* Status badge + clock button */}
      <div className="flex flex-col items-center gap-5">
        <Badge
          variant={hasOpenShift ? "default" : "secondary"}
          className={cn(
            "text-sm px-4 py-1.5",
            isOnBreak && "bg-blue-500 hover:bg-blue-500",
            isClockedIn && !isOnBreak && "bg-green-500 hover:bg-green-500"
          )}
        >
          {isOnBreak ? "☕ On Break" : isClockedIn ? "● Clocked In" : "○ Clocked Out"}
        </Badge>

        <button
          onClick={clockInOut}
          disabled={clocking || loading || !canClock}
          className={cn(
            "relative h-24 w-24 rounded-full text-white font-bold text-lg shadow-lg transition-all",
            "flex items-center justify-center",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            hasOpenShift
              ? "bg-red-500 hover:bg-red-600 shadow-red-200 active:scale-95"
              : "bg-green-500 hover:bg-green-600 shadow-green-200 active:scale-95",
            !canClock && "grayscale"
          )}
        >
          {clocking
            ? <Loader2 className="h-8 w-8 animate-spin" />
            : hasOpenShift
            ? <LogOut className="h-8 w-8" />
            : <LogIn className="h-8 w-8" />}
        </button>

        {isClockedIn && (
          <Button
            variant="outline"
            onClick={breakInOut}
            disabled={breakActionLoading}
            className={cn(
              "gap-2",
              isOnBreak ? "border-blue-300 text-blue-700 hover:bg-blue-50" : "border-amber-300 text-amber-700 hover:bg-amber-50"
            )}
          >
            {breakActionLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isOnBreak ? (
              <Play className="h-4 w-4" />
            ) : (
              <Coffee className="h-4 w-4" />
            )}
            {isOnBreak ? "End break" : "On break"}
          </Button>
        )}

        <p className="text-sm text-slate-500">
          {!canClock && geoState.status === "outside"
            ? "Move to premises to clock in/out"
            : !canClock && geoState.status === "denied"
            ? "Allow location access to clock in/out"
            : !canClock && geoState.status === "checking"
            ? "Checking your location…"
            : isOnBreak
            ? "Tap clock out to end shift while on break"
            : isClockedIn
            ? "Tap to clock out"
            : "Tap to clock in"}
        </p>
      </div>

      {/* Hours today */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 text-center">
        <p className="text-sm text-slate-500 mb-1">Hours worked today</p>
        <p className="text-4xl font-bold text-slate-900">
          {hoursWorked}h {minsWorked}m
        </p>
        {breakMinutesTaken > 0 && (
          <p className="text-xs text-slate-400 mt-1">+ {breakMinutesTaken} min break taken</p>
        )}
      </div>

      {/* Today's events */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Today's Events</h2>
        </div>
        {todayEvents.length === 0 ? (
          <p className="px-5 py-8 text-center text-slate-400 text-sm">No events today</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {todayEvents.map((ev) => (
              <div key={ev.id} className="flex items-center gap-3 px-5 py-3">
                <div className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0",
                  ev.type === "in" ? "bg-green-100"
                  : ev.type === "out" ? "bg-red-100"
                  : ev.type === "break_start" ? "bg-amber-100"
                  : "bg-blue-100"
                )}>
                  {ev.type === "in" ? <LogIn className="h-4 w-4 text-green-600" />
                  : ev.type === "out" ? <LogOut className="h-4 w-4 text-red-600" />
                  : ev.type === "break_start" ? <Coffee className="h-4 w-4 text-amber-600" />
                  : <Play className="h-4 w-4 text-blue-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900">
                    {ev.type === "in" ? "Clocked in"
                    : ev.type === "out" ? "Clocked out"
                    : ev.type === "break_start" ? "Break started"
                    : "Break ended"}
                  </p>
                  <p className="text-xs text-slate-400">
                    {new Date(ev.timestamp).toLocaleTimeString("en-IE", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </p>
                </div>
                {/* Show if location was captured */}
                {ev.latitude != null && (
                  <div title={`${ev.latitude?.toFixed(5)}, ${ev.longitude?.toFixed(5)}`}>
                    <MapPin className="h-3.5 w-3.5 text-emerald-400" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Manager: all staff status */}
      {isManager && staffStatuses.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <Users className="h-5 w-5 text-slate-400" />
            <h2 className="font-semibold text-slate-900">Staff Status</h2>
            <span className="ml-auto text-sm text-green-600 font-medium">
              {staffStatuses.filter((s) => s.status === "in").length} clocked in
            </span>
          </div>
          <div className="divide-y divide-slate-100">
            {staffStatuses.map((s) => (
              <div key={s.employeeId} className="flex items-center gap-4 px-5 py-3">
                <div className={cn(
                  "h-2 w-2 rounded-full flex-shrink-0",
                  s.status === "in" ? "bg-green-500" : "bg-slate-300"
                )} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900">
                    {s.firstName} {s.lastName}
                  </p>
                </div>
                <Badge
                  variant={s.status === "in" ? "default" : "secondary"}
                  className={cn("text-xs", s.status === "in" && "bg-green-500 hover:bg-green-500")}
                >
                  {s.status === "in" ? "In" : "Out"}
                </Badge>
                {s.lastEvent && (
                  <span className="text-xs text-slate-400 tabular-nums">
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

      {/* ── Location Settings Sheet (managers only) ── */}
      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl px-5 pb-10 sm:max-w-md sm:mx-auto">
          <SheetHeader className="mb-5">
            <SheetTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-blue-500" />
              Premises Location
            </SheetTitle>
            <p className="text-sm text-slate-500">
              Staff must be within {geoForm.radius}m of these coordinates to clock in or out.
            </p>
          </SheetHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="glat">Latitude</Label>
                <Input
                  id="glat"
                  type="number"
                  step="0.000001"
                  placeholder="e.g. 53.349805"
                  value={geoForm.lat}
                  onChange={(e) => setGeoForm((f) => ({ ...f, lat: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="glng">Longitude</Label>
                <Input
                  id="glng"
                  type="number"
                  step="0.000001"
                  placeholder="e.g. -6.260310"
                  value={geoForm.lng}
                  onChange={(e) => setGeoForm((f) => ({ ...f, lng: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="gradius">Radius (metres)</Label>
              <Input
                id="gradius"
                type="number"
                min={50}
                max={1000}
                step={50}
                value={geoForm.radius}
                onChange={(e) => setGeoForm((f) => ({ ...f, radius: e.target.value }))}
              />
              <p className="text-xs text-slate-400">Default 80m. Min 50m, max 1000m.</p>
            </div>

            {/* Use my current location */}
            <Button
              variant="outline"
              size="sm"
              onClick={useCurrentAsHQ}
              className="w-full gap-2"
              type="button"
            >
              <Navigation className="h-4 w-4" />
              Use my current location as HQ
            </Button>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setSettingsOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={saveGeoSettings}
                disabled={savingGeo || !geoForm.lat || !geoForm.lng}
                className="flex-1 gap-2"
              >
                {savingGeo
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : geoSaved
                  ? <CheckCircle2 className="h-4 w-4 text-green-300" />
                  : null}
                {geoSaved ? "Saved!" : "Save"}
              </Button>
            </div>

            {geoForm.lat && geoForm.lng && (
              <a
                href={`https://www.google.com/maps?q=${geoForm.lat},${geoForm.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-center text-xs text-blue-500 underline underline-offset-2"
              >
                Verify on Google Maps ↗
              </a>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
