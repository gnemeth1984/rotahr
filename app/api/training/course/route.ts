// @ts-nocheck
export const dynamic = "force-dynamic";

/**
 * GET /api/training/course?slug=allergen-awareness
 *
 * Returns the lessons and a quiz paper for the signed-in employee. The paper's
 * answers never leave the server — publicQuiz() strips them, and a signed
 * ticket lets the submit route rebuild the identical paper to grade against.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db";
import {
  getCourse,
  lessonsFor,
  toCourseDish,
  buildQuiz,
  publicQuiz,
} from "@/lib/training/courses";
import { signTicket, freshSeed } from "@/lib/training/quiz-token";

export async function GET(req: NextRequest) {
  const session = await requireAuth();
  if (isResponse(session)) return session;

  const businessId = session.user.businessId;
  if (!businessId) return NextResponse.json({ error: "No business" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug") || "";
  const course = getCourse(slug);
  if (!course) return NextResponse.json({ error: "Unknown course" }, { status: 404 });

  const me = await prisma.employee.findFirst({
    where: { userId: session.user.id, businessId },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!me) {
    return NextResponse.json(
      {
        error:
          "Your login is not linked to an employee record, so a training record cannot be filed against it. A manager can link it under Team.",
      },
      { status: 400 }
    );
  }

  const dishRows = await prisma.dish.findMany({
    where: { businessId, active: true },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
  const dishes = dishRows.map(toCourseDish);

  const seed = freshSeed();
  const paper = buildQuiz(slug, dishes, seed);

  const token = signTicket({
    s: slug,
    d: seed,
    e: me.id,
    b: businessId,
    m: dishes.map((d) => d.id),
    t: Date.now(),
  });

  return NextResponse.json({
    course: {
      slug: course.slug,
      title: course.title,
      summary: course.summary,
      minutes: course.minutes,
      passMark: course.passMark,
      validMonths: course.validMonths,
      usesMenu: course.usesMenu,
    },
    trainee: { id: me.id, name: `${me.firstName} ${me.lastName}`.trim() },
    lessons: lessonsFor(slug, dishes),
    questions: publicQuiz(paper),
    token,
    menu: { dishes: dishes.length, checked: dishes.filter((d) => d.checked).length },
  });
}
