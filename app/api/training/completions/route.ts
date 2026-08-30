// @ts-nocheck
export const dynamic = "force-dynamic";

/**
 * GET /api/training/completions?employeeId=<id>
 *
 * Every in-house course attempt filed against one person, newest first — passes
 * and failures both. A failed attempt is not an embarrassment to hide; it is
 * part of the honest picture of what training somebody has actually had, and a
 * pass straight after a fail is better evidence than a single clean pass.
 *
 * Who can read it: the person themselves, or anybody with the "training"
 * permission (managers and admins always).
 *
 * Practice runs never reach this list because they are never written — see the
 * submit route.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requirePermission, isResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db";
import { getCourse } from "@/lib/training/courses";

function addMonths(d: Date, months: number): Date {
  const out = new Date(d);
  out.setMonth(out.getMonth() + months);
  return out;
}

export async function GET(req: NextRequest) {
  const session = await requireAuth();
  if (isResponse(session)) return session;

  const businessId = session.user.businessId;
  if (!businessId) return NextResponse.json({ completions: [] });

  const employeeId = req.nextUrl.searchParams.get("employeeId");
  if (!employeeId) return NextResponse.json({ error: "Missing employeeId" }, { status: 400 });

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, businessId },
    select: { id: true, userId: true },
  });
  if (!employee) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isSelf = Boolean(employee.userId) && employee.userId === session.user.id;
  if (!isSelf) {
    const perm = await requirePermission("training");
    if (isResponse(perm)) return perm;
  }

  const rows = await prisma.courseCompletion.findMany({
    where: { businessId, employeeId },
    select: {
      id: true,
      courseSlug: true,
      courseTitle: true,
      score: true,
      total: true,
      passMark: true,
      passed: true,
      signedName: true,
      certificationId: true,
      startedAt: true,
      completedAt: true,
    },
    orderBy: { completedAt: "desc" },
    take: 60,
  });

  // The latest pass per course is the one that counts for currency; older passes
  // stay in the list as history but are not what a manager should read the
  // expiry off. Marked here so the UI does not have to work it out.
  const seenPass = new Set<string>();

  const completions = rows.map((r) => {
    const course = getCourse(r.courseSlug);
    const validMonths = course?.validMonths ?? 12;
    const expiresAt = r.passed ? addMonths(new Date(r.completedAt), validMonths) : null;
    const isCurrent = r.passed && !seenPass.has(r.courseSlug);
    if (r.passed) seenPass.add(r.courseSlug);

    let status: "PASSED" | "NOT_PASSED" | "VALID" | "EXPIRING_SOON" | "EXPIRED" = r.passed
      ? "PASSED"
      : "NOT_PASSED";
    if (isCurrent && expiresAt) {
      const days = (expiresAt.getTime() - Date.now()) / 86400000;
      status = days < 0 ? "EXPIRED" : days <= 30 ? "EXPIRING_SOON" : "VALID";
    }

    // Minutes spent is worth showing: a 25-minute course finished in 90 seconds
    // is a conversation to have, and the timestamps are already stored.
    const minutes = Math.max(
      0,
      Math.round((new Date(r.completedAt).getTime() - new Date(r.startedAt).getTime()) / 60000)
    );

    return {
      id: r.id,
      courseSlug: r.courseSlug,
      courseTitle: r.courseTitle,
      score: r.score,
      total: r.total,
      percent: r.total > 0 ? Math.round((r.score / r.total) * 100) : 0,
      passMark: r.passMark,
      passed: r.passed,
      signedName: r.signedName,
      hasCertificate: Boolean(r.certificationId),
      completedAt: r.completedAt,
      minutesTaken: minutes,
      expiresAt,
      isCurrent,
      status,
    };
  });

  return NextResponse.json({ completions });
}
