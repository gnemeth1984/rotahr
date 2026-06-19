"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  ChevronLeft,
  ChevronRight,
  Trash2,
  Download,
  Loader2,
  UserPlus,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  AlertTriangle,
  Target,
  ArrowRightLeft,
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
  hourlyRate?: number | null;
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
  overtimeHours: number;
  employeeId?: string | null;
  employee?: { id: string; firstName: string; lastName: string } | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DEPT_COLORS: Record<string, { bg: string; text: string; dot: string; cardBg: string; cardText: string }> = {};
const COLOR_PALETTE = [
  { bg: "bg-indigo-50", text: "text-indigo-700", dot: "bg-indigo-500", cardBg: "bg-indigo-100", cardText: "text-indigo-800" },
  { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500", cardBg: "bg-amber-100", cardText: "text-amber-800" },
  { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500", cardBg: "bg-emerald-100", cardText: "text-emerald-800" },
  { bg: "bg-rose-50", text: "text-rose-700", dot: "bg-rose-500", cardBg: "bg-rose-100", cardText: "text-rose-800" },
  { bg: "bg-purple-50", text: "text-purple-700", dot: "bg-purple-500", cardBg: "bg-purple-100", cardText: "text-purple-800" },
  { bg: "bg-cyan-50", text: "text-cyan-700", dot: "bg-cyan-500", cardBg: "bg-cyan-100", cardText: "text-cyan-800" },
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
  // Use local date parts to avoid UTC-offset day shift (important for UTC+1 Ireland)
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function fmtWeekRange(monday: Date): string {
  const sunday = addDays(monday, 6);
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  return `${monday.toLocaleDateString("en-IE", opts)} – ${sunday.toLocaleDateString("en-IE", { ...opts, year: "numeric" })}`;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function shiftHours(shift: Shift): number {
  return (new Date(shift.endTime).getTime() - new Date(shift.startTime).getTime()) / 3600000;
}

function empWeekHours(empId: string, weekDates: Date[], getShift: (id: string, d: string) => Shift | undefined): number {
  return weekDates.reduce((sum, date) => {
    const shift = getShift(empId, toDateStr(date));
    if (!shift) return sum;
    return sum + shiftHours(shift) + (shift.overtimeHours ?? 0);
  }, 0);
}

function fmtHours(h: number): string {
  if (h === 0) return "0h";
  const rounded = Math.round(h * 2) / 2;
  return rounded % 1 === 0 ? `${rounded}h` : `${rounded}h`;
}

// ─── Shift Form Default ───────────────────────────────────────────────────────

const DEFAULT_FORM = { startTime: "09:00", endTime: "17:00", role: "", published: false, overtimeHours: 0 };

// ─── Component ───────────────────────────────────────────────────────────────

export default function RotaPage() {
  const { data: session } = useSession();
  const isManager =
    session?.user?.role === Role.MANAGER || session?.user?.role === Role.ADMIN;

  const [weekStart, setWeekStart] = useState<Date>(() => getMondayOfWeek(new Date()));
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);       // initial load only
  const [shiftsLoading, setShiftsLoading] = useState(false); // week-change refresh

  // Mobile: selected day index (0=Mon … 6=Sun)
  const todayIdx = (() => {
    const now = new Date();
    const day = now.getDay();
    return day === 0 ? 6 : day - 1;
  })();
  const [selectedDay, setSelectedDay] = useState<number>(todayIdx);
  const isFirstLoad = useRef(true);

  // Shift sheet
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [cellContext, setCellContext] = useState<{ employeeId: string; date: string } | null>(null);
  const [shiftForm, setShiftForm] = useState(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // ── Labour cost & revenue target ──────────────────────────────────────────
  const [weeklyRevenueTarget, setWeeklyRevenueTarget] = useState<number | null>(null);
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetInput, setTargetInput] = useState("");
  const [savingTarget, setSavingTarget] = useState(false);

  // ── Working Time compliance alerts ────────────────────────────────────────
  // Organisation of Working Time Act 1997 (Irish transposition of EU WTD):
  //   - 11h rest between shifts
  //   - Max 48h average per week
  interface ComplianceAlert { empId: string; empName: string; message: string; type: "rest" | "hours" }
  const [complianceAlerts, setComplianceAlerts] = useState<ComplianceAlert[]>([]);

  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // ── Fetch ────────────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    if (isFirstLoad.current) {
      setLoading(true);
    } else {
      setShiftsLoading(true);
    }
    try {
      const from = toDateStr(weekStart);
      const to = toDateStr(addDays(weekStart, 6));
      const [empRes, deptRes, shiftRes, targetRes] = await Promise.all([
        fetch("/api/employee/list"),
        fetch("/api/department/list"),
        fetch(`/api/shifts/list?from=${from}&to=${to}`),
        fetch("/api/business/revenue-target"),
      ]);
      const empData = empRes.ok ? await empRes.json() : { employees: [] };
      const deptData = deptRes.ok ? await deptRes.json() : { departments: [] };
      const shiftData = shiftRes.ok ? await shiftRes.json() : { shifts: [] };
      const targetData = targetRes.ok ? await targetRes.json() : {};
      setEmployees(empData.employees ?? []);
      setDepartments(deptData.departments ?? []);
      setShifts(shiftData.shifts ?? []);
      setWeeklyRevenueTarget(targetData.weeklyRevenueTarget ?? null);
      setTargetInput(targetData.weeklyRevenueTarget ? String(targetData.weeklyRevenueTarget) : "");
    } catch {
      // silently fail
    } finally {
      setLoading(false);
      setShiftsLoading(false);
      isFirstLoad.current = false;
    }
  }, [weekStart]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Compliance check — runs whenever shifts or employees change ───────────
  useEffect(() => {
    if (!shifts.length || !employees.length) { setComplianceAlerts([]); return; }
    const alerts: ComplianceAlert[] = [];
    const empMap = Object.fromEntries(employees.map((e) => [e.id, e]));

    // Per employee: sort shifts by start time, check 11h rest & 48h/week cap
    const byEmp: Record<string, Shift[]> = {};
    for (const s of shifts) {
      if (!s.employeeId) continue;
      if (!byEmp[s.employeeId]) byEmp[s.employeeId] = [];
      byEmp[s.employeeId].push(s);
    }

    for (const [empId, empShifts] of Object.entries(byEmp)) {
      const emp = empMap[empId];
      if (!emp) continue;
      const empName = `${emp.firstName} ${emp.lastName}`;
      const sorted = [...empShifts].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

      // 11h rest check
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const curr = sorted[i];
        const restMs = new Date(curr.startTime).getTime() - new Date(prev.endTime).getTime();
        const restHours = restMs / 3600000;
        if (restHours < 11) {
          alerts.push({
            empId,
            empName,
            message: `${empName}: only ${restHours.toFixed(1)}h rest between ${fmtTime(prev.endTime)} and ${fmtTime(curr.startTime)} (WTA 1997 requires 11h)`,
            type: "rest",
          });
        }
      }

      // 48h weekly cap check
      const totalHrs = empShifts.reduce((sum, s) => sum + shiftHours(s) + (s.overtimeHours ?? 0), 0);
      if (totalHrs > 48) {
        alerts.push({
          empId,
          empName,
          message: `${empName}: ${totalHrs.toFixed(1)}h scheduled this week — exceeds 48h weekly limit (Working Time Act 1997)`,
          type: "hours",
        });
      }
    }

    setComplianceAlerts(alerts);
  }, [shifts, employees]);

  // ── Open sheet ────────────────────────────────────────────────────────────

  function handleCellClick(empId: string, dateStr: string, existing?: Shift) {
    if (!isManager) return;
    if (existing) {
      setEditingShift(existing);
      setShiftForm({
        startTime: fmtTime(existing.startTime),
        endTime: fmtTime(existing.endTime),
        role: existing.role ?? "",
        published: existing.published,
        overtimeHours: existing.overtimeHours ?? 0,
      });
    } else {
      setEditingShift(null);
      setShiftForm(DEFAULT_FORM);
    }
    setCellContext({ employeeId: empId, date: dateStr });
    setSheetOpen(true);
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
        overtimeHours: shiftForm.overtimeHours,
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
      setSheetOpen(false);
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
      setSheetOpen(false);
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
    const rows = [["Employee", "Date", "Start", "End", "Role", "Scheduled Hrs", "Overtime Hrs", "Total Hrs", "Published"]];
    shifts.forEach((s) => {
      const emp = employees.find((e) => e.id === s.employeeId);
      const scheduled = shiftHours(s);
      const ot = s.overtimeHours ?? 0;
      rows.push([
        emp ? `${emp.firstName} ${emp.lastName}` : "—",
        s.date.split("T")[0],
        fmtTime(s.startTime),
        fmtTime(s.endTime),
        s.role ?? "",
        scheduled.toString(),
        ot.toString(),
        (scheduled + ot).toString(),
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

  // ── Save revenue target ───────────────────────────────────────────────────
  async function saveRevenueTarget() {
    setSavingTarget(true);
    const val = targetInput.trim() === "" ? null : parseFloat(targetInput);
    await fetch("/api/business/revenue-target", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weeklyRevenueTarget: val }),
    });
    setWeeklyRevenueTarget(val);
    setEditingTarget(false);
    setSavingTarget(false);
  }

  // ── Labour cost calculations ──────────────────────────────────────────────
  const empMap = Object.fromEntries(employees.map((e) => [e.id, e]));
  const totalLabourCost = shifts.reduce((sum, s) => {
    if (!s.employeeId) return sum;
    const emp = empMap[s.employeeId];
    const rate = emp?.hourlyRate ?? 0;
    return sum + shiftHours(s) * rate + (s.overtimeHours ?? 0) * rate * 1.5;
  }, 0);
  const labourPct = weeklyRevenueTarget && weeklyRevenueTarget > 0
    ? (totalLabourCost / weeklyRevenueTarget) * 100
    : null;
  const labourPctColor =
    labourPct === null ? "text-slate-600"
    : labourPct > 40 ? "text-red-600"
    : labourPct > 30 ? "text-amber-600"
    : "text-emerald-600";

  const totalShifts = shifts.length;
  const publishedShifts = shifts.filter((s) => s.published).length;

  // All employee groups with their dept info
  const groups: { dept: Department; colors: typeof COLOR_PALETTE[0]; emps: Employee[] }[] = [
    ...departments.map((dept, idx) => ({
      dept,
      colors: getDeptColor(dept.id, idx),
      emps: getEmpsByDept(dept.id),
    })).filter((g) => g.emps.length > 0),
    ...(getUnassigned().length > 0
      ? [{
          dept: { id: "__unassigned__", name: "Unassigned" },
          colors: { bg: "bg-slate-50", text: "text-slate-600", dot: "bg-slate-400", cardBg: "bg-slate-100", cardText: "text-slate-700" },
          emps: getUnassigned(),
        }]
      : []),
    ...(employees.length > 0 && departments.length === 0
      ? [{
          dept: { id: "__all__", name: "All Staff" },
          colors: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500", cardBg: "bg-blue-100", cardText: "text-blue-800" },
          emps: employees,
        }]
      : []),
  ];

  const selectedDate = weekDates[selectedDay];
  const selectedDateStr = toDateStr(selectedDate);
  const isToday = selectedDateStr === toDateStr(new Date());

  // Shift for selected employee in sheet
  const sheetEmployee = cellContext
    ? employees.find((e) => e.id === cellContext.employeeId)
    : null;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Rota</h1>
            <p className="text-slate-500 text-sm mt-0.5">
              {fmtWeekRange(weekStart)}
              {totalShifts > 0 && (
                <span className="ml-2 text-xs">· {publishedShifts}/{totalShifts} published</span>
              )}
            </p>
          </div>

          {/* Week nav */}
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1 flex-shrink-0">
            <button
              onClick={() => setWeekStart((w) => addDays(w, -7))}
              className="p-1.5 rounded-md hover:bg-slate-100 transition-colors"
            >
              <ChevronLeft className="h-4 w-4 text-slate-600" />
            </button>
            <button
              onClick={() => {
                setWeekStart(getMondayOfWeek(new Date()));
                setSelectedDay(todayIdx);
              }}
              className="px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
            >
              Today
            </button>
            <button
              onClick={() => setWeekStart((w) => addDays(w, 7))}
              className="p-1.5 rounded-md hover:bg-slate-100 transition-colors"
            >
              <ChevronRight className="h-4 w-4 text-slate-600" />
            </button>
          </div>
        </div>

        {/* Action buttons row */}
        {isManager && (
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCSV}>
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Export</span>
            </Button>
            {publishedShifts < totalShifts && totalShifts > 0 && (
              <Button size="sm" onClick={publishAll} disabled={publishing} className="gap-1.5">
                {publishing
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <CheckCircle2 className="h-3.5 w-3.5" />}
                Publish all
              </Button>
            )}
            <a
              href="/shift-swaps"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-md bg-white hover:bg-slate-50 text-slate-700 transition-colors"
            >
              <ArrowRightLeft className="h-3.5 w-3.5" />
              Swap requests
            </a>
          </div>
        )}
      </div>

      {/* ── Labour Cost Banner (managers only) ── */}
      {isManager && !loading && shifts.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl px-5 py-3.5 flex flex-wrap items-center gap-4">
          {/* Labour cost */}
          <div className="flex items-center gap-2.5">
            <TrendingUp className="h-4 w-4 text-slate-400 flex-shrink-0" />
            <div>
              <p className="text-[11px] text-slate-400 uppercase tracking-wide font-medium">Labour cost</p>
              <p className="text-lg font-bold text-slate-900">€{totalLabourCost.toFixed(2)}</p>
            </div>
          </div>

          {/* Labour % of revenue */}
          {labourPct !== null && (
            <div className="flex items-center gap-2.5">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                labourPct > 40 ? "bg-red-100 text-red-700"
                : labourPct > 30 ? "bg-amber-100 text-amber-700"
                : "bg-emerald-100 text-emerald-700"
              }`}>
                {labourPct.toFixed(0)}%
              </div>
              <div>
                <p className="text-[11px] text-slate-400 uppercase tracking-wide font-medium">of revenue</p>
                <p className={`text-sm font-semibold ${labourPctColor}`}>
                  {labourPct > 40 ? "High — review staffing" : labourPct > 30 ? "Moderate" : "Healthy"}
                </p>
              </div>
            </div>
          )}

          {/* Revenue target setter */}
          <div className="flex items-center gap-2 ml-auto">
            <Target className="h-4 w-4 text-slate-400 flex-shrink-0" />
            {editingTarget ? (
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-slate-500">€</span>
                <Input
                  type="number"
                  value={targetInput}
                  onChange={(e) => setTargetInput(e.target.value)}
                  className="h-7 w-28 text-sm"
                  placeholder="e.g. 25000"
                  autoFocus
                />
                <Button size="sm" className="h-7 text-xs px-2.5" onClick={saveRevenueTarget} disabled={savingTarget}>
                  {savingTarget ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                </Button>
                <button onClick={() => setEditingTarget(false)} className="text-xs text-slate-400 hover:text-slate-600">Cancel</button>
              </div>
            ) : (
              <button
                onClick={() => setEditingTarget(true)}
                className="text-xs text-slate-500 hover:text-slate-800 underline decoration-dotted"
              >
                {weeklyRevenueTarget ? `Target: €${weeklyRevenueTarget.toLocaleString("en-IE")}` : "Set revenue target"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Working Time Compliance Alerts (WTA 1997) ── */}
      {isManager && complianceAlerts.length > 0 && (
        <div className="border border-amber-200 bg-amber-50 rounded-xl px-4 py-3 space-y-1.5">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
            <p className="text-sm font-semibold text-amber-800">
              Working Time Act 1997 — {complianceAlerts.length} alert{complianceAlerts.length > 1 ? "s" : ""}
            </p>
          </div>
          {complianceAlerts.map((alert, i) => (
            <p key={i} className="text-xs text-amber-700 pl-6">{alert.message}</p>
          ))}
        </div>
      )}

      {/* ── Loading / Empty ── */}
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
        <div className="relative">
          {/* Week-change overlay spinner — content stays mounted so selectedDay is preserved */}
          {shiftsLoading && (
            <div className="absolute inset-0 z-10 flex items-start justify-center pt-16 bg-white/60 rounded-xl">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          )}
          {/* ── MOBILE VIEW (< lg) ── */}
          <div className="lg:hidden space-y-4">
            {/* Day selector strip */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {weekDates.map((date, i) => {
                const dateStr = toDateStr(date);
                const isTodayDate = dateStr === toDateStr(new Date());
                const isSelected = i === selectedDay;
                const dayShifts = shifts.filter((s) => s.date.split("T")[0] === dateStr);
                return (
                  <button
                    key={i}
                    onClick={() => setSelectedDay(i)}
                    className={cn(
                      "flex flex-col items-center px-3 py-2 rounded-xl text-xs font-medium transition-all flex-shrink-0 min-w-[48px]",
                      isSelected
                        ? "bg-blue-600 text-white shadow-sm"
                        : isTodayDate
                        ? "bg-blue-50 text-blue-600 border border-blue-200"
                        : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                    )}
                  >
                    <span className="text-[11px] uppercase tracking-wide opacity-80">{DAYS[i]}</span>
                    <span className="text-base font-bold leading-tight">{date.getDate()}</span>
                    {dayShifts.length > 0 && (
                      <span className={cn(
                        "mt-0.5 h-1 w-1 rounded-full",
                        isSelected ? "bg-white/70" : "bg-blue-400"
                      )} />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Selected day heading */}
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">
                {selectedDate.toLocaleDateString("en-IE", { weekday: "long", day: "numeric", month: "long" })}
                {isToday && (
                  <span className="ml-2 text-xs font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">Today</span>
                )}
              </h2>
              <span className="text-xs text-slate-400">
                {shifts.filter((s) => s.date.split("T")[0] === selectedDateStr).length} shifts
              </span>
            </div>

            {/* Employee cards for selected day */}
            <div className="space-y-3">
              {groups.map(({ dept, colors, emps }) => (
                <div key={dept.id} className="space-y-1.5">
                  {/* Dept label */}
                  <div className="flex items-center gap-1.5 px-0.5">
                    <span className={cn("h-2 w-2 rounded-full flex-shrink-0", colors.dot)} />
                    <span className={cn("text-xs font-semibold uppercase tracking-wide", colors.text)}>{dept.name}</span>
                  </div>

                  {emps.map((emp) => {
                    const shift = getShift(emp.id, selectedDateStr);
                    const weekHrs = empWeekHours(emp.id, weekDates, getShift);
                    return (
                      <button
                        key={emp.id}
                        onClick={() => handleCellClick(emp.id, selectedDateStr, shift)}
                        disabled={!isManager}
                        className={cn(
                          "w-full flex items-center justify-between rounded-xl px-4 py-3 border transition-all text-left",
                          shift
                            ? shift.published
                              ? "bg-white border-slate-200 hover:border-blue-300 hover:shadow-sm active:scale-[0.99]"
                              : "bg-amber-50/60 border-amber-200 hover:border-amber-300 active:scale-[0.99]"
                            : isManager
                            ? "bg-white border-dashed border-slate-200 hover:border-blue-300 hover:bg-blue-50/30 active:scale-[0.99]"
                            : "bg-slate-50 border-slate-100 cursor-default"
                        )}
                      >
                        {/* Left: name + shift info */}
                        <div className="flex items-center gap-3">
                          {/* Avatar */}
                          <div className={cn(
                            "h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0",
                            shift ? colors.cardBg + " " + colors.cardText : "bg-slate-100 text-slate-400"
                          )}>
                            {emp.firstName[0]}{emp.lastName[0]}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-800">
                              {emp.firstName} {emp.lastName}
                            </p>
                            {shift ? (
                              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                <span className="text-xs text-slate-500 flex items-center gap-0.5">
                                  <Clock className="h-3 w-3" />
                                  {fmtTime(shift.startTime)}–{fmtTime(shift.endTime)}
                                </span>
                                {shift.role && (
                                  <span className="text-xs text-slate-400">· {shift.role}</span>
                                )}
                                {(shift.overtimeHours ?? 0) > 0 && (
                                  <span className="text-[10px] font-bold bg-orange-500 text-white px-1.5 py-0.5 rounded-full">
                                    +{shift.overtimeHours}h OT
                                  </span>
                                )}
                              </div>
                            ) : (
                              <p className="text-xs text-slate-400 mt-0.5">
                                {weekHrs > 0 ? `${fmtHours(weekHrs)} this week` : "No shift"}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Right: status / add */}
                        <div className="flex-shrink-0 flex items-center gap-1.5">
                          {shift ? (
                            shift.published ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-amber-500" />
                            )
                          ) : isManager ? (
                            <div className="h-7 w-7 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center">
                              <Plus className="h-3.5 w-3.5 text-blue-500" />
                            </div>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* ── DESKTOP VIEW (>= lg) ── */}
          <div className="hidden lg:block space-y-6">
            {groups.map(({ dept, colors, emps }) => (
              <DeptBlock
                key={dept.id}
                dept={dept}
                colors={colors}
                employees={emps}
                weekDates={weekDates}
                getShift={getShift}
                isManager={isManager}
                onCellClick={handleCellClick}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Shift Sheet (bottom on mobile, right on desktop) ── */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl px-4 pb-8 sm:max-w-md sm:mx-auto lg:side-right">
          <SheetHeader className="mb-4">
            <SheetTitle>
              {editingShift ? "Edit Shift" : "Add Shift"}
            </SheetTitle>
            {cellContext && (
              <p className="text-sm text-slate-500">
                {sheetEmployee ? `${sheetEmployee.firstName} ${sheetEmployee.lastName} · ` : ""}
                {new Date(cellContext.date + "T12:00:00").toLocaleDateString("en-IE", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </p>
            )}
          </SheetHeader>

          <div className="space-y-4">
            {/* Time */}
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

            {/* Role */}
            <div className="space-y-1.5">
              <Label htmlFor="role">Role / Note</Label>
              <Input
                id="role"
                placeholder="e.g. Bartender, Floor"
                value={shiftForm.role}
                onChange={(e) => setShiftForm((f) => ({ ...f, role: e.target.value }))}
              />
            </div>

            {/* Overtime */}
            <div className="space-y-1.5">
              <Label htmlFor="ot">Overtime hrs</Label>
              <Input
                id="ot"
                type="number"
                min={0}
                step={0.5}
                placeholder="0"
                value={shiftForm.overtimeHours === 0 ? "" : shiftForm.overtimeHours}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setShiftForm((f) => ({ ...f, overtimeHours: isNaN(val) ? 0 : Math.max(0, val) }));
                }}
              />
            </div>

            {/* Publish */}
            <label className="flex items-center gap-3 cursor-pointer select-none p-3 rounded-xl bg-slate-50 border border-slate-100">
              <input
                type="checkbox"
                id="pub"
                checked={shiftForm.published}
                onChange={(e) => setShiftForm((f) => ({ ...f, published: e.target.checked }))}
                className="h-4 w-4 rounded border-slate-300 accent-blue-600"
              />
              <div>
                <p className="text-sm font-medium text-slate-700">Publish immediately</p>
                <p className="text-xs text-slate-400">Employee will be notified</p>
              </div>
            </label>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              {editingShift && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteShift}
                  disabled={saving}
                  className="gap-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </Button>
              )}
              <div className="flex-1" />
              <Button variant="outline" size="sm" onClick={() => setSheetOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSaveShift} disabled={saving} className="gap-1.5">
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {editingShift ? "Save" : "Add Shift"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ─── DeptBlock (desktop only) ────────────────────────────────────────────────

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
    return acc + empWeekHours(emp.id, weekDates, getShift);
  }, 0);

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className={cn("flex items-center justify-between px-5 py-3 border-b border-slate-100", colors.bg)}>
        <div className="flex items-center gap-2.5">
          <span className={cn("h-2.5 w-2.5 rounded-full flex-shrink-0", colors.dot)} />
          <span className={cn("font-semibold text-sm", colors.text)}>{dept.name}</span>
          <span className="text-xs text-slate-400">
            {employees.length} staff · {fmtHours(totalHours)}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 w-40">Employee</th>
              <th className="text-center px-2 py-2.5 text-xs font-medium text-slate-400 w-14">Hrs</th>
              {weekDates.map((date, i) => {
                const isToday = toDateStr(date) === toDateStr(new Date());
                return (
                  <th key={i} className={cn("text-center px-1 py-2.5 text-xs font-medium", isToday ? "text-blue-600" : "text-slate-500")}>
                    <div>{DAYS[i]}</div>
                    <div className={cn("text-[11px] mt-0.5", isToday ? "font-bold text-blue-600" : "text-slate-400 font-normal")}>
                      {date.getDate()}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {employees.map((emp, ri) => {
              const weekHrs = empWeekHours(emp.id, weekDates, getShift);
              return (
                <tr key={emp.id} className={cn("border-b border-slate-50", ri % 2 === 0 ? "bg-white" : "bg-slate-50/40")}>
                  <td className="px-4 py-2 text-sm font-medium text-slate-700 truncate max-w-[160px]">
                    {emp.firstName} {emp.lastName}
                  </td>
                  <td className="px-2 py-2 text-center">
                    <span className={cn("text-xs font-semibold tabular-nums", weekHrs === 0 ? "text-slate-300" : "text-slate-600")}>
                      {fmtHours(weekHrs)}
                    </span>
                  </td>
                  {weekDates.map((date, di) => {
                    const dateStr = toDateStr(date);
                    const shift = getShift(emp.id, dateStr);
                    const isToday = dateStr === toDateStr(new Date());
                    return (
                      <td key={di} className={cn("px-1 py-1.5 text-center align-middle", isToday && "bg-blue-50/40")}>
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
                              <div className="text-[10px] opacity-60 truncate mt-0.5">{shift.role}</div>
                            )}
                            {(shift.overtimeHours ?? 0) > 0 && (
                              <div className="mt-0.5">
                                <span className="inline-block bg-orange-500 text-white text-[9px] font-bold px-1 py-0.5 rounded leading-none">
                                  +{shift.overtimeHours}h OT
                                </span>
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
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
