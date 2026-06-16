// @ts-nocheck
"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent } from "@/components/ui/card";
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
  ChevronDown,
  ChevronUp,
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
  partySize: 2,
  date: "",
  time: "",
  notes: "",
};

export default function BookingsPage() {
  const { data: session } = useSession();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editBooking, setEditBooking] = useState<Booking | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [filterDate, setFilterDate] = useState("");

  // Notify Staff dialog
  const [notifyBooking, setNotifyBooking] = useState<Booking | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [notifyMessage, setNotifyMessage] = useState("");
  const [notifying, setNotifying] = useState(false);

  // Flag dialog
  const [flagBooking, setFlagBooking] = useState<Booking | null>(null);
  const [flagNote, setFlagNote] = useState("");
  const [flagging, setFlagging] = useState(false);

  // Flags view (manager only, expandable per booking)
  const [expandedFlags, setExpandedFlags] = useState<Record<string, BookingFlag[]>>({});
  const [loadingFlags, setLoadingFlags] = useState<Record<string, boolean>>({});
  const [openFlagRow, setOpenFlagRow] = useState<string | null>(null);

  const isManager =
    session?.user?.role === Role.MANAGER || session?.user?.role === Role.ADMIN;

  useEffect(() => {
    fetchBookings();
  }, [filterDate]);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const url = filterDate
        ? `/api/reservations?date=${filterDate}`
        : "/api/reservations";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setBookings(Array.isArray(data.reservations) ? data.reservations : []);
    } catch {
      setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  const openNew = () => {
    setEditBooking(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (b: Booking) => {
    setEditBooking(b);
    setForm({
      customerName: b.customerName,
      customerEmail: b.customerEmail ?? "",
      customerPhone: b.customerPhone ?? "",
      partySize: b.partySize,
      date: b.date.split("T")[0],
      time: b.time,
      notes: b.notes ?? "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editBooking) {
        await fetch(`/api/reservations/${editBooking.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
      } else {
        await fetch("/api/reservations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
      }
      setDialogOpen(false);
      fetchBookings();
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm("Cancel this booking?")) return;
    await fetch(`/api/reservations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    });
    fetchBookings();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this booking permanently?")) return;
    await fetch(`/api/reservations/${id}`, { method: "DELETE" });
    fetchBookings();
  };

  // ── Notify Staff ────────────────────────────────────────────────────────────
  const openNotify = async (b: Booking) => {
    setNotifyBooking(b);
    setSelectedEmployees([]);
    setNotifyMessage("");
    // fetch employees
    if (employees.length === 0) {
      const res = await fetch("/api/employee/list");
      if (res.ok) {
        const data = await res.json();
        setEmployees(Array.isArray(data.employees) ? data.employees : []);
      }
    }
  };

  const toggleEmployee = (id: string) => {
    setSelectedEmployees((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const sendNotifications = async () => {
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
  };

  // ── Flag Booking ─────────────────────────────────────────────────────────────
  const openFlag = (b: Booking) => {
    setFlagBooking(b);
    setFlagNote("");
  };

  const submitFlag = async () => {
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
  };

  // ── View Flags (manager) ──────────────────────────────────────────────────────
  const toggleFlags = async (bookingId: string) => {
    if (openFlagRow === bookingId) {
      setOpenFlagRow(null);
      return;
    }
    setOpenFlagRow(bookingId);
    if (!expandedFlags[bookingId]) {
      setLoadingFlags((p) => ({ ...p, [bookingId]: true }));
      try {
        const res = await fetch(`/api/bookings/${bookingId}/flags`);
        if (res.ok) {
          const data = await res.json();
          setExpandedFlags((p) => ({ ...p, [bookingId]: data.flags ?? [] }));
        }
      } finally {
        setLoadingFlags((p) => ({ ...p, [bookingId]: false }));
      }
    }
  };

  const resolveFlag = async (bookingId: string, flagId: string) => {
    await fetch(`/api/bookings/${bookingId}/flags/${flagId}/resolve`, {
      method: "PATCH",
    });
    setExpandedFlags((p) => ({
      ...p,
      [bookingId]: (p[bookingId] ?? []).map((f) =>
        f.id === flagId ? { ...f, resolved: true } : f
      ),
    }));
  };

  const statusVariant = (s: string) => {
    if (s === "confirmed") return "default";
    if (s === "cancelled") return "destructive";
    return "secondary";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Bookings</h1>
          <p className="text-slate-500 mt-1">Manage table reservations</p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="h-4 w-4" />
          New Booking
        </Button>
      </div>

      {/* Date filter */}
      <div className="flex items-center gap-3">
        <Input
          type="date"
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
          className="w-48"
        />
        {filterDate && (
          <Button variant="ghost" size="sm" onClick={() => setFilterDate("")}>
            Clear
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
        </div>
      ) : bookings.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <BookOpen className="h-12 w-12 mx-auto mb-3 text-slate-200" />
            <p className="text-slate-500 font-medium">No bookings found</p>
            <p className="text-slate-400 text-sm mt-1">
              Create one or ask the AI assistant.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {bookings.map((b) => (
            <Card key={b.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-slate-900">{b.customerName}</p>
                      <Badge variant={statusVariant(b.status) as any}>
                        {b.status.charAt(0).toUpperCase() + b.status.slice(1)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-slate-500 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {new Date(b.date).toLocaleDateString("en-IE", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                        })}{" "}
                        at {b.time}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {b.partySize} guests
                      </span>
                      {b.table && (
                        <span className="text-slate-400">{b.table.name}</span>
                      )}
                    </div>
                    {b.customerPhone && (
                      <p className="text-xs text-slate-400 mt-1">{b.customerPhone}</p>
                    )}
                    {b.notes && (
                      <p className="text-xs text-slate-400 mt-1 truncate">{b.notes}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                    {/* Edit */}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => openEdit(b)}
                      title="Edit booking"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>

                    {/* Notify Staff — manager only */}
                    {isManager && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                        onClick={() => openNotify(b)}
                        title="Notify staff"
                      >
                        <Bell className="h-3.5 w-3.5" />
                      </Button>
                    )}

                    {/* Flag Booking — all users */}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-amber-500 hover:text-amber-700 hover:bg-amber-50"
                      onClick={() => openFlag(b)}
                      title="Flag booking"
                    >
                      <Flag className="h-3.5 w-3.5" />
                    </Button>

                    {/* View Flags — manager only */}
                    {isManager && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className={cn(
                          "h-8 w-8",
                          openFlagRow === b.id
                            ? "text-amber-600 bg-amber-50"
                            : "text-slate-400"
                        )}
                        onClick={() => toggleFlags(b.id)}
                        title="View flags"
                      >
                        {openFlagRow === b.id ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    )}

                    {/* Cancel */}
                    {b.status !== "cancelled" && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-orange-500 hover:text-orange-700 hover:bg-orange-50"
                        onClick={() => handleCancel(b.id)}
                        title="Cancel booking"
                      >
                        <Clock className="h-3.5 w-3.5" />
                      </Button>
                    )}

                    {/* Delete — manager only */}
                    {isManager && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleDelete(b.id)}
                        title="Delete booking"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Flags panel (manager, expandable) */}
                {isManager && openFlagRow === b.id && (
                  <div className="mt-4 border-t pt-3">
                    {loadingFlags[b.id] ? (
                      <div className="flex items-center gap-2 text-sm text-slate-400">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Loading flags...
                      </div>
                    ) : !expandedFlags[b.id] ||
                      expandedFlags[b.id].length === 0 ? (
                      <p className="text-sm text-slate-400">No flags for this booking.</p>
                    ) : (
                      <div className="space-y-2">
                        {expandedFlags[b.id].map((flag) => (
                          <div
                            key={flag.id}
                            className={cn(
                              "flex items-start justify-between gap-3 rounded-lg px-3 py-2 text-sm",
                              flag.resolved
                                ? "bg-green-50 text-green-700"
                                : "bg-amber-50 text-amber-800"
                            )}
                          >
                            <div className="flex-1 min-w-0">
                              <span className="font-medium">
                                {flag.employee.firstName} {flag.employee.lastName}
                              </span>
                              <span className="text-xs opacity-70 ml-2">
                                {new Date(flag.createdAt).toLocaleDateString("en-IE")}
                              </span>
                              <p className="mt-0.5 text-xs">{flag.note}</p>
                            </div>
                            {!flag.resolved && (
                              <button
                                onClick={() => resolveFlag(b.id, flag.id)}
                                className="flex items-center gap-1 text-xs text-green-600 hover:text-green-800 font-medium whitespace-nowrap"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Resolve
                              </button>
                            )}
                            {flag.resolved && (
                              <span className="text-xs text-green-600 font-medium whitespace-nowrap">
                                Resolved
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Edit/Create Dialog ─────────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editBooking ? "Edit Booking" : "New Booking"}</DialogTitle>
            <DialogDescription>
              {editBooking
                ? "Update reservation details"
                : "Create a new table reservation"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Customer Name *</Label>
              <Input
                value={form.customerName}
                onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={form.customerPhone}
                  onChange={(e) =>
                    setForm({ ...form, customerPhone: e.target.value })
                  }
                  placeholder="+353..."
                />
              </div>
              <div className="space-y-2">
                <Label>Party Size *</Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={form.partySize}
                  onChange={(e) =>
                    setForm({ ...form, partySize: parseInt(e.target.value) || 1 })
                  }
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Time *</Label>
                <Input
                  type="time"
                  value={form.time}
                  onChange={(e) => setForm({ ...form, time: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.customerEmail}
                onChange={(e) =>
                  setForm({ ...form, customerEmail: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
                placeholder="Dietary requirements, occasion, etc."
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editBooking ? "Save Changes" : "Create Booking"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Notify Staff Dialog ────────────────────────────────────────────── */}
      <Dialog
        open={!!notifyBooking}
        onOpenChange={(o) => !o && setNotifyBooking(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-blue-500" />
              Notify Staff
            </DialogTitle>
            <DialogDescription>
              Select employees to notify about &ldquo;
              {notifyBooking?.customerName}&rdquo; — {notifyBooking?.date
                ? new Date(notifyBooking.date).toLocaleDateString("en-IE", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })
                : ""}{" "}
              at {notifyBooking?.time}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Employee list */}
            <div className="max-h-48 overflow-y-auto space-y-1 border rounded-lg p-2">
              {employees.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-2">
                  Loading employees...
                </p>
              ) : (
                employees.map((emp) => (
                  <label
                    key={emp.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 cursor-pointer text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={selectedEmployees.includes(emp.id)}
                      onChange={() => toggleEmployee(emp.id)}
                      className="rounded"
                    />
                    <span className="font-medium">
                      {emp.firstName} {emp.lastName}
                    </span>
                    <span className="text-slate-400">{emp.email}</span>
                  </label>
                ))
              )}
            </div>

            {/* Optional message */}
            <div className="space-y-2">
              <Label>Message (optional)</Label>
              <Textarea
                value={notifyMessage}
                onChange={(e) => setNotifyMessage(e.target.value)}
                rows={2}
                placeholder="Extra details for the team..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setNotifyBooking(null)}>
              Cancel
            </Button>
            <Button
              onClick={sendNotifications}
              disabled={notifying || selectedEmployees.length === 0}
              className="gap-2"
            >
              {notifying && <Loader2 className="h-4 w-4 animate-spin" />}
              Send to {selectedEmployees.length} employee
              {selectedEmployees.length !== 1 ? "s" : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Flag Booking Dialog ────────────────────────────────────────────── */}
      <Dialog
        open={!!flagBooking}
        onOpenChange={(o) => !o && setFlagBooking(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flag className="h-4 w-4 text-amber-500" />
              Flag Booking
            </DialogTitle>
            <DialogDescription>
              Add a note to flag &ldquo;{flagBooking?.customerName}&rdquo; for
              management attention.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label>Note *</Label>
            <Textarea
              value={flagNote}
              onChange={(e) => setFlagNote(e.target.value)}
              rows={3}
              placeholder="e.g. Customer has severe nut allergy — confirm with kitchen"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFlagBooking(null)}>
              Cancel
            </Button>
            <Button
              onClick={submitFlag}
              disabled={flagging || !flagNote.trim()}
              className="gap-2 bg-amber-500 hover:bg-amber-600 text-white"
            >
              {flagging && <Loader2 className="h-4 w-4 animate-spin" />}
              Submit Flag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
