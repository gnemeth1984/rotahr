// @ts-nocheck
"use client";

import { useState, useEffect, useRef, Suspense, Component } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  BookOpen,
  Plus,
  Trash2,
  Pencil,
  Loader2,
  Users,
  Clock,
  Bell,
  Flag,
  CheckCircle2,
  Sparkles,
  AlertTriangle,
  Phone,
  ChevronRight,
  CalendarDays,
  MoreHorizontal,
  X,
  StickyNote,
  UserCircle,
} from "lucide-react";
import { UserRole as Role } from "@/types/roles";
import { cn } from "@/lib/utils";

interface Booking {
  id: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  partySize: number;
  date: string;
  time: string;
  duration: number;
  status: string;
  notes: string | null;
  occasion: string | null;
  menuRequired: boolean;
  createdByName: string | null;
  marketingConsent: boolean;
  table: { id: string; name: string; capacity: number } | null;
}

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface BookingFlag {
  id: string;
  note: string;
  resolved: boolean;
  createdAt: string;
  employee: { id: string; firstName: string; lastName: string; email: string };
}

const emptyForm = {
  customerName: "",
  customerEmail: "",
  customerPhone: "",
  partySize: "" as unknown as number,
  date: "",
  time: "",
  occasion: "",
  menuRequired: false,
  notes: "",
  marketingConsent: false,
};

const STATUS_STYLES: Record<string, string> = {
  confirmed: "bg-green-100 text-green-700 border-green-200",
  pending:   "bg-amber-100 text-amber-700 border-amber-200",
  cancelled: "bg-red-100 text-red-600 border-red-200",
  seated:    "bg-blue-100 text-blue-700 border-blue-200",
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return d.toLocaleDateString("en-IE", { weekday: "short", day: "numeric", month: "short" });
}

// Quick date pill filters — computed client-side only to avoid SSR hydration mismatch
function getTodayStr() { return new Date().toISOString().split("T")[0]; }
function getTomorrowStr() { return new Date(Date.now() + 86400000).toISOString().split("T")[0]; }

function BookingsInner() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const deepLinkId = searchParams.get("id");

  // Use empty string on first render to match SSR, then set correct date client-side
  const [TODAY, setTODAY] = useState("");
  const [TOMORROW, setTOMORROW] = useState("");
  useEffect(() => {
    setTODAY(getTodayStr());
    setTOMORROW(getTomorrowStr());
  }, []);

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState("");
  const bookingRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const deepLinkedRef = useRef(false);

  // Selected booking for action sheet
  const [activeBooking, setActiveBooking] = useState<Booking | null>(null);
  const [actionSheetOpen, setActionSheetOpen] = useState(false);

  // Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editBooking, setEditBooking] = useState<Booking | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  // Notify Staff
  const [notifyBooking, setNotifyBooking] = useState<Booking | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [notifyMessage, setNotifyMessage] = useState("");
  const [notifying, setNotifying] = useState(false);

  // Flag
  const [flagBooking, setFlagBooking] = useState<Booking | null>(null);
  const [flagNote, setFlagNote] = useState("");
  const [flagging, setFlagging] = useState(false);

  // AI Assist
  const [aiAssistOpen, setAiAssistOpen] = useState(false);
  const [aiMessage, setAiMessage] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  // Flags panel (inside action sheet)
  const [flags, setFlags] = useState<BookingFlag[]>([]);
  const [flagsLoading, setFlagsLoading] = useState(false);
  const [showFlags, setShowFlags] = useState(false);

  const isManager =
    session?.user?.role === Role.MANAGER || session?.user?.role === Role.ADMIN;

  // Once TODAY is computed client-side, set initial filter
  useEffect(() => {
    if (TODAY && filterDate === "") setFilterDate(TODAY);
  }, [TODAY]);

  useEffect(() => {
    // fetch when filterDate changes — including "" which means "All"
    if (TODAY !== "" || filterDate === "") fetchBookings();
  }, [filterDate, TODAY]);

  // Deep-link: when ?id= is present, switch to that booking's date and open it
  useEffect(() => {
    if (!deepLinkId || loading || deepLinkedRef.current) return;
    const target = bookings.find((b) => b.id === deepLinkId);
    if (target) {
      deepLinkedRef.current = true;
      openActions(target);
      // Scroll the row into view after a short paint delay
      setTimeout(() => {
        bookingRefs.current[deepLinkId]?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 200);
    } else if (!loading) {
      // Booking not on current date filter — switch to its date and re-fetch
      // We'll handle this once we know the date from the API (below)
    }
  }, [deepLinkId, bookings, loading]);

  async function fetchBookings() {
    setLoading(true);
    try {
      const url = filterDate ? `/api/reservations?date=${filterDate}` : "/api/reservations?all=true";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      const list: Booking[] = Array.isArray(data.reservations) ? data.reservations : [];
      setBookings(list);

      // If deep-linking and the booking isn't on today's filter, switch to its date
      if (deepLinkId && !deepLinkedRef.current) {
        const match = list.find((b) => b.id === deepLinkId);
        if (!match) {
          // Fetch single booking to get its date
          const single = await fetch(`/api/reservations/${deepLinkId}`).then((r) => r.ok ? r.json() : null).catch(() => null);
          if (single?.reservation?.date) {
            setFilterDate(single.reservation.date.split("T")[0]);
          }
        }
      }
    } catch {
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }

  // ── Open action sheet ──────────────────────────────────────────────────────
  function openActions(b: Booking) {
    setActiveBooking(b);
    setShowFlags(false);
    setFlags([]);
    setActionSheetOpen(true);
  }

  // ── Edit ───────────────────────────────────────────────────────────────────
  function openEdit(b: Booking) {
    setEditBooking(b);
    setForm({
      customerName: b.customerName,
      customerEmail: b.customerEmail ?? "",
      customerPhone: b.customerPhone ?? "",
      partySize: b.partySize,
      date: b.date.split("T")[0],
      time: b.time,
      occasion: (b as any).occasion ?? "",
      menuRequired: (b as any).menuRequired ?? false,
      notes: b.notes ?? "",
      marketingConsent: b.marketingConsent ?? false,
    });
    setActionSheetOpen(false);
    setDialogOpen(true);
  }

  function openNew() {
    setEditBooking(null);
    setForm({ ...emptyForm, date: getTodayStr() });
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const partySize = parseInt(String(form.partySize));
    if (!partySize || partySize < 1) return;
    const payload = { ...form, partySize };
    setSaving(true);
    try {
      if (editBooking) {
        await fetch(`/api/reservations/${editBooking.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch("/api/reservations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      setDialogOpen(false);
      fetchBookings();
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel(id: string) {
    setActionSheetOpen(false);
    await fetch(`/api/reservations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    });
    fetchBookings();
  }

  async function handleDelete(id: string) {
    setActionSheetOpen(false);
    await fetch(`/api/reservations/${id}`, { method: "DELETE" });
    fetchBookings();
  }

  // ── Notify ─────────────────────────────────────────────────────────────────
  async function openNotify(b: Booking) {
    setNotifyBooking(b);
    setSelectedEmployees([]);
    setNotifyMessage("");
    setActionSheetOpen(false);
    if (employees.length === 0) {
      const res = await fetch("/api/employee/list");
      if (res.ok) {
        const data = await res.json();
        setEmployees(Array.isArray(data.employees) ? data.employees : []);
      }
    }
  }

  async function sendNotifications() {
    if (!notifyBooking || selectedEmployees.length === 0) return;
    setNotifying(true);
    try {
      await fetch("/api/notifications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reservationId: notifyBooking.id,
          employeeIds: selectedEmployees,
          message: notifyMessage || undefined,
        }),
      });
      setNotifyBooking(null);
    } finally {
      setNotifying(false);
    }
  }

  // ── Flag ───────────────────────────────────────────────────────────────────
  function openFlag(b: Booking) {
    setFlagBooking(b);
    setFlagNote("");
    setActionSheetOpen(false);
  }

  async function submitFlag() {
    if (!flagBooking || !flagNote.trim()) return;
    setFlagging(true);
    try {
      await fetch(`/api/bookings/${flagBooking.id}/flag`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: flagNote }),
      });
      setFlagBooking(null);
    } finally {
      setFlagging(false);
    }
  }

  // ── Flags view ─────────────────────────────────────────────────────────────
  async function loadFlags(b: Booking) {
    setShowFlags(true);
    setFlagsLoading(true);
    try {
      const res = await fetch(`/api/bookings/${b.id}/flags`);
      if (res.ok) {
        const data = await res.json();
        setFlags(data.flags ?? []);
      }
    } finally {
      setFlagsLoading(false);
    }
  }

  async function resolveFlag(bookingId: string, flagId: string) {
    await fetch(`/api/bookings/${bookingId}/flags/${flagId}/resolve`, { method: "PATCH" });
    setFlags((prev) => prev.map((f) => f.id === flagId ? { ...f, resolved: true } : f));
  }

  // ── AI Assist ──────────────────────────────────────────────────────────────
  async function handleAiAssist(autoCreate: boolean) {
    if (!aiMessage.trim()) return;
    setAiLoading(true);
    setAiError(null);
    setAiResult(null);
    try {
      const res = await fetch("/api/ai/booking-intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: aiMessage, autoCreate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI intake failed");
      setAiResult(data);
      if (data.autoCreated) fetchBookings();
      else if (data.blockedReason) setAiError(data.blockedReason);
    } catch (e: any) {
      setAiError(e.message);
    } finally {
      setAiLoading(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <h1 className="text-xl font-bold text-slate-900">Bookings</h1>
        <div className="flex items-center gap-2">
          {isManager && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => { setAiAssistOpen(true); setAiResult(null); setAiError(null); setAiMessage(""); }}
              className="gap-1.5 border-violet-300 text-violet-700 hover:bg-violet-50 h-9 px-3"
            >
              <Sparkles className="h-3.5 w-3.5" />
              AI
            </Button>
          )}
          <Button size="sm" onClick={openNew} className="gap-1.5 h-9 px-3">
            <Plus className="h-3.5 w-3.5" />
            New
          </Button>
        </div>
      </div>

      {/* ── Date pill filter ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 pb-3 overflow-x-auto scrollbar-hide">
        {[
          { label: "Today", value: TODAY },
          { label: "Tomorrow", value: TOMORROW },
          { label: "All", value: "" },
        ].map(({ label, value }) => (
          <button
            key={label}
            onClick={() => setFilterDate(value)}
            className={cn(
              "flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium border transition-colors",
              filterDate === value
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
            )}
          >
            {label}
          </button>
        ))}
        {/* Custom date picker */}
        <div className="flex-shrink-0 relative">
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className={cn(
              "pl-8 pr-3 py-1.5 rounded-full text-sm font-medium border transition-colors appearance-none cursor-pointer",
              filterDate && filterDate !== TODAY && filterDate !== TOMORROW
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
            )}
            style={{ colorScheme: "light" }}
          />
          <CalendarDays className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* ── Booking list ───────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-2">
        {loading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
          </div>
        ) : bookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <BookOpen className="h-12 w-12 text-slate-200" />
            <p className="text-slate-400 font-medium">No bookings</p>
            <Button size="sm" variant="outline" onClick={openNew} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Add one
            </Button>
          </div>
        ) : (
          bookings.map((b) => (
            <button
              key={b.id}
              ref={(el) => { bookingRefs.current[b.id] = el; }}
              onClick={() => openActions(b)}
              className={`w-full text-left bg-white border rounded-2xl p-4 active:scale-[0.98] transition-all shadow-sm hover:shadow-md ${
                b.id === deepLinkId ? "border-blue-400 ring-2 ring-blue-200" : "border-slate-200"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                {/* Left: name + info */}
                <div className="min-w-0 flex-1 space-y-2">
                  {/* Name + status */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-900 text-base leading-tight truncate">
                      {b.customerName}
                    </span>
                    <span className={cn(
                      "text-xs font-medium px-2 py-0.5 rounded-full border",
                      STATUS_STYLES[b.status] ?? "bg-slate-100 text-slate-500"
                    )}>
                      {b.status.charAt(0).toUpperCase() + b.status.slice(1)}
                    </span>
                  </div>

                  {/* Time + guests + table */}
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-500">
                    <span className="flex items-center gap-1 font-medium text-slate-700">
                      <Clock className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                      {formatDate(b.date)} · {b.time}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                      {b.partySize} guests
                    </span>
                    {b.table && (
                      <span className="text-slate-400 text-xs self-center">
                        {b.table.name}
                      </span>
                    )}
                  </div>

                  {/* Phone + notes inline */}
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                    {b.customerPhone && (
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        <Phone className="h-3 w-3 flex-shrink-0" />
                        {b.customerPhone}
                      </span>
                    )}
                    {b.notes && (
                      <span className="flex items-center gap-1 text-xs text-slate-400 truncate max-w-[200px]">
                        <StickyNote className="h-3 w-3 flex-shrink-0" />
                        {b.notes}
                      </span>
                    )}
                  </div>

                  {/* Booked by */}
                  {b.createdByName && (
                    <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                      <UserCircle className="h-3 w-3 flex-shrink-0" />
                      Booked by {b.createdByName}
                    </div>
                  )}
                </div>

                {/* Right: chevron */}
                <ChevronRight className="h-4 w-4 text-slate-300 flex-shrink-0 mt-1" />
              </div>
            </button>
          ))
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          ACTION SHEET — slides up from bottom on mobile
      ════════════════════════════════════════════════════════════════════════ */}
      <Sheet open={actionSheetOpen} onOpenChange={setActionSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl px-0 pb-8 max-h-[85vh] overflow-y-auto">
          <SheetHeader className="px-5 pb-3 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <SheetTitle className="text-left text-base">
                  {activeBooking?.customerName}
                </SheetTitle>
                <p className="text-sm text-slate-500 mt-0.5">
                  {activeBooking && formatDate(activeBooking.date)} · {activeBooking?.time} · {activeBooking?.partySize} guests
                </p>
                {activeBooking?.customerPhone && (
                  <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                    <Phone className="h-3 w-3" />{activeBooking.customerPhone}
                  </p>
                )}
                {activeBooking?.occasion && (
                  <p className="text-xs text-slate-500 mt-0.5">🎉 {activeBooking.occasion}</p>
                )}
                {activeBooking?.menuRequired && (
                  <p className="text-xs text-amber-600 mt-0.5 font-medium">📋 Menu pre-order required</p>
                )}
              </div>
              <span className={cn(
                "text-xs font-medium px-2.5 py-1 rounded-full border",
                STATUS_STYLES[activeBooking?.status ?? ""] ?? "bg-slate-100"
              )}>
                {activeBooking?.status?.charAt(0).toUpperCase()}{activeBooking?.status?.slice(1)}
              </span>
            </div>
          </SheetHeader>

          {!showFlags ? (
            /* ── Main action buttons ── */
            <div className="px-4 pt-4 space-y-2">
              {/* Edit */}
              <ActionRow
                icon={<Pencil className="h-4 w-4" />}
                label="Edit Booking"
                color="text-slate-700"
                onClick={() => activeBooking && openEdit(activeBooking)}
              />

              {/* Notify staff */}
              {isManager && (
                <ActionRow
                  icon={<Bell className="h-4 w-4" />}
                  label="Notify Staff"
                  color="text-blue-600"
                  bg="bg-blue-50"
                  onClick={() => activeBooking && openNotify(activeBooking)}
                />
              )}

              {/* Flag */}
              <ActionRow
                icon={<Flag className="h-4 w-4" />}
                label="Flag Booking"
                color="text-amber-600"
                bg="bg-amber-50"
                onClick={() => activeBooking && openFlag(activeBooking)}
              />

              {/* View flags (manager) */}
              {isManager && (
                <ActionRow
                  icon={<StickyNote className="h-4 w-4" />}
                  label="View Flags"
                  color="text-amber-700"
                  bg="bg-amber-50"
                  onClick={() => activeBooking && loadFlags(activeBooking)}
                />
              )}

              {/* Cancel */}
              {activeBooking?.status !== "cancelled" && (
                <ActionRow
                  icon={<X className="h-4 w-4" />}
                  label="Cancel Booking"
                  color="text-orange-600"
                  bg="bg-orange-50"
                  onClick={() => activeBooking && handleCancel(activeBooking.id)}
                />
              )}

              {/* Delete (manager) */}
              {isManager && (
                <ActionRow
                  icon={<Trash2 className="h-4 w-4" />}
                  label="Delete Booking"
                  color="text-red-600"
                  bg="bg-red-50"
                  onClick={() => activeBooking && handleDelete(activeBooking.id)}
                />
              )}
            </div>
          ) : (
            /* ── Flags panel ── */
            <div className="px-4 pt-4 space-y-3">
              <button
                onClick={() => setShowFlags(false)}
                className="text-sm text-slate-500 flex items-center gap-1 mb-1"
              >
                ← Back
              </button>
              {flagsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
                </div>
              ) : flags.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">No flags for this booking.</p>
              ) : (
                flags.map((flag) => (
                  <div
                    key={flag.id}
                    className={cn(
                      "rounded-xl border p-3 text-sm",
                      flag.resolved ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-800">
                          {flag.employee.firstName} {flag.employee.lastName}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {new Date(flag.createdAt).toLocaleDateString("en-IE")}
                        </p>
                        <p className="text-sm text-slate-700 mt-1">{flag.note}</p>
                      </div>
                      {!flag.resolved && activeBooking && (
                        <button
                          onClick={() => resolveFlag(activeBooking.id, flag.id)}
                          className="flex-shrink-0 flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2.5 py-1 rounded-full"
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          Resolve
                        </button>
                      )}
                      {flag.resolved && (
                        <span className="text-xs font-medium text-green-700 bg-green-100 px-2.5 py-1 rounded-full flex-shrink-0">
                          Resolved
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ═══════════════════════════════════════════════════════════════════════
          EDIT / CREATE DIALOG
      ════════════════════════════════════════════════════════════════════════ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md mx-4 rounded-2xl flex flex-col max-h-[90dvh] p-0 gap-0">
          <DialogHeader className="px-5 pt-5 pb-3 border-b border-slate-100 flex-shrink-0">
            <DialogTitle>{editBooking ? "Edit Booking" : "New Booking"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              <div className="space-y-1.5">
                <Label>Customer Name *</Label>
                <Input
                  value={form.customerName}
                  onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                  required
                  placeholder="Full name"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Phone <span className="text-red-500">*</span></Label>
                  <Input
                    value={form.customerPhone}
                    onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
                    placeholder="+353..."
                    type="tel"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Party Size *</Label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={form.partySize === 0 ? "" : form.partySize}
                    onChange={(e) => {
                      const raw = e.target.value;
                      setForm({ ...form, partySize: raw === "" ? ("" as unknown as number) : parseInt(raw) });
                    }}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Date *</Label>
                  <Input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Time *</Label>
                  <Input
                    type="time"
                    value={form.time}
                    onChange={(e) => setForm({ ...form, time: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Email <span className="text-slate-400 font-normal text-xs">(optional)</span></Label>
                <Input
                  type="email"
                  value={form.customerEmail}
                  onChange={(e) => setForm({ ...form, customerEmail: e.target.value })}
                  placeholder="customer@email.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Occasion <span className="text-slate-400 font-normal text-xs">(optional)</span></Label>
                <Input
                  value={form.occasion}
                  onChange={(e) => setForm({ ...form, occasion: e.target.value })}
                  placeholder="Birthday, Anniversary, Work dinner…"
                />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">Menu required</p>
                  <p className="text-xs text-slate-400">Pre-order or set menu needed</p>
                </div>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, menuRequired: !form.menuRequired })}
                  className={cn(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0",
                    form.menuRequired ? "bg-slate-900" : "bg-slate-300"
                  )}
                >
                  <span className={cn(
                    "inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm",
                    form.menuRequired ? "translate-x-6" : "translate-x-1"
                  )} />
                </button>
              </div>
              <div className="space-y-1.5">
                <Label>Notes <span className="text-slate-400 font-normal text-xs">(optional)</span></Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  placeholder="Dietary requirements, allergies, special requests…"
                />
              </div>
              {/* Marketing consent — new bookings only */}
              {!editBooking && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
                  <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">Staff action required</p>
                  <p className="text-sm text-amber-700">
                    Ask the customer if they&apos;re happy to receive offers and updates.
                  </p>
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 rounded border-amber-400 accent-amber-600 flex-shrink-0"
                      checked={form.marketingConsent}
                      onChange={(e) => setForm({ ...form, marketingConsent: e.target.checked })}
                    />
                    <span className="text-sm text-amber-800 font-medium leading-snug">
                      Customer agreed — I confirm this was communicated
                    </span>
                  </label>
                </div>
              )}
            </div>

            {/* Sticky footer */}
            <div className="flex-shrink-0 px-5 py-4 border-t border-slate-100 flex gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="flex-1">
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editBooking ? "Save" : "Create"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════════════
          NOTIFY STAFF DIALOG
      ════════════════════════════════════════════════════════════════════════ */}
      <Dialog open={!!notifyBooking} onOpenChange={(o) => !o && setNotifyBooking(null)}>
        <DialogContent className="max-w-md mx-4 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-blue-500" />
              Notify Staff
            </DialogTitle>
            <DialogDescription>
              {notifyBooking?.customerName} · {notifyBooking && formatDate(notifyBooking.date)} at {notifyBooking?.time}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="max-h-44 overflow-y-auto space-y-1 border rounded-xl p-2">
              {employees.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-3">Loading…</p>
              ) : (
                employees.map((emp) => (
                  <label key={emp.id} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedEmployees.includes(emp.id)}
                      onChange={() => setSelectedEmployees((p) =>
                        p.includes(emp.id) ? p.filter((x) => x !== emp.id) : [...p, emp.id]
                      )}
                      className="rounded w-4 h-4"
                    />
                    <span className="text-sm font-medium">{emp.firstName} {emp.lastName}</span>
                  </label>
                ))
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Message (optional)</Label>
              <Textarea
                value={notifyMessage}
                onChange={(e) => setNotifyMessage(e.target.value)}
                rows={2}
                placeholder="Extra details for the team…"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setNotifyBooking(null)} className="flex-1">Cancel</Button>
            <Button
              onClick={sendNotifications}
              disabled={notifying || selectedEmployees.length === 0}
              className="flex-1 gap-2"
            >
              {notifying && <Loader2 className="h-4 w-4 animate-spin" />}
              Send{selectedEmployees.length > 0 ? ` (${selectedEmployees.length})` : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════════════
          FLAG DIALOG
      ════════════════════════════════════════════════════════════════════════ */}
      <Dialog open={!!flagBooking} onOpenChange={(o) => !o && setFlagBooking(null)}>
        <DialogContent className="max-w-md mx-4 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flag className="h-4 w-4 text-amber-500" />
              Flag Booking
            </DialogTitle>
            <DialogDescription>
              Flag &ldquo;{flagBooking?.customerName}&rdquo; for management attention.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Note *</Label>
            <Textarea
              value={flagNote}
              onChange={(e) => setFlagNote(e.target.value)}
              rows={3}
              placeholder="e.g. Customer has severe nut allergy — confirm with kitchen"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setFlagBooking(null)} className="flex-1">Cancel</Button>
            <Button
              onClick={submitFlag}
              disabled={flagging || !flagNote.trim()}
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-white"
            >
              {flagging && <Loader2 className="h-4 w-4 animate-spin" />}
              Flag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════════════
          AI ASSIST DIALOG
      ════════════════════════════════════════════════════════════════════════ */}
      <Dialog open={aiAssistOpen} onOpenChange={(o) => !o && setAiAssistOpen(false)}>
        <DialogContent className="max-w-md mx-4 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-600" />
              AI Booking Assist
            </DialogTitle>
            <DialogDescription>
              Type or paste a booking request — AI will parse and create it.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Textarea
              value={aiMessage}
              onChange={(e) => setAiMessage(e.target.value)}
              placeholder={`e.g. "Table for 6 Friday at 7:30pm, birthday, one vegan, name Walsh"`}
              className="min-h-[80px] text-sm"
              autoFocus
            />

            {aiError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {aiError}
              </div>
            )}

            {aiResult && (
              <div className="space-y-2 text-sm">
                {aiResult.autoCreated ? (
                  <div className="rounded-xl border border-green-200 bg-green-50 p-3 flex items-center gap-2 text-green-800">
                    <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                    Booking created for <strong>{aiResult.intake?.parsed?.customerName ?? "guest"}</strong>
                  </div>
                ) : (
                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 grid grid-cols-2 gap-x-4 gap-y-2">
                    {[
                      ["Customer", aiResult.intake?.parsed?.customerName],
                      ["Guests", aiResult.intake?.parsed?.partySize],
                      ["Date", aiResult.intake?.parsed?.date],
                      ["Time", aiResult.intake?.parsed?.time],
                      ["Occasion", aiResult.intake?.parsed?.occasion],
                      ["Dietary", aiResult.intake?.parsed?.dietary],
                    ].map(([label, val]) => (
                      <div key={label as string}>
                        <span className="text-xs text-slate-400">{label}</span>
                        <p className={val ? "font-medium text-slate-900 text-sm" : "text-slate-300 italic text-xs"}>
                          {val ?? "—"}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                {aiResult.intake?.warnings?.length > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-2 space-y-1">
                    {aiResult.intake.warnings.map((w: string, i: number) => (
                      <div key={i} className="flex items-center gap-1.5 text-xs text-amber-700">
                        <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                        {w}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 flex-col sm:flex-row">
            {!aiResult?.autoCreated ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => handleAiAssist(false)}
                  disabled={aiLoading || !aiMessage.trim()}
                  className="flex-1 gap-2"
                >
                  {aiLoading && !aiResult ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Parse
                </Button>
                <Button
                  onClick={() => handleAiAssist(true)}
                  disabled={aiLoading || !aiMessage.trim()}
                  className="flex-1 gap-2 bg-violet-600 hover:bg-violet-700 text-white"
                >
                  {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Create Booking
                </Button>
              </>
            ) : (
              <Button onClick={() => setAiAssistOpen(false)} className="flex-1">Done</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Error boundary to surface real error message on screen ────────────────────
class BookingsErrorBoundary extends Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="p-6 m-4 rounded-2xl bg-red-50 border border-red-200 text-sm">
          <p className="font-bold text-red-700 mb-2">Bookings crashed — error details:</p>
          <pre className="text-xs text-red-600 whitespace-pre-wrap break-all">
            {this.state.error.message}
            {"\n\n"}
            {this.state.error.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Suspense wrapper — required for useSearchParams in Next.js App Router ─────
export default function BookingsPage() {
  return (
    <BookingsErrorBoundary>
      <Suspense fallback={null}>
        <BookingsInner />
      </Suspense>
    </BookingsErrorBoundary>
  );
}

// ── Reusable action row component ──────────────────────────────────────────────
function ActionRow({
  icon,
  label,
  color = "text-slate-700",
  bg = "bg-slate-50",
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  color?: string;
  bg?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-colors active:scale-[0.98]",
        bg,
        "hover:opacity-90"
      )}
    >
      <span className={cn("flex-shrink-0", color)}>{icon}</span>
      <span className={cn("text-sm font-medium flex-1 text-left", color)}>{label}</span>
      <ChevronRight className="h-4 w-4 text-slate-300 flex-shrink-0" />
    </button>
  );
}
