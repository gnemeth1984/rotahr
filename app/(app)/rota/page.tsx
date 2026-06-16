"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Download,
  Loader2,
  CalendarDays,
  UserPlus,
} from "lucide-react";
import { UserRole as Role } from "@/types/roles";
import { cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  departmentId?: string | null;
}

interface Department {
  id: string;
  name: string;
}

interface Shift {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  role: string | null;
  published: boolean;
  employeeId?: string | null;
  employee?: { id: string; firstName: string; lastName: string } | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DEPT_COLORS: Record<string, { bg: string; text: string; dot: string }> = {};
const COLOR_PALETTE = [
  { bg: "bg-indigo-50", text: "text-indigo-700", dot: "bg-indigo-500" },
  { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" },
  { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  { bg: "bg-rose-50", text: "text-rose-700", dot: "bg-rose-500" },
  { bg: "bg-purple-50", text: "text-purple-700", dot: "bg-purple-500" },
  { bg: "bg-cyan-50", text: "text-cyan-700", dot: "bg-cyan-500" },
];

function getDeptColor(deptId: string, index: number) {
  if (!DEPT_COLORS[deptId]) {
    DEPT_COLORS[deptId] = COLOR_PALETTE[index % COLOR_PALETTE.length];
  }
  return DEPT_COLORS[deptId];
}

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function toDateStr(date: Date): string {
  return date.toISOString().split("T")[0];
}

function fmtWeekRange(monday: Date): string {
  const sunday = addDays(monday, 6);
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  return `${monday.toLocaleDateString("en-IE", opts)} – ${sunday.toLocaleDateString("en-IE", { ...opts, year: "numeric" })}`;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit", hour12: false });
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function RotaPage() {
  const { data: session } = useSession();
  const isManager =
    session?.user?.role === Role.MANAGER || session?.user?.role === Role.ADMIN;

  const [weekStart, setWeekStart] = useState<Date>(() => getMondayOfWeek(new Date()));
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);

  // Shift dialog
  const [shiftDialog, setShiftDialog] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [cellContext, setCellContext] = useState<{ employeeId: string; date: string } | null>(null);
  const [shiftForm, setShiftForm] = useState({ startTime: "09:00", endTime: "17:00", role: "", published: false });
  const [saving, setSaving] = useState(false);

  // Publish all
  const [publishing, setPublishing] = useState(false);

  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // ── Fetch ────────────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const from = toDateStr(weekStart);
      const to = toDateStr(addDays(weekStart, 6));
      const [empRes, deptRes, shiftRes] = await Promise.all([
        fetch("/api/employee/list"),
        fetch("/api/department/list"),
        fetch(`/api/shifts/list?from=${from}&to=${to}`),
      ]);
      const empData = empRes.ok ? await empRes.json() : { employees: [] };
      const deptData = deptRes.ok ? await deptRes.json() : { departments: [] };
      const shiftData = shiftRes.ok ? await shiftRes.json() : { shifts: [] };
      setEmployees(empData.employees ?? []);
      setDepartments(deptData.departments ?? []);
      setShifts(shiftData.shifts ?? []);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ── Cell click ───────────────────────────────────────────────────────────

  function handleCellClick(empId: string, dateStr: string, existing?: Shift) {
    if (!isManager) return;
    if (existing) {
      setEditingShift(existing);
      setShiftForm({
        startTime: fmtTime(existing.startTime),
        endTime: fmtTime(existing.endTime),
        role: existing.role ?? "",
        published: existing.published,
      });
    } else {
      setEditingShift(null);
      setShiftForm({ startTime: "09:00", endTime: "17:00", role: "", published: false });
    }
    setCellContext({ employeeId: empId, date: dateStr });
    setShiftDialog(true);
  }

  // ── Save shift ────────────────────────────────────────────────────────────

  async function handleSaveShift() {
    if (!cellContext) return;
    setSaving(true);
    try {
      const { date, employeeId } = cellContext;
      const body = {
        employeeId,
        date: `${date}T00:00:00.000Z`,
        startTime: `${date}T${shiftForm.startTime}:00.000Z`,
        endTime: `${date}T${shiftForm.endTime}:00.000Z`,
        role: shiftForm.role || null,
        published: shiftForm.published,
      };
      if (editingShift) {
        await fetch(`/api/shifts/${editingShift.id}`, {
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
      setShiftDialog(false);
      fetchAll();
    } finally {
      setSaving(false);
    }
  }

  // ── Delete shift ──────────────────────────────────────────────────────────

  async function handleDeleteShift() {
    if (!editingShift) return;
    setSaving(true);
    try {
      await fetch(`/api/shifts/${editingShift.id}`, { method: "DELETE" });
      setShiftDialog(false);
      fetchAll();
    } finally {
      setSaving(false);
    }
  }

  // ── Publish all ───────────────────────────────────────────────────────────

  async function publishAll() {
    setPublishing(true);
    const unpublished = shifts.filter((s) => !s.published);
    await Promise.all(
      unpublished.map((s) =>
        fetch(`/api/shifts/${s.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ published: true }),
        })
      )
    );
    setPublishing(false);
    fetchAll();
  }

  // ── Export CSV ────────────────────────────────────────────────────────────

  function exportCSV() {
    const rows = [["Employee", "Date", "Start", "End", "Role", "Published"]];
    shifts.forEach((s) => {
      const emp = employees.find((e) => e.id === s.employeeId);
      rows.push([
        emp ? `${emp.firstName} ${emp.lastName}` : "—",
        s.date.split("T")[0],
        fmtTime(s.startTime),
        fmtTime(s.endTime),
        s.role ?? "",
        s.published ? "Yes" : "No",
      ]);
    });
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rota-${toDateStr(weekStart)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  function getShift(empId: string, dateStr: string): Shift | undefined {
    return shifts.find(
      (s) => s.employeeId === empId && s.date.split("T")[0] === dateStr
    );
  }

  function getEmpsByDept(deptId: string): Employee[] {
    return employees.filter((e) => e.departmentId === deptId);
  }

  function getUnassigned(): Employee[] {
    const deptIds = departments.map((d) => d.id);
    return employees.filter((e) => !e.departmentId || !deptIds.includes(e.departmentId));
  }

  const totalShifts = shifts.length;
  const publishedShifts = shifts.filter((s) => s.published).length;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Rota</h1>
          <p className="text-slate-500 mt-0.5 text-sm">
            {fmtWeekRange(weekStart)}
            {totalShifts > 0 && (
              <span className="ml-2 text-xs">
                · {publishedShifts}/{totalShifts} published
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Week nav */}
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1">
            <button
              onClick={() => setWeekStart((w) => addDays(w, -7))}
              className="p-1.5 rounded-md hover:bg-slate-100 transition-colors"
            >
              <ChevronLeft className="h-4 w-4 text-slate-600" />
            </button>
            <button
              onClick={() => setWeekStart(getMondayOfWeek(new Date()))}
              className="px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
            >
              This week
            </button>
            <button
              onClick={() => setWeekStart((w) => addDays(w, 7))}
              className="p-1.5 rounded-md hover:bg-slate-100 transition-colors"
            >
              <ChevronRight className="h-4 w-4 text-slate-600" />
            </button>
          </div>

          {isManager && (
            <>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCSV}>
                <Download className="h-3.5 w-3.5" />
                Export
              </Button>
              {publishedShifts < totalShifts && totalShifts > 0 && (
                <Button size="sm" onClick={publishAll} disabled={publishing} className="gap-1.5">
                  {publishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Publish all
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
        </div>
      ) : employees.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl py-20 text-center">
          <UserPlus className="h-12 w-12 mx-auto mb-3 text-slate-200" />
          <p className="font-medium text-slate-600">No employees yet</p>
          <p className="text-sm text-slate-400 mt-1">Add employees first to build a rota.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Department blocks */}
          {departments.map((dept, idx) => {
            const deptEmps = getEmpsByDept(dept.id);
            if (deptEmps.length === 0) return null;
            const colors = getDeptColor(dept.id, idx);
            return (
              <DeptBlock
                key={dept.id}
                dept={dept}
                colors={colors}
                employees={deptEmps}
                weekDates={weekDates}
                getShift={getShift}
                isManager={isManager}
                onCellClick={handleCellClick}
              />
            );
          })}

          {/* Unassigned */}
          {getUnassigned().length > 0 && (
            <DeptBlock
              dept={{ id: "__unassigned__", name: "Unassigned" }}
              colors={{ bg: "bg-slate-50", text: "text-slate-600", dot: "bg-slate-400" }}
              employees={getUnassigned()}
              weekDates={weekDates}
              getShift={getShift}
              isManager={isManager}
              onCellClick={handleCellClick}
            />
          )}
        </div>
      )}

      {/* No depts but has employees — show all */}
      {!loading && employees.length > 0 && departments.length === 0 && (
        <DeptBlock
          dept={{ id: "__all__", name: "All Staff" }}
          colors={{ bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" }}
          employees={employees}
          weekDates={weekDates}
          getShift={getShift}
          isManager={isManager}
          onCellClick={handleCellClick}
        />
      )}

      {/* Shift Dialog */}
      <Dialog open={shiftDialog} onOpenChange={setShiftDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {editingShift ? "Edit Shift" : "Add Shift"}
            </DialogTitle>
            {cellContext && (
              <p className="text-sm text-slate-500">
                {new Date(cellContext.date).toLocaleDateString("en-IE", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </p>
            )}
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="st">Start</Label>
                <Input
                  id="st"
                  type="time"
                  value={shiftForm.startTime}
                  onChange={(e) => setShiftForm((f) => ({ ...f, startTime: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="et">End</Label>
                <Input
                  id="et"
                  type="time"
                  value={shiftForm.endTime}
                  onChange={(e) => setShiftForm((f) => ({ ...f, endTime: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="role">Role / Note</Label>
              <Input
                id="role"
                placeholder="e.g. Bartender, Floor"
                value={shiftForm.role}
                onChange={(e) => setShiftForm((f) => ({ ...f, role: e.target.value }))}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="pub"
                checked={shiftForm.published}
                onChange={(e) => setShiftForm((f) => ({ ...f, published: e.target.checked }))}
                className="rounded border-slate-300"
              />
              <Label htmlFor="pub" className="cursor-pointer">Publish immediately</Label>
            </div>
          </div>

          <DialogFooter className="gap-2">
            {editingShift && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeleteShift}
                disabled={saving}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Delete
              </Button>
            )}
            <div className="flex-1" />
            <Button variant="outline" size="sm" onClick={() => setShiftDialog(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveShift} disabled={saving}>
              {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              {editingShift ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── DeptBlock subcomponent ──────────────────────────────────────────────────

function DeptBlock({
  dept,
  colors,
  employees,
  weekDates,
  getShift,
  isManager,
  onCellClick,
}: {
  dept: Department;
  colors: { bg: string; text: string; dot: string };
  employees: Employee[];
  weekDates: Date[];
  getShift: (empId: string, dateStr: string) => Shift | undefined;
  isManager: boolean;
  onCellClick: (empId: string, dateStr: string, existing?: Shift) => void;
}) {
  const totalHours = employees.reduce((acc, emp) => {
    return (
      acc +
      weekDates.reduce((sum, date) => {
        const shift = getShift(emp.id, toDateStr(date));
        if (!shift) return sum;
        const h =
          (new Date(shift.endTime).getTime() - new Date(shift.startTime).getTime()) /
          3600000;
        return sum + h;
      }, 0)
    );
  }, 0);

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* Dept header */}
      <div className={cn("flex items-center justify-between px-5 py-3 border-b border-slate-100", colors.bg)}>
        <div className="flex items-center gap-2.5">
          <span className={cn("h-2.5 w-2.5 rounded-full flex-shrink-0", colors.dot)} />
          <span className={cn("font-semibold text-sm", colors.text)}>{dept.name}</span>
          <span className="text-xs text-slate-400">
            {employees.length} staff · {totalHours > 0 ? `${totalHours}h` : "0h"}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 w-36">
                Employee
              </th>
              {weekDates.map((date, i) => {
                const isToday = toDateStr(date) === toDateStr(new Date());
                return (
                  <th
                    key={i}
                    className={cn(
                      "text-center px-1 py-2.5 text-xs font-medium w-[calc((100%-144px)/7)]",
                      isToday ? "text-blue-600" : "text-slate-500"
                    )}
                  >
                    <div>{DAYS[i]}</div>
                    <div className={cn(
                      "text-[11px] mt-0.5",
                      isToday ? "font-bold text-blue-600" : "text-slate-400 font-normal"
                    )}>
                      {date.getDate()}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {employees.map((emp, ri) => (
              <tr
                key={emp.id}
                className={cn("border-b border-slate-50", ri % 2 === 0 ? "bg-white" : "bg-slate-50/40")}
              >
                <td className="px-4 py-2 text-sm font-medium text-slate-700 truncate max-w-[144px]">
                  {emp.firstName} {emp.lastName}
                </td>
                {weekDates.map((date, di) => {
                  const dateStr = toDateStr(date);
                  const shift = getShift(emp.id, dateStr);
                  const isToday = dateStr === toDateStr(new Date());
                  return (
                    <td
                      key={di}
                      className={cn(
                        "px-1 py-1.5 text-center align-middle",
                        isToday && "bg-blue-50/40"
                      )}
                    >
                      {shift ? (
                        <button
                          onClick={() => onCellClick(emp.id, dateStr, shift)}
                          className={cn(
                            "w-full rounded-md px-1.5 py-1.5 text-[11px] font-medium leading-tight transition-all",
                            shift.published
                              ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100"
                          )}
                        >
                          <div>{fmtTime(shift.startTime)}</div>
                          <div className="opacity-70">–{fmtTime(shift.endTime)}</div>
                          {shift.role && (
                            <div className="text-[10px] opacity-60 truncate mt-0.5">
                              {shift.role}
                            </div>
                          )}
                        </button>
                      ) : isManager ? (
                        <button
                          onClick={() => onCellClick(emp.id, dateStr)}
                          className="w-full h-10 rounded-md border border-dashed border-slate-200 text-slate-300 hover:border-blue-300 hover:text-blue-400 hover:bg-blue-50/50 transition-all text-lg leading-none"
                        >
                          +
                        </button>
                      ) : (
                        <div className="h-10" />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
