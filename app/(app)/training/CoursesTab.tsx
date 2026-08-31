// @ts-nocheck
"use client";

/**
 * In-house courses. These are employer-delivered training records, not
 * accredited qualifications — the copy on this page must never imply otherwise,
 * because a false claim on a certificate shown to an inspector is worse than
 * having no course at all.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  GraduationCap, Clock, CheckCircle2, AlertTriangle, Loader2,
  ChevronRight, Users, Utensils, Play, RotateCcw, Flame, PackageOpen, Thermometer,
  SprayCan, Truck, ShieldCheck, CalendarClock, ClipboardCheck, ClipboardList,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IE", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

const STATUS: Record<string, { label: string; cls: string }> = {
  VALID: { label: "Up to date", cls: "bg-green-100 text-green-700 border-green-200" },
  EXPIRING_SOON: { label: "Due soon", cls: "bg-amber-100 text-amber-700 border-amber-200" },
  EXPIRED: { label: "Retrain due", cls: "bg-red-100 text-red-700 border-red-200" },
  NOT_STARTED: { label: "Not done", cls: "bg-slate-100 text-slate-600 border-slate-200" },
};

export default function CoursesTab({
  onOpenMatrix,
  onOpenTeamBoard,
}: {
  onOpenMatrix?: () => void;
  onOpenTeamBoard?: () => void;
}) {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [openRoster, setOpenRoster] = useState<string | null>(null);
  // Courses this person has been told to do, keyed by slug. Loaded separately
  // so a failure here can never blank the course list itself.
  const [assigned, setAssigned] = useState<Record<string, any>>({});

  useEffect(() => {
    fetch("/api/training/courses")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));

    fetch("/api/training/assignments")
      .then((r) => r.json())
      .then((d) => {
        const map: Record<string, any> = {};
        for (const m of d?.mine || []) {
          // Soonest due date wins if the same course is assigned twice.
          const prev = map[m.courseSlug];
          if (!prev || new Date(m.dueDate) < new Date(prev.dueDate)) map[m.courseSlug] = m;
        }
        setAssigned(map);
      })
      .catch(() => {});
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  const courses = data?.courses ?? [];
  const menu = data?.menu ?? { dishes: 0, checked: 0 };
  const equipment = data?.equipment ?? { assets: 0 };
  const stock = data?.stock ?? { items: 0 };
  const haccp = data?.haccp ?? { units: 0, logged: 0, failures: 0 };
  const cleaning = data?.cleaning ?? { records: 0 };
  const deliveries = data?.deliveries ?? { records: 0 };
  const customers = data?.customers ?? { profiles: 0 };
  const shifts = data?.shifts ?? { total: 0, breaksRecorded: 0 };

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        <strong className="text-slate-800">In-house training, delivered by you.</strong>{" "}
        These courses produce a dated record signed by the trainee, which is what most
        food-safety regimes expect an employer to keep. They are not accredited
        qualifications and Rotahr never presents them as one — where a licence or an
        accredited certificate is required, you still need an approved provider.
      </div>

      {onOpenTeamBoard && data?.canSeeRoster && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          <Users className="h-4 w-4 shrink-0 text-slate-400" />
          <span>
            Chasing a whole roster? The team board puts every member of staff against
            every course on one grid.
          </span>
          <button
            onClick={onOpenTeamBoard}
            className="ml-auto font-medium text-orange-600 underline hover:text-orange-700"
          >
            Open the team board
          </button>
        </div>
      )}

      {courses.some((c: any) => c.usesMenu) && menu.checked < menu.dishes && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <Utensils className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="flex-1">
            <strong>
              {menu.checked} of {menu.dishes} dishes have confirmed allergen information.
            </strong>{" "}
            The allergen course builds its best questions from your own menu. Confirm the
            rest and the course gets sharper for every member of staff who takes it after.
            {onOpenMatrix && (
              <button
                onClick={onOpenMatrix}
                className="ml-1 font-medium text-amber-800 underline hover:text-amber-950"
              >
                Open the allergen matrix
              </button>
            )}
          </div>
        </div>
      )}

      {courses.some((c: any) => c.usesAssets) && equipment.assets === 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <Flame className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="flex-1">
            <strong>No equipment recorded yet.</strong>{" "}
            The fire safety course names your own fryers, ovens and extraction once the
            equipment register is filled in — under Log book → Equipment. The course runs
            either way; it just gets sharper when it can point at the actual kit.
          </div>
        </div>
      )}

      {courses.some((c: any) => c.usesStock) && stock.items === 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <PackageOpen className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="flex-1">
            <strong>No stock items recorded yet.</strong>{" "}
            The manual handling course names the heaviest things you actually take in —
            the sacks, the oil, the kegs — once your stock list has pack sizes on it,
            under Stock. The course runs either way; it just stops talking in general
            terms once it can point at a real delivery.
          </div>
        </div>
      )}

      {courses.some((c: any) => c.usesHaccp) && haccp.units === 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <Thermometer className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="flex-1">
            <strong>No named HACCP units yet.</strong>{" "}
            The food hygiene course names your own fridges, freezers and hot-holding
            units, with the range each one is held to, once they are on the equipment
            list under HACCP. The course runs either way \— and a log against
            &ldquo;the fridge&rdquo; cannot show which unit was checked.
          </div>
        </div>
      )}

      {courses.some((c: any) => c.usesCleaning) && cleaning.records === 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <SprayCan className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="flex-1">
            <strong>Nobody has logged a cleaning checklist yet.</strong>{" "}
            The cleaning course reads your own daily, weekly and deep-clean logs under
            HACCP \— how much of each list was actually ticked, and how long ago. The
            course still runs, and an empty log becomes its own lesson.
          </div>
        </div>
      )}

      {courses.some((c: any) => c.usesDeliveries) && deliveries.records === 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <Truck className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="flex-1">
            <strong>No delivery checks logged yet.</strong>{" "}
            The deliveries course reads your own goods-in log under HACCP — who
            delivered, what arrived, and the temperature it arrived at. The course runs
            either way, and an empty log is its own lesson: nothing to show an inspector
            and nothing to answer a recall with.
          </div>
        </div>
      )}

      {courses.some((c: any) => c.usesCustomers) && customers.profiles === 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="flex-1">
            <strong>No guest records yet.</strong>{" "}
            The privacy course reads your own guest list under CRM — how many profiles
            you hold, how many gave consent, and how many carry a free-text note. It
            reads counts only, never a guest&rsquo;s name or note. The course runs
            either way, and an empty list is its own lesson: the safest data is the
            data you never collected.
          </div>
        </div>
      )}

      {courses.some((c: any) => c.usesHaccpLogs) && haccp.logged === 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <ClipboardCheck className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="flex-1">
            <strong>No HACCP checks have been logged yet.</strong>{" "}
            The food safety management system course reads your own log \— how
            recent the newest check is, how many failed, and whether a failure was
            ever followed by a corrective action. It reads readings and unit names
            only, never who logged a check. The course runs either way, and an
            empty log is its own lesson: a documented system nobody writes in
            proves nothing.
          </div>
        </div>
      )}

      {courses.some((c: any) => c.usesShifts) && shifts.total === 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <CalendarClock className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="flex-1">
            <strong>No shifts on the rota yet.</strong>{" "}
            The working time course reads your own rota and time clock — how long
            shifts run, how much rest sits between them, and whether breaks were
            ever recorded. It reads lengths and gaps only, never who was on. The
            course runs either way, and an empty rota is its own lesson: nothing
            here can show what anybody actually worked.
          </div>
        </div>
      )}

      {courses.some((c: any) => c.usesShifts) &&
        shifts.total > 0 &&
        shifts.breaksRecorded === 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <CalendarClock className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="flex-1">
            <strong>No breaks have ever been recorded on the clock.</strong>{" "}
            Staff are clocking in, but nobody has used On break / End break, so
            there is no record that a break was taken — and in most places the
            employer, not the employee, is the one asked to produce that record.
            The working time course teaches this against your own numbers.
          </div>
        </div>
      )}

      {courses.length === 0 && (
        <Card><CardContent className="py-10 text-center text-slate-500">
          No courses available yet.
        </CardContent></Card>
      )}

      {courses.map((c: any) => {
        const s = STATUS[c.mine?.status] ?? STATUS.NOT_STARTED;
        const done = c.mine?.status === "VALID";
        const req = assigned[c.slug];
        return (
          <Card key={c.slug} className="overflow-hidden">
            <CardContent className="p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex gap-3">
                  <div className="h-10 w-10 shrink-0 rounded-lg bg-orange-100 flex items-center justify-center">
                    <GraduationCap className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-slate-900">{c.title}</h3>
                      <Badge variant="outline" className={cn("text-xs", s.cls)}>{s.label}</Badge>
                      {req && !done && (
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs",
                            req.overdue
                              ? "bg-red-100 text-red-700 border-red-200"
                              : "bg-orange-100 text-orange-700 border-orange-200"
                          )}
                        >
                          <ClipboardList className="h-3 w-3 mr-1" />
                          {req.overdue ? "Overdue, was due " : "Required by "}
                          {fmt(req.dueDate)}
                        </Badge>
                      )}
                      {c.usesMenu && (
                        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                          Uses your menu
                        </Badge>
                      )}
                      {c.usesAssets && (
                        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                          Uses your equipment
                        </Badge>
                      )}
                      {c.usesStock && (
                        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                          Uses your stock list
                        </Badge>
                      )}
                      {c.usesHaccp && (
                        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                          Uses your HACCP units
                        </Badge>
                      )}
                      {c.usesCleaning && (
                        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                          Uses your cleaning records
                        </Badge>
                      )}
                      {c.usesCustomers && (
                        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                          Uses your guest records
                        </Badge>
                      )}
                      {c.usesHaccpLogs && (
                        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                          Uses your HACCP log
                        </Badge>
                      )}
                      {c.usesShifts && (
                        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                          Uses your rota
                        </Badge>
                      )}
                      {c.usesDeliveries && (
                        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                          Uses your delivery records
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-slate-600 max-w-2xl">{c.summary}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" /> about {c.minutes} min
                      </span>
                      <span>Pass mark {c.passMark}%</span>
                      <span>Valid {c.validMonths} months</span>
                      {c.mine?.completedAt && (
                        <span className="flex items-center gap-1 text-slate-600">
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                          You passed {fmt(c.mine.completedAt)} ({c.mine.score}) — renew by{" "}
                          {fmt(c.mine.expiresAt)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    onClick={() => router.push(`/training/course?slug=${c.slug}`)}
                    variant={done ? "outline" : "default"}
                  >
                    {done ? <RotateCcw className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                    {done ? "Take again" : c.mine?.status === "EXPIRED" ? "Retrain" : "Start course"}
                  </Button>
                </div>
              </div>

              {c.roster && (
                <div className="mt-4 border-t border-slate-100 pt-3">
                  <button
                    onClick={() => setOpenRoster(openRoster === c.slug ? null : c.slug)}
                    className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
                  >
                    <Users className="h-4 w-4" />
                    Team: {c.rosterDone} of {c.rosterTotal} up to date
                    <ChevronRight
                      className={cn("h-4 w-4 transition-transform", openRoster === c.slug && "rotate-90")}
                    />
                  </button>

                  {openRoster === c.slug && (
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                            <th className="py-2 pr-4 font-medium">Name</th>
                            <th className="py-2 pr-4 font-medium">Status</th>
                            <th className="py-2 pr-4 font-medium">Completed</th>
                            <th className="py-2 pr-4 font-medium">Score</th>
                            <th className="py-2 font-medium">Renew by</th>
                          </tr>
                        </thead>
                        <tbody>
                          {c.roster.map((r: any) => {
                            const rs = STATUS[r.status] ?? STATUS.NOT_STARTED;
                            return (
                              <tr key={r.employeeId} className="border-t border-slate-100">
                                <td className="py-2 pr-4 text-slate-800">{r.name}</td>
                                <td className="py-2 pr-4">
                                  <Badge variant="outline" className={cn("text-xs", rs.cls)}>
                                    {r.status === "EXPIRED" && (
                                      <AlertTriangle className="h-3 w-3 mr-1" />
                                    )}
                                    {rs.label}
                                  </Badge>
                                </td>
                                <td className="py-2 pr-4 text-slate-600">{fmt(r.completedAt)}</td>
                                <td className="py-2 pr-4 text-slate-600">{r.score ?? "—"}</td>
                                <td className="py-2 text-slate-600">{fmt(r.expiresAt)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      <p className="mt-3 text-xs text-slate-400">
                        A pass files a 12-month certificate against the employee, so the
                        existing expiry reminders chase the retrain automatically.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
