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

  // An owner account created at signup has no Employee row of its own, and the
  // owner is the most likely person to open a course first. Blocking them was a
  // dead end on the demo and on every real signup. So a login with no employee
  // record still gets the whole course — it simply cannot file evidence against
  // a staff member who does not exist. Practice mode says that plainly instead
  // of pretending a record was kept.
  const me = await prisma.employee.findFirst({
    where: { userId: session.user.id, businessId },
    select: { id: true, firstName: true, lastName: true },
  });
  const practice = !me;

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
    // Empty in practice mode — the submit route reads that as "grade it, file
    // nothing", so a practice pass can never mint a certificate.
    e: me?.id ?? "",
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
    practice,
    trainee: practice
      ? { id: null, name: session.user.name || "" }
      : { id: me.id, name: `${me.firstName} ${me.lastName}`.trim() },
    lessons: lessonsFor(slug, dishes),
    questions: publicQuiz(paper),
    token,
    menu: { dishes: dishes.length, checked: dishes.filter((d) => d.checked).length },
  });
}
