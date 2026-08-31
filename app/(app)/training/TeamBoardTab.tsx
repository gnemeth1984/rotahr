// @ts-nocheck
"use client";

/**
 * Team training board.
 *
 * Eight in-house courses across a full roster is a management problem, and up
 * to now the only view of it was one profile at a time. This is the whole grid:
 * every member of staff against every course, plus the list of who to chase
 * first.
 *
 * It reads /api/training/courses, which already returns a per-course roster to
 * anyone holding the "training" permission — so there is no new endpoint and no
 * second source of truth for a status. The grid is that same data inverted from
 * course-major to person-major.
 *
 * These are in-house records, not accredited qualifications. The copy here must
 * never imply otherwise.
 */

import { useEffect, useMemo, useState } from "react";
import {
  Users, Loader2, CheckCircle2, Clock, RotateCcw, Minus, Download,
  Search, AlertTriangle, ChevronDown, ChevronUp,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const CELL = {
  VALID: {
    label: "Up to date",
    icon: CheckCircle2,
    cell: "bg-green-50 text-green-700 border-green-200",
    dot: "bg-green-500",
  },
  EXPIRING_SOON: {
    label: "Due soon",
    icon: Clock,
    cell: "bg-amber-50 text-amber-700 border-amber-200",
    dot: "bg-amber-500",
  },
  EXPIRED: {
    label: "Retrain due",
    icon: RotateCcw,
    cell: "bg-red-50 text-red-700 border-red-200",
    dot: "bg-red-500",
  },
  NOT_STARTED: {
    label: "Never done",
    icon: Minus,
    cell: "bg-slate-50 text-slate-400 border-slate-200",
    dot: "bg-slate-300",
  },
};

// Chase order: an expired record is worse than one that has never existed,
// because it means the venue had cover and let it lapse.
const URGENCY = { EXPIRED: 0, EXPIRING_SOON: 1, NOT_STARTED: 2, VALID: 3 };

function fmt(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IE", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function daysUntil(d) {
  if (!d) return null;
  return Math.round((new Date(d).getTime() - Date.now()) / 86400000);
}

export default function TeamBoardTab({ onOpenCourses }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [courseFilter, setCourseFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sort, setSort] = useState("ATTENTION");
  const [showAllChase, setShowAllChase] = useState(false);

  useEffect(() => {
    fetch("/api/training/courses")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const courses = data?.courses ?? [];

  /** Invert course-major roster data into one row per person. */
  const people = useMemo(() => {
    const map = new Map();
    for (const c of courses) {
      for (const r of c.roster ?? []) {
        let p = map.get(r.employeeId);
        if (!p) {
          p = { id: r.employeeId, name: r.name, cells: {}, counts: {} };
          map.set(r.employeeId, p);
        }
        p.cells[c.slug] = r;
        p.counts[r.status] = (p.counts[r.status] ?? 0) + 1;
      }
    }
    return [...map.values()];
  }, [courses]);

  /** Every cell that needs somebody to act, worst first. */
  const chase = useMemo(() => {
    const out = [];
    for (const c of courses) {
      for (const r of c.roster ?? []) {
        if (r.status === "VALID") continue;
        out.push({
          employeeId: r.employeeId,
          name: r.name,
          slug: c.slug,
          course: c.title,
          status: r.status,
          expiresAt: r.expiresAt,
          completedAt: r.completedAt,
        });
      }
    }
    out.sort((a, b) => {
      const u = URGENCY[a.status] - URGENCY[b.status];
      if (u !== 0) return u;
      const ad = a.expiresAt ? new Date(a.expiresAt).getTime() : Infinity;
      const bd = b.expiresAt ? new Date(b.expiresAt).getTime() : Infinity;
      if (ad !== bd) return ad - bd;
      return a.name.localeCompare(b.name);
    });
    return out;
  }, [courses]);

  const totals = useMemo(() => {
    const t = { VALID: 0, EXPIRING_SOON: 0, EXPIRED: 0, NOT_STARTED: 0, cells: 0 };
    for (const p of people) {
      for (const c of courses) {
        const cell = p.cells[c.slug];
        if (!cell) continue;
        t[cell.status] = (t[cell.status] ?? 0) + 1;
        t.cells += 1;
      }
    }
    return t;
  }, [people, courses]);

  const shownCourses = courseFilter === "ALL"
    ? courses
    : courses.filter((c) => c.slug === courseFilter);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = people.filter((p) => !needle || p.name.toLowerCase().includes(needle));

    if (statusFilter !== "ALL") {
      list = list.filter((p) =>
        shownCourses.some((c) => p.cells[c.slug]?.status === statusFilter)
      );
    }

    const gaps = (p) =>
      shownCourses.reduce(
        (n, c) => n + (p.cells[c.slug] && p.cells[c.slug].status !== "VALID" ? 1 : 0),
        0
      );
    const worst = (p) =>
      Math.min(
        ...shownCourses.map((c) => URGENCY[p.cells[c.slug]?.status ?? "NOT_STARTED"]),
        3
      );

    const sorted = [...list];
    if (sort === "NAME") {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sort === "DONE") {
      sorted.sort((a, b) => gaps(a) - gaps(b) || a.name.localeCompare(b.name));
    } else {
      sorted.sort(
        (a, b) => worst(a) - worst(b) || gaps(b) - gaps(a) || a.name.localeCompare(b.name)
      );
    }
    return sorted;
  }, [people, q, statusFilter, sort, shownCourses]);

  function exportCsv() {
    const head = ["Staff member", ...courses.map((c) => c.title)];
    const lines = [head];
    for (const p of rows) {
      lines.push([
        p.name,
        ...courses.map((c) => {
          const cell = p.cells[c.slug];
          if (!cell || cell.status === "NOT_STARTED") return "Never done";
          const label = CELL[cell.status]?.label ?? cell.status;
          return `${label} — completed ${fmt(cell.completedAt)}, expires ${fmt(cell.expiresAt)}${
            cell.score ? `, ${cell.score}` : ""
          }`;
        }),
      ]);
    }
    lines.push([]);
    lines.push([
      "In-house training delivered by the employer. Not an accredited qualification.",
    ]);
    const csv = lines
      .map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `in-house-training-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!data?.canSeeRoster) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-slate-500">
          <Users className="h-8 w-8 mx-auto mb-3 text-slate-300" />
          The team board shows everybody&rsquo;s training status, so it needs the training
          permission. Your own courses are on the Courses tab.
        </CardContent>
      </Card>
    );
  }

  if (people.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-slate-500">
          <Users className="h-8 w-8 mx-auto mb-3 text-slate-300" />
          No active staff yet. Add your team under Employees and their training status
          appears here.
        </CardContent>
      </Card>
    );
  }

  const coverage = totals.cells
    ? Math.round((totals.VALID / totals.cells) * 100)
    : 0;
  const chaseShown = showAllChase ? chase : chase.slice(0, 8);

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        <strong className="text-slate-800">
          {people.length} staff × {courses.length} in-house courses.
        </strong>{" "}
        Every cell below is a dated record signed by the trainee. These are
        employer-delivered records, not accredited qualifications — where a licence or an
        accredited certificate is required, you still need an approved provider.
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-slate-900">{coverage}%</div>
            <div className="text-xs text-slate-500 mt-0.5">Roster covered</div>
          </CardContent>
        </Card>
        {(["VALID", "EXPIRING_SOON", "EXPIRED", "NOT_STARTED"]).map((k) => {
          const meta = CELL[k];
          return (
            <Card key={k}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <span className={cn("h-2 w-2 rounded-full", meta.dot)} />
                  <span className="text-2xl font-bold text-slate-900">{totals[k] ?? 0}</span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">{meta.label}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {chase.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <h3 className="font-semibold text-slate-900">Who to chase first</h3>
              <Badge variant="outline" className="text-xs bg-slate-100 text-slate-600 border-slate-200">
                {chase.length}
              </Badge>
            </div>
            <div className="divide-y divide-slate-100">
              {chaseShown.map((r) => {
                const meta = CELL[r.status];
                const days = daysUntil(r.expiresAt);
                return (
                  <div
                    key={`${r.employeeId}:${r.slug}`}
                    className="flex flex-wrap items-center gap-2 py-2 text-sm"
                  >
                    <span className={cn("h-2 w-2 rounded-full shrink-0", meta.dot)} />
                    <span className="font-medium text-slate-800">{r.name}</span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-600">{r.course}</span>
                    <Badge variant="outline" className={cn("text-xs ml-auto", meta.cell)}>
                      {r.status === "EXPIRED" && days !== null
                        ? `Lapsed ${Math.abs(days)} days ago`
                        : r.status === "EXPIRING_SOON" && days !== null
                          ? `Due in ${Math.max(days, 0)} days`
                          : meta.label}
                    </Badge>
                  </div>
                );
              })}
            </div>
            {chase.length > 8 && (
              <button
                onClick={() => setShowAllChase((v) => !v)}
                className="mt-3 flex items-center gap-1 text-sm font-medium text-orange-600 hover:text-orange-700"
              >
                {showAllChase ? (
                  <>Show less <ChevronUp className="h-4 w-4" /></>
                ) : (
                  <>Show all {chase.length} <ChevronDown className="h-4 w-4" /></>
                )}
              </button>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search staff"
            className="pl-9"
          />
        </div>
        <Select value={courseFilter} onValueChange={setCourseFilter}>
          <SelectTrigger className="w-full sm:w-[220px]">
            <SelectValue placeholder="All courses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All courses</SelectItem>
            {courses.map((c) => (
              <SelectItem key={c.slug} value={c.slug}>{c.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[170px]">
            <SelectValue placeholder="Any status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Any status</SelectItem>
            <SelectItem value="EXPIRED">Retrain due</SelectItem>
            <SelectItem value="EXPIRING_SOON">Due soon</SelectItem>
            <SelectItem value="NOT_STARTED">Never done</SelectItem>
            <SelectItem value="VALID">Up to date</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ATTENTION">Needs attention</SelectItem>
            <SelectItem value="NAME">Name A–Z</SelectItem>
            <SelectItem value="DONE">Most complete</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={exportCsv} className="shrink-0">
          <Download className="h-4 w-4 mr-2" />
          CSV
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="sticky left-0 z-10 bg-slate-50 text-left font-semibold text-slate-700 px-4 py-3 min-w-[170px]">
                  Staff member
                </th>
                {shownCourses.map((c) => (
                  <th
                    key={c.slug}
                    className="px-3 py-3 text-left font-semibold text-slate-700 align-bottom min-w-[130px]"
                  >
                    <div className="leading-tight">{c.title}</div>
                    <div className="text-xs font-normal text-slate-400 mt-1">
                      {c.rosterDone ?? 0}/{c.rosterTotal ?? people.length} up to date
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const gaps = shownCourses.filter(
                  (c) => p.cells[c.slug] && p.cells[c.slug].status !== "VALID"
                ).length;
                return (
                  <tr key={p.id} className="border-b border-slate-100 last:border-0">
                    <td className="sticky left-0 z-10 bg-white px-4 py-3 align-top">
                      <div className="font-medium text-slate-900">{p.name}</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {gaps === 0
                          ? "All courses up to date"
                          : `${gaps} of ${shownCourses.length} outstanding`}
                      </div>
                    </td>
                    {shownCourses.map((c) => {
                      const cell = p.cells[c.slug];
                      const meta = CELL[cell?.status ?? "NOT_STARTED"];
                      const Icon = meta.icon;
                      return (
                        <td key={c.slug} className="px-3 py-3 align-top">
                          <div
                            className={cn(
                              "rounded-md border px-2 py-1.5 text-xs",
                              meta.cell
                            )}
                            title={
                              cell?.completedAt
                                ? `Completed ${fmt(cell.completedAt)}${
                                    cell.score ? ` · ${cell.score}` : ""
                                  } · expires ${fmt(cell.expiresAt)}`
                                : "No record"
                            }
                          >
                            <div className="flex items-center gap-1.5 font-medium">
                              <Icon className="h-3.5 w-3.5 shrink-0" />
                              {meta.label}
                            </div>
                            {cell?.completedAt && (
                              <div className="mt-0.5 opacity-80">
                                exp. {fmt(cell.expiresAt)}
                              </div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={shownCourses.length + 1}
                    className="px-4 py-10 text-center text-slate-500"
                  >
                    Nobody matches those filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="text-xs text-slate-500">
        Records expire 12 months after the pass — an employer refresher interval Rotahr
        sets, not a regulatory cycle. The existing certificate-expiry reminders chase
        these the same way they chase an accredited certificate.
        {onOpenCourses && (
          <button
            onClick={onOpenCourses}
            className="ml-1 font-medium text-orange-600 underline hover:text-orange-700"
          >
            Open the courses
          </button>
        )}
      </div>
    </div>
  );
}
