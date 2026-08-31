// @ts-nocheck
/**
 * Daily cron: chase assigned in-house courses.
 *
 * A manager can make a course required for the whole venue, a department, a
 * role or one named person, with a due date (see /api/training/assignments).
 * Setting a due date is worthless on its own — somebody has to be reminded.
 * This is the chasing half.
 *
 * Who gets nudged:
 *   - the member of staff, at 14 / 7 / 3 / 1 days before the due date, on the
 *     due day itself, and then every 7 days while it stays outstanding;
 *   - their managers, but only once the assignment is overdue, and as one
 *     summary per assignment rather than one per person.
 *
 * Anyone holding a current pass is skipped entirely. "Current" means VALID —
 * an expired or expiring record still counts as outstanding, because the point
 * of an assignment is that the venue can prove the training is in date.
 *
 * Everything resolves through lib/training/assignments.ts, the same file the
 * API route uses, so a nudge can never disagree with what the screen shows.
 */
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendPushToUser } from "@/lib/services/push.service";
import { wrapCron } from "@/lib/cron-run";
import {
  loadEmployees,
  latestPassMap,
  resolveAssignment,
  startOfDay,
} from "@/lib/training/assignments";

/** Days before the due date on which staff get a reminder. */
const STAGES = [14, 7, 3, 1];

/**
 * Should today produce a staff nudge?
 * Before the due date: only on a stage day. On the day: yes. After: weekly, so
 * an ignored course keeps asking without becoming daily noise.
 */
function isNudgeDay(daysUntilDue: number): boolean {
  if (daysUntilDue > 0) return STAGES.includes(daysUntilDue);
  if (daysUntilDue === 0) return true;
  return -daysUntilDue % 7 === 0;
}

/**
 * One AppNotification row, written directly rather than through
 * createNotification, because that helper drops referenceId and referenceId is
 * exactly what stops this cron sending the same nudge twice in a day.
 */
async function notifyOnce(opts: {
  userId: string;
  referenceId: string;
  title: string;
  body: string;
  link: string;
  today: Date;
}) {
  const existing = await prisma.appNotification.findFirst({
    where: {
      userId: opts.userId,
      type: "course_due",
      referenceId: opts.referenceId,
      createdAt: { gte: opts.today },
    },
    select: { id: true },
  });
  if (existing) return false;

  await prisma.appNotification.create({
    data: {
      userId: opts.userId,
      type: "course_due",
      title: opts.title,
      body: opts.body,
      link: opts.link,
      referenceId: opts.referenceId,
    },
  });

  sendPushToUser(opts.userId, opts.title, opts.body, {
    type: "course_due",
    link: opts.link,
  }).catch(() => {});

  return true;
}

function dueLabel(due: Date) {
  return due.toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" });
}

async function __cronHandler(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const today = startOfDay(now);

  const assignments = await prisma.courseAssignment.findMany({
    where: { active: true },
    orderBy: { dueDate: "asc" },
  });

  if (assignments.length === 0) {
    return NextResponse.json({ assignments: 0, staffNudges: 0, managerNudges: 0 });
  }

  // One employee load and one completion load per business, not per assignment.
  const businessIds = Array.from(new Set(assignments.map((a) => a.businessId)));
  const employeesByBiz = new Map<string, any[]>();
  const latestByBiz = new Map<string, Map<string, any>>();
  for (const businessId of businessIds) {
    employeesByBiz.set(businessId, await loadEmployees(businessId));
    latestByBiz.set(businessId, await latestPassMap(businessId));
  }

  let staffNudges = 0;
  let managerNudges = 0;
  let considered = 0;

  for (const a of assignments) {
    const employees = employeesByBiz.get(a.businessId) || [];
    const latest = latestByBiz.get(a.businessId) || new Map();
    const r = resolveAssignment(a, employees, latest, now);

    // An assignment nobody matches any more (department emptied, role renamed,
    // person left) is silently inert rather than an error.
    if (r.total === 0) continue;

    const outstanding = r.targets.filter((t) => t.status !== "VALID");
    if (outstanding.length === 0) continue;

    considered++;

    const due = dueLabel(a.dueDate);
    const overdueDays = -r.daysUntilDue;

    if (isNudgeDay(r.daysUntilDue)) {
      for (const t of outstanding) {
        // No linked user account means no way to reach them in the app. Their
        // manager still sees it on the assignments tab.
        if (!t.userId) continue;

        const title = r.overdue
          ? `Overdue: ${r.courseTitle}`
          : r.daysUntilDue === 0
            ? `Due today: ${r.courseTitle}`
            : `${r.courseTitle} due in ${r.daysUntilDue} day${r.daysUntilDue === 1 ? "" : "s"}`;

        const reason =
          t.status === "EXPIRED"
            ? "Your previous record has expired, so it needs doing again."
            : t.status === "EXPIRING_SOON"
              ? "Your current record is about to expire, so it needs doing again."
              : "You have not completed it yet.";

        const body = r.overdue
          ? `This was due on ${due}. ${reason} It takes about ${
              r.validMonths ? "" : ""
            }a few minutes in Training.`.replace("  ", " ")
          : `Due by ${due}. ${reason}`;

        const sent = await notifyOnce({
          userId: t.userId,
          referenceId: `${a.id}:${t.employeeId}`,
          title,
          body,
          link: `/training?tab=courses`,
          today,
        });
        if (sent) staffNudges++;
      }
    }

    // Managers are told once the date has passed, and only then. Before the due
    // date this is the employee's business; after it, it is the venue's problem.
    if (r.overdue) {
      const managers = await prisma.user.findMany({
        where: { businessId: a.businessId, role: { in: ["MANAGER", "ADMIN"] } },
        select: { id: true },
      });

      const names = outstanding.map((t) => t.name);
      const shown = names.slice(0, 4).join(", ");
      const extra = names.length > 4 ? ` and ${names.length - 4} more` : "";

      const title = `${outstanding.length} still to do ${r.courseTitle}`;
      const body = `Due on ${due}${
        overdueDays > 0 ? `, ${overdueDays} day${overdueDays === 1 ? "" : "s"} ago` : ""
      }. Outstanding: ${shown}${extra}.`;

      for (const m of managers) {
        const sent = await notifyOnce({
          userId: m.id,
          referenceId: `${a.id}:manager`,
          title,
          body,
          link: `/training?tab=assignments`,
          today,
        });
        if (sent) managerNudges++;
      }
    }
  }

  return NextResponse.json({
    assignments: assignments.length,
    outstanding: considered,
    staffNudges,
    managerNudges,
  });
}

export const GET = wrapCron("course-assignments", __cronHandler as any);
