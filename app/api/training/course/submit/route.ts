// @ts-nocheck
export const dynamic = "force-dynamic";

/**
 * POST /api/training/course/submit
 *
 * Grades an attempt and files the evidence. The client sends the signed ticket
 * it was issued plus the answers it gave — never the questions and never the
 * correct answers. The server rebuilds the identical paper from the ticket's
 * seed and grades against that.
 *
 * A pass writes a TrainingCertification with a 12-month expiry, which is the
 * whole point of the integration: the existing cert-expiry cron then chases the
 * retrain without needing to know that courses exist at all.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db";
import {
  getCourse,
  toCourseDish,
  toCourseAsset,
  toCourseStock,
  toCourseHaccpUnit,
  toCourseCleaningRecord,
  toCourseCustomer,
  toCourseDelivery,
  buildQuiz,
  grade,
} from "@/lib/training/courses";
import { verifyTicket } from "@/lib/training/quiz-token";
import { logActivity } from "@/lib/services/activity.service";

function addMonths(d: Date, months: number): Date {
  const out = new Date(d);
  out.setMonth(out.getMonth() + months);
  return out;
}

export async function POST(req: NextRequest) {
  const session = await requireAuth();
  if (isResponse(session)) return session;

  const businessId = session.user.businessId;
  if (!businessId) return NextResponse.json({ error: "No business" }, { status: 400 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Bad body" }, { status: 400 });

  const { token, answers, signedName, startedAt } = body;

  const ticket = verifyTicket(token);
  if (!ticket) {
    return NextResponse.json(
      { error: "This quiz has expired or could not be verified. Reload the course and try again." },
      { status: 400 }
    );
  }
  if (ticket.b !== businessId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const course = getCourse(ticket.s);
  if (!course) return NextResponse.json({ error: "Unknown course" }, { status: 404 });

  const name = typeof signedName === "string" ? signedName.trim() : "";
  if (name.length < 3) {
    return NextResponse.json(
      { error: "Type your full name to sign the record." },
      { status: 400 }
    );
  }

  // The employee is taken from the ticket, not from the request body, so a
  // trainee cannot file a record against somebody else.
  //
  // An empty employee id means the ticket was issued in practice mode: the
  // signed-in login has no employee record (an owner who never added themselves
  // to the roster). The attempt is still marked, but nothing is written — no
  // completion, no certificate. Evidence has to belong to a named person.
  const practice = !ticket.e;
  const employee = practice
    ? null
    : await prisma.employee.findFirst({
        where: { id: ticket.e, businessId },
        select: { id: true, firstName: true, lastName: true, userId: true },
      });
  if (!practice) {
    if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    if (employee.userId && employee.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // Rebuild the exact paper. The venue data comes from the ticket's id list in
  // the ticket's order, so an edit made mid-quiz cannot change the paper.
  const dishRows = course.usesMenu
    ? await prisma.dish.findMany({ where: { businessId, id: { in: ticket.m } } })
    : [];
  const byDish = new Map(dishRows.map((d) => [d.id, d]));
  const dishes = course.usesMenu
    ? ticket.m.map((id) => byDish.get(id)).filter(Boolean).map(toCourseDish)
    : [];

  const assetRows = course.usesAssets
    ? await prisma.asset.findMany({ where: { businessId, id: { in: ticket.m } } })
    : [];
  const byAsset = new Map(assetRows.map((a) => [a.id, a]));
  const assets = course.usesAssets
    ? ticket.m.map((id) => byAsset.get(id)).filter(Boolean).map(toCourseAsset)
    : [];

  const stockRows = course.usesStock
    ? await prisma.stockItem.findMany({ where: { businessId, id: { in: ticket.m } } })
    : [];
  const byStock = new Map(stockRows.map((s) => [s.id, s]));
  const stock = course.usesStock
    ? ticket.m.map((id) => byStock.get(id)).filter(Boolean).map(toCourseStock)
    : [];

  const haccpRows = course.usesHaccp
    ? await prisma.hACCPEquipment.findMany({ where: { businessId, id: { in: ticket.m } } })
    : [];
  const byUnit = new Map(haccpRows.map((u) => [u.id, u]));
  const haccp = course.usesHaccp
    ? ticket.m.map((id) => byUnit.get(id)).filter(Boolean).map(toCourseHaccpUnit)
    : [];

  const cleaningRows = course.usesCleaning
    ? await prisma.hACCPRecord.findMany({ where: { businessId, id: { in: ticket.m } } })
    : [];
  const byRecord = new Map(cleaningRows.map((r) => [r.id, r]));
  const cleaning = course.usesCleaning
    ? ticket.m.map((id) => byRecord.get(id)).filter(Boolean).map(toCourseCleaningRecord)
    : [];

  const deliveryRows = course.usesDeliveries
    ? await prisma.hACCPRecord.findMany({ where: { businessId, id: { in: ticket.m } } })
    : [];
  const byDelivery = new Map(deliveryRows.map((r) => [r.id, r]));
  const deliveries = course.usesDeliveries
    ? ticket.m.map((id) => byDelivery.get(id)).filter(Boolean).map(toCourseDelivery)
    : [];

  // Reloaded in ticket order, same as every other course. The privacy
  // questions carry counts in their ids, so ticket order is what keeps the
  // rebuilt paper's ids identical to the paper the trainee answered. A guest
  // profile deleted between GET and POST still shifts the count \— the same
  // accepted risk the other courses carry.
  const customerRows = course.usesCustomers
    ? await prisma.customer.findMany({ where: { businessId, id: { in: ticket.m } } })
    : [];
  const byCustomer = new Map(customerRows.map((r) => [r.id, r]));
  const customers = course.usesCustomers
    ? ticket.m.map((id) => byCustomer.get(id)).filter(Boolean).map(toCourseCustomer)
    : [];

  // haccpChecks and cleaningTemplates are deliberately empty: the check
  // schedule and the venue's edited checklists only ever fed lessons, and
  // lessons are not graded. Anything added here must also be on the ticket.
  const paper = buildQuiz(
    ticket.s,
    {
      dishes,
      assets,
      stock,
      haccp,
      haccpChecks: [],
      cleaning,
      cleaningTemplates: [],
      deliveries,
      customers,
    },
    ticket.d
  );
  if (paper.length === 0) {
    return NextResponse.json({ error: "Could not rebuild the quiz." }, { status: 400 });
  }

  const given: Record<string, number[]> = {};
  if (answers && typeof answers === "object") {
    for (const [k, v] of Object.entries(answers)) {
      if (Array.isArray(v)) {
        given[k] = v.filter((n) => typeof n === "number" && Number.isInteger(n) && n >= 0);
      }
    }
  }

  const result = grade(paper, given);
  const passed = result.percent >= course.passMark;

  const completedAt = new Date();
  let certificationId: string | null = null;

  if (practice) {
    logActivity({
      businessId,
      userId: session.user.id,
      userName: session.user.name,
      action: "course_practice",
      detail: `${course.title} — ${result.score}/${result.total} (${result.percent}%), practice run, not filed`,
    });

    return NextResponse.json({
      completionId: null,
      filed: false,
      passed,
      score: result.score,
      total: result.total,
      percent: result.percent,
      passMark: course.passMark,
      certificationId: null,
      expiresAt: null,
      detail: result.detail,
    });
  }

  if (passed) {
    const cert = await prisma.trainingCertification.create({
      data: {
        businessId,
        employeeId: employee.id,
        title: course.certTitle,
        issuer: "In-house (delivered via Rotahr)",
        category: course.certCategory,
        issuedDate: completedAt,
        expiryDate: addMonths(completedAt, course.validMonths),
        notes:
          `Scored ${result.score}/${result.total} (${result.percent}%), pass mark ${course.passMark}%. ` +
          `Signed by ${name}. In-house training delivered by the employer — not an accredited qualification.`,
      },
      select: { id: true },
    });
    certificationId = cert.id;
  }

  const completion = await prisma.courseCompletion.create({
    data: {
      businessId,
      employeeId: employee.id,
      courseSlug: course.slug,
      courseTitle: course.title,
      score: result.score,
      total: result.total,
      passMark: course.passMark,
      passed,
      signedName: name,
      answers: result.detail,
      // Named for the menu because that came first, but it is the snapshot of
      // whatever venue data the course was built from. Menus and equipment both
      // change; evidence of what somebody was actually taught must not.
      menuSnapshot: course.usesAssets
        ? assets
        : course.usesStock
          ? stock
          : course.usesHaccp
            ? haccp
            : dishes,
      certificationId,
      startedAt: startedAt ? new Date(startedAt) : completedAt,
      completedAt,
    },
    select: { id: true },
  });

  logActivity({
    businessId,
    userId: session.user.id,
    userName: session.user.name,
    action: passed ? "course_passed" : "course_failed",
    detail: `${course.title} — ${result.score}/${result.total} (${result.percent}%)`,
  });

  return NextResponse.json({
    completionId: completion.id,
    filed: true,
    passed,
    score: result.score,
    total: result.total,
    percent: result.percent,
    passMark: course.passMark,
    certificationId,
    expiresAt: passed ? addMonths(completedAt, course.validMonths) : null,
    detail: result.detail,
  });
}
