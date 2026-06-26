"use client";

import { useState, useEffect, useCallback, useRef, useMemo, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useCurrency } from "@/components/shared/CurrencyProvider";
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
  ChevronDown,
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
  Sparkles,
  Users,
  CalendarDays,
  LayoutGrid,
  CalendarCheck,
  Building2,
} from "lucide-react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";
import { UserRole as Role } from "@/types/roles";
import { cn } from "@/lib/utils";
import { getHolidaysInRange, type PublicHoliday } from "@/lib/irish-public-holidays";

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

function fmtWeekRange(monday: Date, locale = "en-IE"): string {
  const sunday = addDays(monday, 6);
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  return `${monday.toLocaleDateString(locale, opts)} – ${sunday.toLocaleDateString(locale, { ...opts, year: "numeric" })}`;
}

function fmtTime(iso: string, locale = "en-IE"): string {
  return new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", hour12: false });
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

// ─── Compliance Panel ─────────────────────────────────────────────────────────

interface ComplianceAlertItem { empId: string; empName: string; message: string; type: "rest" | "hours" }

function CompliancePanel({ alerts }: { alerts: ComplianceAlertItem[] }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Group by employee
  const grouped = useMemo(() => {
    const map: Record<string, { name: string; alerts: string[] }> = {};
    for (const a of alerts) {
      if (!map[a.empId]) map[a.empId] = { name: a.empName, alerts: [] };
      // Strip the employee name prefix from message for cleaner display
      const msg = a.message.replace(/^[^:]+:\s*/, "");
      map[a.empId].alerts.push(msg);
    }
    return Object.entries(map);
  }, [alerts]);

  const restCount = alerts.filter(a => a.type === "rest").length;
  const hoursCount = alerts.filter(a => a.type === "hours").length;

  return (
    <div className="border border-amber-200 bg-amber-50 rounded-xl overflow-hidden">
      {/* Header — always visible */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-amber-100/60 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
          <span className="text-sm font-semibold text-amber-800">
            Working Time Act 1997
          </span>
          <span className="bg-amber-200 text-amber-800 text-xs font-bold px-2 py-0.5 rounded-full">
            {alerts.length}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-xs text-amber-700">
            {restCount > 0 && <span className="bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full">{restCount} break{restCount > 1 ? "s" : ""}</span>}
            {hoursCount > 0 && <span className="bg-orange-100 border border-orange-200 text-orange-700 px-2 py-0.5 rounded-full">{hoursCount} hours</span>}
          </div>
          <ChevronDown className={cn("h-4 w-4 text-amber-600 transition-transform", open && "rotate-180")} />
        </div>
      </button>

      {/* Expandable body */}
      {open && (
        <div className="border-t border-amber-200 divide-y divide-amber-100">
          {grouped.map(([empId, { name, alerts: empAlerts }]) => (
            <div key={empId} className="px-4 py-2">
              <button
                onClick={() => setExpanded(e => ({ ...e, [empId]: !e[empId] }))}
                className="w-full flex items-center justify-between py-1 text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-amber-900">{name}</span>
                  <span className="text-xs text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full">{empAlerts.length}</span>
                </div>
                <ChevronDown className={cn("h-3.5 w-3.5 text-amber-500 transition-transform", expanded[empId] && "rotate-180")} />
              </button>
              {expanded[empId] && (
                <ul className="mt-1.5 mb-1 space-y-1 pl-2">
                  {empAlerts.map((msg, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-amber-700">
                      <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                      {msg}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

function RotaInner() {
  const { data: session } = useSession();
  const { symbol, fmt, locale } = useCurrency();
  const searchParams = useSearchParams();
  const isManager =
    session?.user?.role === Role.MANAGER || session?.user?.role === Role.ADMIN;

  // Deep-link: ?date=YYYY-MM-DD — jump to the week containing that date
  const [weekStart, setWeekStart] = useState<Date>(() => {
    const dateParam = searchParams.get("date");
    if (dateParam) {
      const d = new Date(dateParam + "T12:00:00");
      if (!isNaN(d.getTime())) return getMondayOfWeek(d);
    }
    return getMondayOfWeek(new Date());
  });
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
  const [copyingWeek, setCopyingWeek] = useState(false);
  const isFirstLoad = useRef(true);

  // ── Shift templates ────────────────────────────────────────────────────────
  const [templates, setTemplates] = useState<string[]>([]);
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [templateNameInput, setTemplateNameInput] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [applyingTemplate, setApplyingTemplate] = useState(false);

  // ── View mode & department filter ─────────────────────────────────────────
  // viewMode: "weekly" = full week grid/cards | "daily" = single-day focused view
  const [viewMode, setViewMode] = useState<"weekly" | "daily">("weekly");
  // selectedDeptId: null = all departments | "__mine__" = current user's dept | deptId string = specific dept
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
  // dayScope: only active when selectedDeptId !== null and viewMode = "daily"
  const [dayScope, setDayScope] = useState<"today" | "tomorrow" | "week">("today");
  // current user's own departmentId (fetched once)
  const [myDepartmentId, setMyDepartmentId] = useState<string | null>(null);

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
  const [complianceAlerts, setComplianceAlerts] = useState<ComplianceAlertItem[]>([]);

  // ── Drag and Drop (desktop grid only) ────────────────────────────────────
  const [draggingShiftId, setDraggingShiftId] = useState<string | null>(null);
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  async function handleDragEnd(event: any) {
    const { active, over } = event;
    setDraggingShiftId(null);
    if (!over) return;

    // Parse IDs: active = "shift-{shiftId}", over = "cell-{empId}-{dateStr}"
    const shiftId = String(active.id).replace("shift-", "");
    const cellParts = String(over.id).replace("cell-", "").split("-");
    // dateStr is last 10 chars (YYYY-MM-DD), empId is the rest
    const dateStr = cellParts.slice(-3).join("-"); // YYYY-MM-DD
    const empId = cellParts.slice(0, -3).join("-");

    const shift = shifts.find((s) => s.id === shiftId);
    if (!shift) return;
    // No-op if dropped on own cell
    if (shift.employeeId === empId && shift.date.startsWith(dateStr)) return;

    // Optimistic update
    setShifts((prev) => prev.map((s) =>
      s.id === shiftId
        ? { ...s, employeeId: empId, employee: employees.find((e) => e.id === empId) ? { id: empId, firstName: employees.find((e) => e.id === empId)!.firstName, lastName: employees.find((e) => e.id === empId)!.lastName } : s.employee, date: dateStr + "T00:00:00.000Z" }
        : s
    ));

    try {
      await fetch(`/api/shifts/${shiftId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: empId, date: dateStr }),
      });
    } catch {
      // Revert on failure
      fetchAll();
    }
  }

  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  // Irish public holidays for this week
  const weekHolidays = getHolidaysInRange(weekDates[0], weekDates[6]);
  const holidayMap: Record<string, PublicHoliday> = {};
  for (const h of weekHolidays) holidayMap[h.date] = h;

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

      // Everyone gets the full team rota — employees see published shifts only (enforced by API)
      const requests: Promise<Response>[] = [
        fetch("/api/employee/list"),
        fetch("/api/department/list"),
        fetch(`/api/shifts/list?from=${from}&to=${to}`),
      ];
      if (isManager) requests.push(fetch("/api/business/revenue-target"));

      const [empRes, deptRes, shiftRes, targetRes] = await Promise.all(requests);
      const empData = empRes.ok ? await empRes.json() : { employees: [] };
      const deptData = deptRes.ok ? await deptRes.json() : { departments: [] };
      const shiftData = shiftRes.ok ? await shiftRes.json() : { shifts: [] };
      const targetData = targetRes?.ok ? await targetRes.json() : {};
      setEmployees(empData.employees ?? []);
      setDepartments(deptData.departments ?? []);
      setShifts(shiftData.shifts ?? []);
      if (isManager) {
        setWeeklyRevenueTarget(targetData.weeklyRevenueTarget ?? null);
        setTargetInput(targetData.weeklyRevenueTarget ? String(targetData.weeklyRevenueTarget) : "");
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
      setShiftsLoading(false);
      isFirstLoad.current = false;
    }
  }, [weekStart, isManager]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Fetch saved templates
  useEffect(() => {
    if (!isManager) return;
    fetch("/api/shifts/templates")
      .then((r) => r.ok ? r.json() : { templates: [] })
      .then((d) => setTemplates(d.templates ?? []))
      .catch(() => {});
  }, [isManager]);

  async function saveAsTemplate() {
    const name = templateNameInput.trim();
    if (!name) return;
    setSavingTemplate(true);
    try {
      const monday = toDateStr(weekStart);
      await fetch("/api/shifts/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateName: name, monday, keepAssignments: true }),
      });
      const d = await fetch("/api/shifts/templates").then((r) => r.json());
      setTemplates(d.templates ?? []);
      setSaveTemplateOpen(false);
      setTemplateNameInput("");
    } finally {
      setSavingTemplate(false);
    }
  }

  async function applyTemplate(name: string) {
    if (applyingTemplate) return;
    setApplyingTemplate(true);
    setTemplateMenuOpen(false);
    try {
      const monday = toDateStr(weekStart);
      await fetch("/api/shifts/templates/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateName: name, monday }),
      });
      // Refresh shifts
      const from = toDateStr(weekStart);
      const to = toDateStr(addDays(weekStart, 6));
      const shiftsRes = await fetch(`/api/shifts?from=${from}&to=${to}`);
      const shiftsData = await shiftsRes.json();
      setShifts(shiftsData.shifts ?? shiftsData ?? []);
    } finally {
      setApplyingTemplate(false);
    }
  }

  // Fetch current user's own department once (for "My Department" filter)
  useEffect(() => {
    if (!session?.user?.id) return;
    fetch("/api/employee/me")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.employee?.departmentId) setMyDepartmentId(data.employee.departmentId);
      })
      .catch(() => {});
  }, [session?.user?.id]);

  // ── Compliance check — runs whenever shifts or employees change ───────────
  useEffect(() => {
    if (!shifts.length || !employees.length) { setComplianceAlerts([]); return; }
    const alerts: ComplianceAlertItem[] = [];
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
          message: `${empName}: ${totalHrs.toFixed(1)}h scheduled this week — exceeds 48h weekly limit (OWT Act 1997 s.15)`,
          type: "hours",
        });
      }

      // Rest break check — OWT Act 1997 s.12
      // >4.5h worked → 15 min break; >6h worked → 30 min break
      // We can only check scheduled duration; actual break compliance is on the employer.
      for (const s of empShifts) {
        const hrs = shiftHours(s);
        if (hrs > 6) {
          alerts.push({
            empId,
            empName,
            message: `${empName}: shift ${fmtTime(s.startTime)}–${fmtTime(s.endTime)} (${hrs.toFixed(1)}h) — employee is entitled to a 30-min rest break (OWT Act 1997 s.12)`,
            type: "rest",
          });
        } else if (hrs > 4.5) {
          alerts.push({
            empId,
            empName,
            message: `${empName}: shift ${fmtTime(s.startTime)}–${fmtTime(s.endTime)} (${hrs.toFixed(1)}h) — employee is entitled to a 15-min rest break (OWT Act 1997 s.12)`,
            type: "rest",
          });
        }
      }

      // 24h weekly rest check — OWT Act 1997 s.13
      // Employee must have at least one 24h continuous rest in each 7-day period
      if (sorted.length >= 2) {
        let hasOneDayOff = false;
        for (let i = 1; i < sorted.length; i++) {
          const gapMs = new Date(sorted[i].startTime).getTime() - new Date(sorted[i - 1].endTime).getTime();
          if (gapMs >= 24 * 3600000) { hasOneDayOff = true; break; }
        }
        // Also check gap before first shift (Mon start) and after last (Sun end)
        const mondayMs = weekDates[0].getTime();
        const beforeFirst = new Date(sorted[0].startTime).getTime() - mondayMs;
        if (beforeFirst >= 24 * 3600000) hasOneDayOff = true;
        const sundayEndMs = weekDates[6].getTime() + 24 * 3600000;
        const afterLast = sundayEndMs - new Date(sorted[sorted.length - 1].endTime).getTime();
        if (afterLast >= 24 * 3600000) hasOneDayOff = true;

        if (!hasOneDayOff) {
          alerts.push({
            empId,
            empName,
            message: `${empName}: no 24h continuous rest period found this week — required by OWT Act 1997 s.13`,
            type: "rest",
          });
        }
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

  // ── Copy previous week ──────────────────────────────────────────────────────
  async function copyPrevWeek() {
    if (copyingWeek) return;
    const fromMonday = toDateStr(addDays(weekStart, -7));
    const toMonday = toDateStr(weekStart);
    setCopyingWeek(true);
    try {
      const res = await fetch("/api/shifts/copy-week", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromMonday, toMonday, keepAssignments: true }),
      });
      const data = await res.json();
      if (res.ok) {
        // Refresh shifts
        const from = toDateStr(weekStart);
        const to = toDateStr(addDays(weekStart, 6));
        const shiftsRes = await fetch(`/api/shifts?from=${from}&to=${to}`);
        const shiftsData = await shiftsRes.json();
        setShifts(shiftsData.shifts ?? shiftsData ?? []);
      }
    } finally {
      setCopyingWeek(false);
    }
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

  // ── Resolve active department filter ────────────────────────────────────
  // "__mine__" resolves to the user's own departmentId
  const activeDeptId = selectedDeptId === "__mine__" ? myDepartmentId : selectedDeptId;

  // Filtered employee groups based on active department
  const filteredGroups = activeDeptId
    ? groups.filter((g) => g.dept.id === activeDeptId)
    : groups;

  // Dates to show in daily dept view
  const today = new Date();
  const tomorrow = addDays(today, 1);
  const dailyScopeDates: Date[] =
    dayScope === "today"    ? [today] :
    dayScope === "tomorrow" ? [tomorrow] :
    weekDates;  // "week" = full 7 days

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
              {fmtWeekRange(weekStart, locale)}
              {totalShifts > 0 && (
                <span className="ml-2 text-xs">· {publishedShifts}/{totalShifts} published</span>
              )}
            </p>
          </div>

          {/* Week nav — only visible in weekly view or when dept = "All" */}
          {(viewMode === "weekly" || !activeDeptId) && (
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
                className="px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-md transition-colors min-w-[52px] text-center"
              >
                {toDateStr(weekStart) === toDateStr(getMondayOfWeek(new Date()))
                  ? "Today"
                  : (() => {
                      const d = new Date(weekStart);
                      const startOfYear = new Date(d.getFullYear(), 0, 1);
                      const weekNo = Math.ceil(((d.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
                      return `Wk ${weekNo}`;
                    })()
                }
              </button>
              <button
                onClick={() => setWeekStart((w) => addDays(w, 7))}
                className="p-1.5 rounded-md hover:bg-slate-100 transition-colors"
              >
                <ChevronRight className="h-4 w-4 text-slate-600" />
              </button>
            </div>
          )}
        </div>

        {/* ── View controls row: Weekly/Daily toggle + Department filter ── */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Weekly / Daily toggle */}
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode("weekly")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                viewMode === "weekly"
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Weekly
            </button>
            <button
              onClick={() => setViewMode("daily")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                viewMode === "daily"
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              <CalendarCheck className="h-3.5 w-3.5" />
              Daily
            </button>
          </div>

          {/* Department filter */}
          <div className="flex items-center gap-1.5">
            <div className="relative">
              <Building2 className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <select
                value={selectedDeptId ?? ""}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedDeptId(val === "" ? null : val);
                  // When a dept is selected, switch to daily view automatically if not already in weekly
                  if (val !== "" && viewMode === "weekly") {
                    // stay weekly but filter is applied
                  }
                }}
                className="pl-8 pr-8 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-700 cursor-pointer"
              >
                <option value="">All Departments</option>
                {myDepartmentId && (
                  <option value="__mine__">My Department</option>
                )}
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Day scope tabs — only show when dept is selected AND view is daily */}
          {activeDeptId && viewMode === "daily" && (
            <div className="flex items-center bg-slate-100 rounded-lg p-0.5 ml-1">
              {(["today", "tomorrow", "week"] as const).map((scope) => (
                <button
                  key={scope}
                  onClick={() => setDayScope(scope)}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs font-medium transition-all capitalize",
                    dayScope === scope
                      ? "bg-white text-slate-800 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  {scope === "today" ? "Today" : scope === "tomorrow" ? "Tomorrow" : "Full Week"}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Action buttons row */}
        {isManager && (
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCSV}>
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Export</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={copyPrevWeek}
              disabled={copyingWeek}
              title="Copy all shifts from previous week into this week (as drafts)"
            >
              {copyingWeek
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <ChevronLeft className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">Copy prev week</span>
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

            {/* ── Templates dropdown ── */}
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setTemplateMenuOpen((o) => !o)}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Templates</span>
                <ChevronDown className="h-3 w-3" />
              </Button>
              {templateMenuOpen && (
                <div className="absolute right-0 top-full mt-1 z-50 w-52 bg-white border border-slate-200 rounded-xl shadow-lg py-1">
                  <button
                    className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 font-medium text-emerald-600"
                    onClick={() => { setTemplateMenuOpen(false); setSaveTemplateOpen(true); }}
                  >
                    Save this week as template…
                  </button>
                  {templates.length > 0 && (
                    <>
                      <div className="border-t border-slate-100 my-1" />
                      <p className="px-4 py-1 text-xs text-slate-400 uppercase tracking-wide">Apply template</p>
                      {templates.map((tpl) => (
                        <button
                          key={tpl}
                          className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 text-slate-700"
                          onClick={() => applyTemplate(tpl)}
                          disabled={applyingTemplate}
                        >
                          {applyingTemplate ? <Loader2 className="h-3 w-3 inline animate-spin mr-1" /> : null}
                          {tpl}
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Save Template Dialog ── */}
      {saveTemplateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-80">
            <h3 className="font-semibold text-slate-900 mb-4">Save week as template</h3>
            <label className="block text-sm text-slate-600 mb-1">Template name</label>
            <input
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="e.g. Summer weekday"
              value={templateNameInput}
              onChange={(e) => setTemplateNameInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveAsTemplate()}
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                className="px-4 py-2 text-sm rounded-lg border border-slate-200 hover:bg-slate-50"
                onClick={() => { setSaveTemplateOpen(false); setTemplateNameInput(""); }}
              >Cancel</button>
              <button
                className="px-4 py-2 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50"
                onClick={saveAsTemplate}
                disabled={savingTemplate || !templateNameInput.trim()}
              >
                {savingTemplate ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Labour Cost Banner (managers only) ── */}
      {isManager && !loading && shifts.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl px-5 py-3.5 flex flex-wrap items-center gap-4">
          {/* Labour cost */}
          <div className="flex items-center gap-2.5">
            <TrendingUp className="h-4 w-4 text-slate-400 flex-shrink-0" />
            <div>
              <p className="text-[11px] text-slate-400 uppercase tracking-wide font-medium">Labour cost</p>
              <p className="text-lg font-bold text-slate-900">{fmt(totalLabourCost)}</p>
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
                <span className="text-sm text-slate-500">{symbol}</span>
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
                {weeklyRevenueTarget ? `Target: ${symbol}${weeklyRevenueTarget.toLocaleString(locale)}` : "Set revenue target"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── AI Labour Forecast (managers only) ── */}
      {isManager && !loading && (
        <LabourForecastPanel weekStart={weekStart} shifts={shifts} />
      )}

      {/* ── Working Time Compliance Alerts (WTA 1997) ── */}
      {isManager && complianceAlerts.length > 0 && (
        <CompliancePanel alerts={complianceAlerts} />
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

            {/* ── WEEKLY MODE: all 7 days stacked, every employee visible ── */}
            {viewMode === "weekly" ? (
              <div className="space-y-2">
                {weekDates.map((date) => {
                  const dateStr = toDateStr(date);
                  const todayStr = toDateStr(new Date());
                  const isTodayDate = dateStr === todayStr;
                  const isPastDay = dateStr < todayStr;
                  const ph = holidayMap[dateStr];
                  const dayShiftCount = shifts.filter((s) => s.date.split("T")[0] === dateStr).length;
                  if (dayShiftCount === 0 && !isTodayDate) return null;

                  // ── Past day: collapsed pill ──
                  if (isPastDay) {
                    return (
                      <div key={dateStr} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-slate-100/70 border border-slate-200/60 opacity-60">
                        <div className="h-6 w-6 rounded-full bg-slate-300 flex items-center justify-center text-xs font-bold text-slate-500 flex-shrink-0">
                          {date.getDate()}
                        </div>
                        <span className="text-xs font-medium text-slate-500">
                          {date.toLocaleDateString(locale, { weekday: "short" })} · {date.toLocaleDateString(locale, { day: "numeric", month: "short" })}
                        </span>
                        {dayShiftCount > 0 && (
                          <span className="ml-auto text-xs text-slate-400">{dayShiftCount} shift{dayShiftCount !== 1 ? "s" : ""}</span>
                        )}
                        {ph && <span className="text-xs text-amber-600 font-medium">{ph.name}</span>}
                      </div>
                    );
                  }

                  return (
                    <div key={dateStr} className="space-y-2">
                      {/* Day heading */}
                      <div className="flex items-center justify-between px-0.5">
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0",
                            isTodayDate ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"
                          )}>
                            {date.getDate()}
                          </div>
                          <div>
                            <p className={cn("text-sm font-semibold leading-tight", isTodayDate ? "text-blue-700" : "text-slate-700")}>
                              {date.toLocaleDateString(locale, { weekday: "long" })}
                              {isTodayDate && <span className="ml-1.5 text-xs font-medium text-blue-500">Today</span>}
                            </p>
                            <p className="text-xs text-slate-400">
                              {date.toLocaleDateString(locale, { day: "numeric", month: "short" })}
                              {ph && <span className="ml-1.5 text-amber-600 font-medium">{ph.name}</span>}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs text-slate-400">{dayShiftCount} shift{dayShiftCount !== 1 ? "s" : ""}</span>
                      </div>

                      {/* All employee cards for this day */}
                      <div className="space-y-1.5">
                        {filteredGroups.map(({ dept, colors, emps }) => {
                          const sortedEmps = emps.filter((emp) => !!getShift(emp.id, dateStr));
                          return sortedEmps.map((emp) => {
                            const shift = getShift(emp.id, dateStr);
                            return (
                              <button
                                key={emp.id}
                                onClick={() => handleCellClick(emp.id, dateStr, shift)}
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
                                <div className="flex items-center gap-3">
                                  <div className={cn(
                                    "h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0",
                                    shift ? colors.cardBg + " " + colors.cardText : "bg-slate-100 text-slate-400"
                                  )}>
                                    {emp.firstName[0]}{emp.lastName[0]}
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold text-slate-800 leading-tight">
                                      {emp.firstName} {emp.lastName}
                                    </p>
                                    {shift ? (
                                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                        <span className="text-xs text-slate-500 flex items-center gap-0.5">
                                          <Clock className="h-3 w-3" />
                                          {fmtTime(shift.startTime)}–{fmtTime(shift.endTime)}
                                        </span>
                                        {shift.role && <span className="text-xs text-slate-400">· {shift.role}</span>}
                                        {(shift.overtimeHours ?? 0) > 0 && (
                                          <span className="text-[10px] font-bold bg-orange-500 text-white px-1.5 py-0.5 rounded-full">
                                            +{shift.overtimeHours}h OT
                                          </span>
                                        )}
                                      </div>
                                    ) : (
                                      <p className="text-xs text-slate-400 mt-0.5">
                                        <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full", colors.bg, colors.text)}>{dept.name}</span>
                                        <span className="ml-1">· No shift</span>
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <div className="flex-shrink-0 flex items-center gap-1.5">
                                  {shift ? (
                                    shift.published
                                      ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                      : <AlertCircle className="h-4 w-4 text-amber-500" />
                                  ) : isManager ? (
                                    <div className="h-7 w-7 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center">
                                      <Plus className="h-3.5 w-3.5 text-blue-500" />
                                    </div>
                                  ) : null}
                                </div>
                              </button>
                            );
                          });
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

            ) : (
              /* ── DAILY MODE ── */
              <div className="space-y-4">
                {/* Day selector strip — daily mode only */}
                {(!activeDeptId || dayScope === "week") && (
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
                          {holidayMap[toDateStr(date)] && (
                            <span className={cn("mt-0.5 h-1.5 w-1.5 rounded-full", isSelected ? "bg-amber-300" : "bg-amber-400")} title={holidayMap[toDateStr(date)]?.name} />
                          )}
                          {!holidayMap[toDateStr(date)] && dayShifts.length > 0 && (
                            <span className={cn("mt-0.5 h-1 w-1 rounded-full", isSelected ? "bg-white/70" : "bg-blue-400")} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Daily dept view: iterate over dailyScopeDates */}
                {activeDeptId ? (
                  <div className="space-y-5">
                    {dailyScopeDates.map((date) => {
                      const dateStr = toDateStr(date);
                      const isTodayDate = dateStr === toDateStr(new Date());
                      const dayShiftCount = shifts.filter((s) => s.date.split("T")[0] === dateStr).length;
                      if (dayShiftCount === 0) return null;
                      return (
                        <div key={dateStr} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h2 className="text-sm font-semibold text-slate-700">
                              {date.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })}
                              {isTodayDate && (
                                <span className="ml-2 text-xs font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">Today</span>
                              )}
                              {holidayMap[dateStr] && (
                                <span className="ml-2 text-xs font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full">
                                  {holidayMap[dateStr].name}
                                </span>
                              )}
                            </h2>
                            <span className="text-xs text-slate-400">
                              {shifts.filter((s) => s.date.split("T")[0] === dateStr).length} shifts
                            </span>
                          </div>
                          {filteredGroups.map(({ dept, colors, emps }) => {
                            const scheduledEmps = emps.filter((emp) => !!getShift(emp.id, dateStr));
                            if (scheduledEmps.length === 0) return null;
                            return (
                            <div key={dept.id} className="space-y-1.5">
                              {filteredGroups.length > 1 && (
                                <div className="flex items-center gap-1.5 px-0.5">
                                  <span className={cn("h-2 w-2 rounded-full flex-shrink-0", colors.dot)} />
                                  <span className={cn("text-xs font-semibold uppercase tracking-wide", colors.text)}>{dept.name}</span>
                                </div>
                              )}
                              {scheduledEmps.map((emp) => {
                                const shift = getShift(emp.id, dateStr);
                                const weekHrs = empWeekHours(emp.id, weekDates, getShift);
                                return (
                                  <button
                                    key={emp.id}
                                    onClick={() => handleCellClick(emp.id, dateStr, shift)}
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
                                    <div className="flex items-center gap-3">
                                      <div className={cn(
                                        "h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0",
                                        shift ? colors.cardBg + " " + colors.cardText : "bg-slate-100 text-slate-400"
                                      )}>
                                        {emp.firstName[0]}{emp.lastName[0]}
                                      </div>
                                      <div>
                                        <p className="text-sm font-semibold text-slate-800">{emp.firstName} {emp.lastName}</p>
                                        {shift ? (
                                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                            <span className="text-xs text-slate-500 flex items-center gap-0.5">
                                              <Clock className="h-3 w-3" />
                                              {fmtTime(shift.startTime)}–{fmtTime(shift.endTime)}
                                            </span>
                                            {shift.role && <span className="text-xs text-slate-400">· {shift.role}</span>}
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
                                    <div className="flex-shrink-0 flex items-center gap-1.5">
                                      {shift ? (
                                        shift.published
                                          ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                          : <AlertCircle className="h-4 w-4 text-amber-500" />
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
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Daily, no dept filter — single day picker */
                  <>
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-semibold text-slate-700">
                        {selectedDate.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })}
                        {isToday && (
                          <span className="ml-2 text-xs font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">Today</span>
                        )}
                      </h2>
                      <span className="text-xs text-slate-400">
                        {shifts.filter((s) => s.date.split("T")[0] === selectedDateStr).length} shifts
                      </span>
                    </div>
                    <div className="space-y-3">
                      {filteredGroups.map(({ dept, colors, emps }) => {
                        const scheduledEmps = emps.filter((emp) => !!getShift(emp.id, selectedDateStr));
                        if (scheduledEmps.length === 0) return null;
                        return (
                        <div key={dept.id} className="space-y-1.5">
                          <div className="flex items-center gap-1.5 px-0.5">
                            <span className={cn("h-2 w-2 rounded-full flex-shrink-0", colors.dot)} />
                            <span className={cn("text-xs font-semibold uppercase tracking-wide", colors.text)}>{dept.name}</span>
                          </div>
                          {scheduledEmps.map((emp) => {
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
                                <div className="flex items-center gap-3">
                                  <div className={cn(
                                    "h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0",
                                    shift ? colors.cardBg + " " + colors.cardText : "bg-slate-100 text-slate-400"
                                  )}>
                                    {emp.firstName[0]}{emp.lastName[0]}
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold text-slate-800">{emp.firstName} {emp.lastName}</p>
                                    {shift ? (
                                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                        <span className="text-xs text-slate-500 flex items-center gap-0.5">
                                          <Clock className="h-3 w-3" />
                                          {fmtTime(shift.startTime)}–{fmtTime(shift.endTime)}
                                        </span>
                                        {shift.role && <span className="text-xs text-slate-400">· {shift.role}</span>}
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
                                <div className="flex-shrink-0 flex items-center gap-1.5">
                                  {shift ? (
                                    shift.published
                                      ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                      : <AlertCircle className="h-4 w-4 text-amber-500" />
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
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* ── DESKTOP VIEW (>= lg) ── */}
          <div className="hidden lg:block space-y-6">
            {/* Daily dept view on desktop: shows each date as a column-like card */}
            {activeDeptId && viewMode === "daily" ? (
              <div className="space-y-6">
                {dailyScopeDates.map((date) => {
                  const dateStr = toDateStr(date);
                  const isTodayDate = dateStr === toDateStr(new Date());
                  const ph = holidayMap[dateStr];
                  return (
                    <div key={dateStr} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                      {/* Date header */}
                      <div className={cn(
                        "flex items-center justify-between px-5 py-3 border-b border-slate-100",
                        isTodayDate ? "bg-blue-50" : ph ? "bg-amber-50" : "bg-slate-50"
                      )}>
                        <div className="flex items-center gap-3">
                          <span className={cn("text-sm font-bold", isTodayDate ? "text-blue-700" : "text-slate-700")}>
                            {date.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })}
                          </span>
                          {isTodayDate && (
                            <span className="text-xs font-medium text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">Today</span>
                          )}
                          {ph && (
                            <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                              {ph.name}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-400">
                          {shifts.filter((s) => s.date.split("T")[0] === dateStr).length} shifts
                        </span>
                      </div>
                      {/* Staff rows */}
                      <div className="divide-y divide-slate-50">
                        {filteredGroups.flatMap(({ dept, colors, emps }) =>
                          emps.map((emp) => {
                            const shift = getShift(emp.id, dateStr);
                            return (
                              <div key={emp.id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50/60 transition-colors">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className={cn(
                                    "h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0",
                                    colors.cardBg, colors.cardText
                                  )}>
                                    {emp.firstName[0]}{emp.lastName[0]}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm font-semibold text-slate-800 truncate">
                                      {emp.firstName} {emp.lastName}
                                    </p>
                                    <p className={cn("text-xs", colors.text)}>{dept.name}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3 flex-shrink-0">
                                  {shift ? (
                                    <>
                                      <div className="text-right">
                                        <p className="text-sm font-semibold text-slate-800">
                                          {fmtTime(shift.startTime)}–{fmtTime(shift.endTime)}
                                        </p>
                                        {shift.role && <p className="text-xs text-slate-400">{shift.role}</p>}
                                      </div>
                                      {shift.published
                                        ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                        : <AlertCircle className="h-4 w-4 text-amber-500" />}
                                      {isManager && (
                                        <button
                                          onClick={() => handleCellClick(emp.id, dateStr, shift)}
                                          className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1 rounded hover:bg-slate-100 transition-colors"
                                        >
                                          Edit
                                        </button>
                                      )}
                                    </>
                                  ) : isManager ? (
                                    <button
                                      onClick={() => handleCellClick(emp.id, dateStr)}
                                      className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 px-2.5 py-1.5 rounded-lg border border-dashed border-blue-200 hover:border-blue-400 hover:bg-blue-50 transition-all"
                                    >
                                      <Plus className="h-3.5 w-3.5" />
                                      Add shift
                                    </button>
                                  ) : (
                                    <span className="text-xs text-slate-300">Off</span>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Standard weekly grid */
              <DndContext
                sensors={dndSensors}
                onDragStart={(e) => setDraggingShiftId(String(e.active.id).replace("shift-", ""))}
                onDragEnd={handleDragEnd}
                onDragCancel={() => setDraggingShiftId(null)}
              >
                {filteredGroups.map(({ dept, colors, emps }) => (
                  <DeptBlock
                    key={dept.id}
                    dept={dept}
                    colors={colors}
                    employees={emps}
                    weekDates={weekDates}
                    getShift={getShift}
                    isManager={isManager}
                    onCellClick={handleCellClick}
                    holidayMap={holidayMap}
                    draggingShiftId={draggingShiftId}
                  />
                ))}
              <DragOverlay>
                {draggingShiftId ? (() => {
                  const s = shifts.find((x) => x.id === draggingShiftId);
                  if (!s) return null;
                  return (
                    <div className="bg-blue-600 text-white text-[11px] font-semibold rounded-md px-2 py-2 shadow-lg min-w-[60px] text-center opacity-90 pointer-events-none">
                      <div>{fmtTime(s.startTime)}</div>
                      <div className="opacity-80">–{fmtTime(s.endTime)}</div>
                    </div>
                  );
                })() : null}
              </DragOverlay>
            </DndContext>
            )}
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
                {new Date(cellContext.date + "T12:00:00").toLocaleDateString(locale, {
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

// ─── AI Labour Forecast Panel ────────────────────────────────────────────────

interface ForecastDay {
  date: string;
  dayLabel: string;
  expectedCovers: number;
  suggestedStaff: number;
  scheduledStaff: number;
  status: "ok" | "understaffed" | "overstaffed";
}

function LabourForecastPanel({ weekStart, shifts }: { weekStart: Date; shifts: Shift[] }) {
  const [forecast, setForecast] = useState<ForecastDay[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetched = useRef<string | null>(null);

  const weekKey = toDateStr(weekStart);

  async function load() {
    if (fetched.current === weekKey) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/ai/labour-forecast?weekStart=${weekKey}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Forecast failed");
      // Merge with actual scheduled counts
      const byDate: Record<string, number> = {};
      for (const s of shifts) {
        const d = s.date.split("T")[0];
        byDate[d] = (byDate[d] ?? 0) + 1;
      }
      const enriched: ForecastDay[] = (data.forecast ?? []).map((f: any) => {
        const scheduled = byDate[f.date] ?? 0;
        let status: ForecastDay["status"] = "ok";
        if (scheduled < f.suggestedStaff) status = "understaffed";
        else if (scheduled > f.suggestedStaff + 2) status = "overstaffed";
        return { ...f, scheduledStaff: scheduled, status };
      });
      setForecast(enriched);
      fetched.current = weekKey;
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  // Reset when week changes
  useEffect(() => { fetched.current = null; setForecast(null); }, [weekKey]);

  function handleToggle() {
    const next = !open;
    setOpen(next);
    if (next && !forecast) load();
  }

  const issues = forecast?.filter((d) => d.status !== "ok") ?? [];

  return (
    <div className="border border-violet-200 bg-white rounded-xl overflow-hidden">
      <button
        onClick={handleToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-violet-50/40 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 bg-violet-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <Sparkles className="h-3.5 w-3.5 text-violet-600" />
          </div>
          <span className="text-sm font-semibold text-slate-800">AI Labour Forecast</span>
          {issues.length > 0 && !loading && (
            <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">
              {issues.length} {issues.length === 1 ? "issue" : "issues"}
            </span>
          )}
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-500" />}
        </div>
        <ChevronDown className={cn("h-4 w-4 text-slate-400 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="border-t border-violet-100 px-4 pb-4 pt-3">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}
          {loading && (
            <div className="flex items-center gap-2 py-4 justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-violet-400" />
              <span className="text-sm text-slate-500">Analysing reservations…</span>
            </div>
          )}
          {forecast && (
            <>
              <div className="grid grid-cols-7 gap-1.5 mb-3">
                {forecast.map((day) => {
                  const isOk = day.status === "ok";
                  const isUnder = day.status === "understaffed";
                  const isOver = day.status === "overstaffed";
                  return (
                    <div
                      key={day.date}
                      className={cn(
                        "rounded-xl p-2 text-center",
                        isUnder ? "bg-red-50 border border-red-200" :
                        isOver ? "bg-amber-50 border border-amber-200" :
                        "bg-slate-50 border border-slate-100"
                      )}
                    >
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">{day.dayLabel}</p>
                      <div className="mt-1.5 space-y-1">
                        <div className="flex items-center justify-center gap-0.5">
                          <CalendarDays className="h-2.5 w-2.5 text-slate-400" />
                          <span className="text-xs font-bold text-slate-700">{day.expectedCovers}</span>
                        </div>
                        <div className="flex items-center justify-center gap-0.5">
                          <Users className="h-2.5 w-2.5 text-slate-400" />
                          <span className={cn(
                            "text-xs font-bold",
                            isUnder ? "text-red-600" : isOver ? "text-amber-600" : "text-emerald-600"
                          )}>
                            {day.scheduledStaff}/{day.suggestedStaff}
                          </span>
                        </div>
                      </div>
                      <div className={cn(
                        "mt-1.5 h-1 rounded-full",
                        isUnder ? "bg-red-400" : isOver ? "bg-amber-400" : "bg-emerald-400"
                      )} />
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" /> = expected covers</span>
                <span className="flex items-center gap-1"><Users className="h-3 w-3" /> = rostered / suggested staff</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-400 inline-block" /> ok</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-400 inline-block" /> understaffed</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400 inline-block" /> overstaffed</span>
              </div>
              {issues.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {issues.map((d) => (
                    <div key={d.date} className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-lg text-sm",
                      d.status === "understaffed" ? "bg-red-50 text-red-700 border border-red-200" : "bg-amber-50 text-amber-700 border border-amber-200"
                    )}>
                      <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                      <span>
                        <strong>{d.dayLabel}</strong>: {d.expectedCovers} covers expected —
                        {d.status === "understaffed"
                          ? ` ${d.scheduledStaff} rostered but ${d.suggestedStaff} suggested`
                          : ` ${d.scheduledStaff} rostered vs ${d.suggestedStaff} suggested (overstaffed)`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── DnD Wrappers ────────────────────────────────────────────────────────────

function DraggableShift({
  shiftId, children, disabled,
}: { shiftId: string; children: React.ReactNode; disabled?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `shift-${shiftId}`,
    disabled,
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{ opacity: isDragging ? 0.4 : 1, cursor: disabled ? "default" : "grab", touchAction: "none" }}
    >
      {children}
    </div>
  );
}

function DroppableCell({
  empId, dateStr, children, isManager,
}: { empId: string; dateStr: string; children: React.ReactNode; isManager: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: `cell-${empId}-${dateStr}` });
  return (
    <div
      ref={setNodeRef}
      style={{ outline: isOver && isManager ? "2px solid #7c3aed" : undefined, borderRadius: 8, transition: "outline 0.1s" }}
    >
      {children}
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
  holidayMap,
  draggingShiftId,
}: {
  dept: Department;
  colors: { bg: string; text: string; dot: string };
  employees: Employee[];
  weekDates: Date[];
  getShift: (empId: string, dateStr: string) => Shift | undefined;
  isManager: boolean;
  onCellClick: (empId: string, dateStr: string, existing?: Shift) => void;
  holidayMap: Record<string, { date: string; name: string; isPremiumPay: boolean }>;
  draggingShiftId?: string | null;
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
                const todayStr = toDateStr(new Date());
                const dateStr = toDateStr(date);
                const isToday = dateStr === todayStr;
                const isPast = dateStr < todayStr;
                const ph = holidayMap[dateStr];
                return (
                  <th
                    key={i}
                    className={cn(
                      "text-center py-2.5 text-xs font-medium transition-all",
                      isPast ? "px-1 w-10 opacity-40" : "px-1",
                      ph && !isPast ? "bg-amber-50" : "",
                      isToday ? "text-blue-600" : "text-slate-500"
                    )}
                    title={ph?.name}
                  >
                    <div className={isPast ? "text-[10px]" : ""}>{DAYS[i]}</div>
                    <div className={cn("mt-0.5", isPast ? "text-[10px]" : "text-[11px]", isToday ? "font-bold text-blue-600" : "text-slate-400 font-normal")}>
                      {date.getDate()}
                    </div>
                    {ph && !isPast && (
                      <div className="text-[9px] text-amber-600 font-semibold mt-0.5 leading-tight truncate max-w-[60px] mx-auto" title={ph.name}>
                        PH
                      </div>
                    )}
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
                    const todayStr = toDateStr(new Date());
                    const shift = getShift(emp.id, dateStr);
                    const isToday = dateStr === todayStr;
                    const isPast = dateStr < todayStr;
                    const isDraggingThis = draggingShiftId && shift?.id === draggingShiftId;
                    return (
                      <td key={di} className={cn("px-1 py-1.5 text-center align-middle", isPast && "opacity-35 pointer-events-none w-10", isToday && "bg-blue-50/40", !isPast && holidayMap[dateStr] && "bg-amber-50/60")}>
                        <DroppableCell empId={emp.id} dateStr={dateStr} isManager={isManager}>
                          {shift ? (
                            <DraggableShift shiftId={shift.id} disabled={!isManager}>
                              <button
                                onClick={() => onCellClick(emp.id, dateStr, shift)}
                                className={cn(
                                  "w-full rounded-md px-1.5 py-1.5 text-[11px] font-medium leading-tight transition-all",
                                  isDraggingThis ? "opacity-30" : "",
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
                            </DraggableShift>
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
                        </DroppableCell>
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

export default function RotaPage() {
  return (
    <Suspense fallback={null}>
      <RotaInner />
    </Suspense>
  );
}
