import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * Activation progress for a business: the three things a new venue has to do
 * before Rotahr is actually running their week.
 *
 *   1. add staff          — at least one active employee who is not the owner
 *   2. publish a rota     — at least one published shift
 *   3. invite the team    — at least one of those staff has a login
 *
 * Everything is derived from existing tables, so there is no schema change and
 * the numbers are right for every business that already exists, not only for
 * signups from today on.
 *
 * The owner is excluded from the staff count on purpose. Plenty of owners add
 * themselves as an employee first (they work shifts too), and counting that row
 * would tick "add your staff" for a venue that has not added anyone.
 */

export type ActivationStepKey = "staff" | "rota" | "invite";

export interface ActivationStep {
  key: ActivationStepKey;
  done: boolean;
  /** When the step was first completed, if it was. */
  doneAt: string | null;
}

export interface ActivationProgress {
  businessId: string;
  ownerUserId: string | null;
  ownerEmail: string | null;
  ownerName: string | null;
  staffCount: number;
  /** Shifts that exist at all, published or not — a drafted rota still counts as progress. */
  shiftCount: number;
  publishedShiftCount: number;
  invitedCount: number;
  joinedCount: number;
  /** Staff with no login yet and an address an invite can go to. */
  awaitingInvite: number;
  steps: ActivationStep[];
  completed: number;
  allDone: boolean;
}

const MANAGER_ROLES = new Set(["MANAGER", "ADMIN"]);

function iso(d: Date | null | undefined): string | null {
  return d ? new Date(d).toISOString() : null;
}

function minDate(a: Date | null, b: Date | null): Date | null {
  if (!a) return b;
  if (!b) return a;
  return a < b ? a : b;
}

/** Same rule as lib/email/send isUnroutableAddress, kept local to avoid the Resend import. */
function routable(email: string | null | undefined): boolean {
  if (!email) return false;
  const domain = email.trim().toLowerCase().split("@")[1];
  if (!domain) return false;
  const tld = domain.split(".").pop() ?? "";
  if (["demo", "test", "example", "invalid", "localhost", "local", "internal"].includes(tld)) return false;
  return !["example.com", "example.org", "example.net"].includes(domain);
}

/**
 * Progress for many businesses in a fixed number of queries (no N+1), so the
 * admin funnel and the lifecycle planner can use the same definition as the
 * checklist a manager sees.
 */
export async function getActivationMany(businessIds: string[]): Promise<Map<string, ActivationProgress>> {
  const out = new Map<string, ActivationProgress>();
  const ids = [...new Set(businessIds.filter(Boolean))];
  if (ids.length === 0) return out;

  const [users, employees, shiftRows, publishLogs] = await Promise.all([
    prisma.user.findMany({
      where: { businessId: { in: ids } },
      select: { id: true, businessId: true, email: true, name: true, role: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.employee.findMany({
      where: { businessId: { in: ids } },
      select: {
        id: true,
        businessId: true,
        email: true,
        userId: true,
        active: true,
        createdAt: true,
        user: { select: { password: true, lastLoginAt: true, createdAt: true } },
      },
    }),
    // Shift has no businessId column; it belongs to a business through its employee.
    prisma.$queryRaw<
      { businessId: string; total: number; published: number; firstPublished: Date | null }[]
    >(Prisma.sql`
      SELECT e."businessId" AS "businessId",
             COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE s.published)::int AS published,
             MIN(s."updatedAt") FILTER (WHERE s.published) AS "firstPublished"
      FROM "Shift" s
      JOIN "Employee" e ON e.id = s."employeeId"
      WHERE e."businessId" IN (${Prisma.join(ids)})
      GROUP BY e."businessId"
    `),
    // The publish action is logged with a timestamp, which is more accurate than
    // a shift's updatedAt (any later edit moves that).
    prisma.activityLog.groupBy({
      by: ["businessId"],
      where: { businessId: { in: ids }, action: "shift_published" },
      _min: { createdAt: true },
    }),
  ]);

  const ownerBy = new Map<string, (typeof users)[number]>();
  for (const u of users) {
    if (!u.businessId) continue;
    const cur = ownerBy.get(u.businessId);
    // Earliest manager/admin is the owner; fall back to the earliest user at all.
    if (!cur || (!MANAGER_ROLES.has(cur.role) && MANAGER_ROLES.has(u.role))) ownerBy.set(u.businessId, u);
  }
  const shiftsBy = new Map(shiftRows.map((r) => [r.businessId, r]));
  const logBy = new Map(publishLogs.map((r) => [r.businessId as string, r._min.createdAt]));

  for (const id of ids) {
    const owner = ownerBy.get(id) ?? null;
    const ownerEmail = owner?.email?.toLowerCase() ?? null;
    const staff = employees.filter(
      (e) =>
        e.businessId === id &&
        e.active &&
        !(owner && e.userId === owner.id) &&
        !(ownerEmail && e.email?.toLowerCase() === ownerEmail),
    );

    let firstStaff: Date | null = null;
    let firstInvite: Date | null = null;
    let invited = 0;
    let joined = 0;
    let awaiting = 0;
    for (const e of staff) {
      firstStaff = minDate(firstStaff, e.createdAt);
      if (e.userId) {
        invited++;
        firstInvite = minDate(firstInvite, e.user?.createdAt ?? null);
        if (e.user?.password || e.user?.lastLoginAt) joined++;
      } else if (routable(e.email)) {
        awaiting++;
      }
    }

    const sh = shiftsBy.get(id);
    const published = sh?.published ?? 0;
    const firstPublished = published > 0 ? (logBy.get(id) ?? sh?.firstPublished ?? null) : null;

    const steps: ActivationStep[] = [
      { key: "staff", done: staff.length > 0, doneAt: iso(firstStaff) },
      { key: "rota", done: published > 0, doneAt: iso(firstPublished) },
      { key: "invite", done: invited > 0, doneAt: iso(firstInvite) },
    ];
    const completed = steps.filter((s) => s.done).length;

    out.set(id, {
      businessId: id,
      ownerUserId: owner?.id ?? null,
      ownerEmail,
      ownerName: owner?.name ?? null,
      staffCount: staff.length,
      shiftCount: sh?.total ?? 0,
      publishedShiftCount: published,
      invitedCount: invited,
      joinedCount: joined,
      awaitingInvite: awaiting,
      steps,
      completed,
      allDone: completed === steps.length,
    });
  }
  return out;
}

export async function getActivation(businessId: string): Promise<ActivationProgress | null> {
  const m = await getActivationMany([businessId]);
  return m.get(businessId) ?? null;
}
