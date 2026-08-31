// @ts-nocheck
"use client";

/**
 * Assign & chase.
 *
 * A due date nobody is reminded of is a note in a drawer. This tab is the
 * setting half: a manager makes an in-house course required for the whole
 * venue, one department, one role or one named person, with a date. The
 * nightly cron (/api/cron/course-assignments) does the chasing.
 *
 * Status here comes from the same resolver the cron uses, so what a manager
 * reads on this screen and what a nudge says can never disagree.
 */

import { useEffect, useState } from "react";
import {
  ClipboardList, Loader2, Plus, Trash2, AlertTriangle, CheckCircle2,
  Users, Building2, BadgeCheck, User as UserIcon, CalendarClock, X,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IE", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

/** A due date is only useful with the distance to it spelled out. */
function dueText(days: number | null) {
  if (days === null || days === undefined) return "";
  if (days < 0) return `${-days} day${days === -1 ? "" : "s"} overdue`;
  if (days === 0) return "due today";
  if (days === 1) return "due tomorrow";
  return `${days} days left`;
}

const SCOPE_ICON: Record<string, any> = {
  business: Users,
  department: Building2,
  role: BadgeCheck,
  employee: UserIcon,
};

const MY_STATUS: Record<string, { label: string; cls: string }> = {
  VALID: { label: "Done", cls: "bg-green-100 text-green-700 border-green-200" },
  EXPIRING_SOON: { label: "Expiring — redo", cls: "bg-amber-100 text-amber-700 border-amber-200" },
  EXPIRED: { label: "Expired — redo", cls: "bg-red-100 text-red-700 border-red-200" },
  NOT_STARTED: { label: "Not done", cls: "bg-slate-100 text-slate-600 border-slate-200" },
};

/** yyyy-mm-dd for a date input, in local time rather than UTC. */
function isoDay(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export default function AssignmentsTab({
  onOpenCourses,
}: {
  onOpenCourses?: () => void;
}) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const [courseSlug, setCourseSlug] = useState("");
  const [scope, setScope] = useState("business");
  const [departmentId, setDepartmentId] = useState("");
  const [role, setRole] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return isoDay(d);
  });
  const [note, setNote] = useState("");

  async function load() {
    try {
      const r = await fetch("/api/training/assignments");
      const d = await r.json();
      setData(d);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function submit(e: any) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const r = await fetch("/api/training/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseSlug,
          scope,
          departmentId: scope === "department" ? departmentId : undefined,
          role: scope === "role" ? role : undefined,
          employeeId: scope === "employee" ? employeeId : undefined,
          dueDate,
          note: note.trim() || undefined,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(d?.error || "Could not save that assignment.");
        return;
      }
      setShowForm(false);
      setNote("");
      setCourseSlug("");
      setScope("business");
      setDepartmentId("");
      setRole("");
      setEmployeeId("");
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    setRemoving(id);
    try {
      await fetch(`/api/training/assignments?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      await load();
    } finally {
      setRemoving(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  const mine: any[] = data?.mine || [];
  const all: any[] | null = data?.all ?? null;
  const canAssign = !!data?.canAssign;
  const courses: any[] = data?.courses || [];
  const departments: any[] = data?.departments || [];
  const roles: string[] = data?.roles || [];
  const employees: any[] = data?.employees || [];

  const scopeReady =
    scope === "business" ||
    (scope === "department" && !!departmentId) ||
    (scope === "role" && !!role) ||
    (scope === "employee" && !!employeeId);

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
        <ClipboardList className="h-4 w-4 mt-0.5 shrink-0 text-slate-500" />
        <div className="flex-1">
          <strong>Required training.</strong>{" "}
          Set a course as required with a date, and Rotahr chases it: staff are
          reminded 14, 7, 3 and 1 days before, on the day, then weekly while it
          stays outstanding. Once the date passes, managers are told who is
          still to do it. Anyone already holding a current record is skipped.
        </div>
      </div>

      {/* What this person has been told to do — shown to everybody, manager or not. */}
      {mine.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <h3 className="font-semibold text-slate-900">Assigned to you</h3>
            <div className="mt-3 space-y-2">
              {mine.map((m: any) => {
                const st = MY_STATUS[m.status] ?? MY_STATUS.NOT_STARTED;
                return (
                  <div
                    key={m.id}
                    className={cn(
                      "flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2.5",
                      m.status === "VALID"
                        ? "border-slate-200 bg-white"
                        : m.overdue
                          ? "border-red-200 bg-red-50"
                          : "border-amber-200 bg-amber-50"
                    )}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-slate-900">{m.courseTitle}</span>
                        <Badge variant="outline" className={cn("text-xs", st.cls)}>{st.label}</Badge>
                      </div>
                      <div className="mt-0.5 text-xs text-slate-600">
                        Required by {fmt(m.dueDate)}
                        {m.status !== "VALID" && ` — ${dueText(m.daysUntilDue)}`}
                        {m.note ? ` · ${m.note}` : ""}
                      </div>
                    </div>
                    {m.status !== "VALID" && onOpenCourses && (
                      <Button size="sm" variant="outline" onClick={onOpenCourses}>
                        Open courses
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {!canAssign && mine.length === 0 && (
        <Card><CardContent className="py-10 text-center text-slate-500">
          Nothing has been assigned to you.
        </CardContent></Card>
      )}

      {canAssign && (
        <>
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold text-slate-900">
              Venue assignments{all ? ` (${all.length})` : ""}
            </h3>
            <Button size="sm" onClick={() => setShowForm((v) => !v)}>
              {showForm ? <X className="h-4 w-4 mr-1.5" /> : <Plus className="h-4 w-4 mr-1.5" />}
              {showForm ? "Cancel" : "Assign a course"}
            </Button>
          </div>

          {showForm && (
            <Card>
              <CardContent className="p-5">
                <form onSubmit={submit} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label>Course</Label>
                      <Select value={courseSlug} onValueChange={setCourseSlug}>
                        <SelectTrigger className="mt-1.5">
                          <SelectValue placeholder="Choose a course" />
                        </SelectTrigger>
                        <SelectContent>
                          {courses.map((c: any) => (
                            <SelectItem key={c.slug} value={c.slug}>{c.title}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Who has to do it</Label>
                      <Select
                        value={scope}
                        onValueChange={(v) => {
                          setScope(v);
                          setDepartmentId("");
                          setRole("");
                          setEmployeeId("");
                        }}
                      >
                        <SelectTrigger className="mt-1.5">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="business">Everyone at this venue</SelectItem>
                          {/* Two venues have no departments at all, so the option
                              is hidden rather than offered and then failing. */}
                          {departments.length > 0 && (
                            <SelectItem value="department">A department</SelectItem>
                          )}
                          {roles.length > 0 && <SelectItem value="role">A role</SelectItem>}
                          <SelectItem value="employee">One person</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {scope === "department" && (
                      <div>
                        <Label>Department</Label>
                        <Select value={departmentId} onValueChange={setDepartmentId}>
                          <SelectTrigger className="mt-1.5">
                            <SelectValue placeholder="Choose a department" />
                          </SelectTrigger>
                          <SelectContent>
                            {departments.map((d: any) => (
                              <SelectItem key={d.id} value={d.id}>
                                {d.name} ({d.employees})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {scope === "role" && (
                      <div>
                        <Label>Role</Label>
                        <Select value={role} onValueChange={setRole}>
                          <SelectTrigger className="mt-1.5">
                            <SelectValue placeholder="Choose a role" />
                          </SelectTrigger>
                          <SelectContent>
                            {/* Roles are your own job titles as typed on the
                                staff records, not a fixed list. */}
                            {roles.map((r: string) => (
                              <SelectItem key={r} value={r}>{r}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {scope === "employee" && (
                      <div>
                        <Label>Person</Label>
                        <Select value={employeeId} onValueChange={setEmployeeId}>
                          <SelectTrigger className="mt-1.5">
                            <SelectValue placeholder="Choose a person" />
                          </SelectTrigger>
                          <SelectContent>
                            {employees.map((e: any) => (
                              <SelectItem key={e.id} value={e.id}>
                                {e.name}{e.role ? ` — ${e.role}` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div>
                      <Label htmlFor="due">Due by</Label>
                      <Input
                        id="due"
                        type="date"
                        className="mt-1.5"
                        value={dueDate}
                        min={isoDay(new Date())}
                        onChange={(e) => setDueDate(e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="note">Note (optional)</Label>
                    <Textarea
                      id="note"
                      className="mt-1.5"
                      rows={2}
                      maxLength={500}
                      placeholder="Shown to staff with the reminder — e.g. before the EHO visit"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </div>

                  {error && (
                    <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <Button type="submit" disabled={saving || !courseSlug || !scopeReady || !dueDate}>
                      {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
                      Set as required
                    </Button>
                    <span className="text-xs text-slate-500">
                      Nobody is emailed. Reminders arrive in the app bell and as a push.
                    </span>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {all && all.length === 0 && (
            <Card><CardContent className="py-10 text-center text-slate-500">
              No course has been made required yet. Assigning one is how a course
              stops being optional.
            </CardContent></Card>
          )}

          {all?.map((a: any) => {
            const Icon = SCOPE_ICON[a.scope] || Users;
            const pct = a.total > 0 ? Math.round((a.done / a.total) * 100) : 0;
            const complete = a.total > 0 && a.outstanding === 0;
            return (
              <Card key={a.id}>
                <CardContent className="p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-semibold text-slate-900">{a.courseTitle}</h4>
                        <Badge variant="outline" className="text-xs bg-slate-100 text-slate-600 border-slate-200">
                          <Icon className="h-3 w-3 mr-1" />
                          {a.scopeLabel}
                        </Badge>
                        {complete ? (
                          <Badge variant="outline" className="text-xs bg-green-100 text-green-700 border-green-200">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            All done
                          </Badge>
                        ) : a.overdue ? (
                          <Badge variant="outline" className="text-xs bg-red-100 text-red-700 border-red-200">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            {dueText(a.daysUntilDue)}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs bg-amber-100 text-amber-700 border-amber-200">
                            <CalendarClock className="h-3 w-3 mr-1" />
                            {dueText(a.daysUntilDue)}
                          </Badge>
                        )}
                      </div>

                      <div className="mt-1.5 text-xs text-slate-500">
                        Due by {fmt(a.dueDate)}
                        {a.note ? ` · ${a.note}` : ""}
                      </div>

                      <div className="mt-3 max-w-md">
                        <div className="flex items-center justify-between text-xs text-slate-600">
                          <span>{a.done} of {a.total} up to date</span>
                          <span>{pct}%</span>
                        </div>
                        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              complete ? "bg-green-500" : a.overdue ? "bg-red-500" : "bg-amber-500"
                            )}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>

                      {a.total === 0 && (
                        <p className="mt-3 text-xs text-slate-500">
                          Nobody currently matches this assignment — the role or
                          department may have changed since it was set.
                        </p>
                      )}

                      {a.outstandingNames?.length > 0 && (
                        <div className="mt-3">
                          <div className="text-xs font-medium text-slate-600">Still to do it</div>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {a.outstandingNames.map((n: any) => (
                              <Badge
                                key={n.employeeId}
                                variant="outline"
                                className={cn(
                                  "text-xs",
                                  n.status === "EXPIRED"
                                    ? "bg-red-50 text-red-700 border-red-200"
                                    : n.status === "EXPIRING_SOON"
                                      ? "bg-amber-50 text-amber-700 border-amber-200"
                                      : "bg-slate-50 text-slate-600 border-slate-200"
                                )}
                              >
                                {n.name}
                                {n.status === "EXPIRED" ? " · expired" : ""}
                                {n.status === "EXPIRING_SOON" ? " · expiring" : ""}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={removing === a.id}
                        onClick={() => remove(a.id)}
                        className="text-slate-600 hover:text-red-600"
                      >
                        {removing === a.id
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <Trash2 className="h-4 w-4" />}
                        <span className="ml-1.5">Remove</span>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          <p className="text-xs text-slate-500">
            Removing an assignment stops the reminders. The training records it
            produced are kept.
          </p>
        </>
      )}
    </div>
  );
}
