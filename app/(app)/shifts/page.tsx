"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
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
import { Calendar, Plus, Trash2, Pencil, Loader2 } from "lucide-react";
import { UserRole as Role } from "@/types/roles";

interface Shift {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  role: string | null;
  published: boolean;
  employee?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
}

export default function ShiftsPage() {
  const { data: session } = useSession();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editShift, setEditShift] = useState<Shift | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    date: "",
    startTime: "",
    endTime: "",
    role: "",
  });

  const isManager =
    session?.user?.role === Role.MANAGER ||
    session?.user?.role === Role.ADMIN;

  useEffect(() => {
    fetchShifts();
  }, []);

  const fetchShifts = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/shifts/list");
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setShifts(Array.isArray(data.shifts) ? data.shifts : []);
    } catch {
      setShifts([]);
    } finally {
      setLoading(false);
    }
  };

  const openNew = () => {
    setEditShift(null);
    setForm({ date: "", startTime: "", endTime: "", role: "" });
    setDialogOpen(true);
  };

  const openEdit = (shift: Shift) => {
    setEditShift(shift);
    setForm({
      date: shift.date.split("T")[0],
      startTime: new Date(shift.startTime).toTimeString().slice(0, 5),
      endTime: new Date(shift.endTime).toTimeString().slice(0, 5),
      role: shift.role ?? "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        date: form.date,
        startTime: `${form.date}T${form.startTime}:00.000Z`,
        endTime: `${form.date}T${form.endTime}:00.000Z`,
        role: form.role || null,
      };

      if (editShift) {
        await fetch(`/api/shifts/${editShift.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        await fetch("/api/shifts/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }
      setDialogOpen(false);
      fetchShifts();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this shift?")) return;
    await fetch(`/api/shifts/${id}`, { method: "DELETE" });
    fetchShifts();
  };

  const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit" });

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-IE", { weekday: "short", day: "numeric", month: "short" });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Shifts</h1>
          <p className="text-slate-500 mt-1">
            {isManager ? "Manage all team shifts" : "Your shift schedule"}
          </p>
        </div>
        {isManager && (
          <Button onClick={openNew} className="gap-2">
            <Plus className="h-4 w-4" />
            New Shift
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
        </div>
      ) : shifts.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Calendar className="h-12 w-12 mx-auto mb-3 text-slate-200" />
            <p className="text-slate-500 font-medium">No shifts found</p>
            <p className="text-slate-400 text-sm mt-1">
              Create one using the button above or ask the AI assistant.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {shifts.map((shift) => (
            <Card key={shift.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-slate-900">
                        {shift.role ?? "Shift"}
                      </p>
                      {shift.employee && (
                        <span className="text-slate-400 text-sm">
                          — {shift.employee.firstName} {shift.employee.lastName}
                        </span>
                      )}
                      <Badge variant={shift.published ? "default" : "secondary"}>
                        {shift.published ? "Published" : "Draft"}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-500 mt-0.5">
                      {formatDate(shift.date)} · {formatDateTime(shift.startTime)} — {formatDateTime(shift.endTime)}
                    </p>
                  </div>
                  {isManager && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => openEdit(shift)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleDelete(shift.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editShift ? "Edit Shift" : "New Shift"}</DialogTitle>
            <DialogDescription>
              {editShift ? "Update shift details" : "Create a new shift"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="role">Role / Title</Label>
              <Input
                id="role"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                placeholder="e.g. Bartender, Floor Staff"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="startTime">Start Time</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={form.startTime}
                  onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime">End Time</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={form.endTime}
                  onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editShift ? "Save Changes" : "Create Shift"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
