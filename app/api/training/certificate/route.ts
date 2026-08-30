// @ts-nocheck
export const dynamic = "force-dynamic";

/**
 * GET /api/training/certificate?id=<courseCompletionId>
 *
 * Returns everything needed to print the record of a passed course. The sheet
 * itself is built in the browser (lib/training/certificate.ts) — this route only
 * hands over the facts, so the document can never contain anything that was not
 * actually filed.
 *
 * Who can fetch it: the person the record belongs to, or anybody with the
 * "training" permission (managers and admins always). A trainee can print their
 * own record without needing a manager, which is the whole point of a course
 * they took themselves.
 *
 * Only passed attempts return a sheet. A failed attempt is still evidence and
 * still stored, but there is no such thing as a certificate for it.
 *
 * The syllabus lines are rebuilt from the venue-data snapshot stored on the
 * completion, not from today's menu or equipment list. If a dish was removed or
 * a fridge was retired since, the printed record still describes the course the
 * person actually sat.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requirePermission, isResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db";
import { getCourse, lessonsFor } from "@/lib/training/courses";

function addMonths(d: Date, months: number): Date {
  const out = new Date(d);
  out.setMonth(out.getMonth() + months);
  return out;
}

export async function GET(req: NextRequest) {
  const session = await requireAuth();
  if (isResponse(session)) return session;

  const businessId = session.user.businessId;
  if (!businessId) return NextResponse.json({ error: "No business" }, { status: 400 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const completion = await prisma.courseCompletion.findFirst({
    where: { id, businessId },
    select: {
      id: true,
      courseSlug: true,
      courseTitle: true,
      score: true,
      total: true,
      passMark: true,
      passed: true,
      signedName: true,
      menuSnapshot: true,
      certificationId: true,
      completedAt: true,
      employee: {
        select: { id: true, firstName: true, lastName: true, userId: true },
      },
    },
  });

  if (!completion) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOwnRecord =
    Boolean(completion.employee?.userId) && completion.employee.userId === session.user.id;
  if (!isOwnRecord) {
    const perm = await requirePermission("training");
    if (isResponse(perm)) return perm;
  }

  if (!completion.passed) {
    return NextResponse.json(
      { error: "That attempt was not passed, so there is no record to print." },
      { status: 400 }
    );
  }

  const course = getCourse(completion.courseSlug);

  const [business, cert] = await Promise.all([
    prisma.business.findUnique({ where: { id: businessId }, select: { name: true } }),
    completion.certificationId
      ? prisma.trainingCertification.findUnique({
          where: { id: completion.certificationId },
          select: { expiryDate: true, title: true },
        })
      : Promise.resolve(null),
  ]);

  // Rebuild the lesson titles from the snapshot of the venue data the course was
  // generated from at the time. Which array it belongs in is decided by the
  // course flags, exactly as the submit route decided where to store it.
  let topics: string[] = [];
  if (course) {
    const snapshot = Array.isArray(completion.menuSnapshot) ? completion.menuSnapshot : [];
    try {
      topics = lessonsFor(course.slug, {
        dishes: course.usesMenu ? snapshot : [],
        assets: course.usesAssets ? snapshot : [],
        stock: course.usesStock ? snapshot : [],
        haccp: course.usesHaccp ? snapshot : [],
        haccpChecks: [],
      }).map((l) => l.title);
    } catch {
      topics = [];
    }
  }

  const expiresAt =
    cert?.expiryDate ??
    (course ? addMonths(new Date(completion.completedAt), course.validMonths) : null);

  const traineeName = completion.employee
    ? `${completion.employee.firstName} ${completion.employee.lastName}`.trim()
    : completion.signedName;

  return NextResponse.json({
    certificate: {
      completionId: completion.id,
      businessName: business?.name ?? "This venue",
      traineeName,
      signedName: completion.signedName,
      courseTitle: completion.courseTitle,
      certTitle: cert?.title ?? course?.certTitle ?? completion.courseTitle,
      score: completion.score,
      total: completion.total,
      passMark: completion.passMark,
      completedAt: completion.completedAt,
      expiresAt,
      minutes: course?.minutes ?? 20,
      topics,
    },
  });
}
