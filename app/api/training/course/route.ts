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
  toCourseAsset,
  toCourseStock,
  toCourseHaccpUnit,
  toCourseHaccpCheck,
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

  // Each course reads only the venue data it actually uses, so a fire course
  // does not pull the whole menu and an allergen course does not pull the asset
  // register. The ticket then carries the ids of whichever set was used.
  const dishRows = course.usesMenu
    ? await prisma.dish.findMany({
        where: { businessId, active: true },
        orderBy: [{ category: "asc" }, { name: "asc" }],
      })
    : [];
  const dishes = dishRows.map(toCourseDish);

  const assetRows = course.usesAssets
    ? await prisma.asset.findMany({
        where: { businessId, status: { not: "retired" } },
        orderBy: [{ category: "asc" }, { name: "asc" }],
      })
    : [];
  const assets = assetRows.map(toCourseAsset);

  const stockRows = course.usesStock
    ? await prisma.stockItem.findMany({
        where: { businessId },
        orderBy: [{ name: "asc" }],
      })
    : [];
  const stock = stockRows.map(toCourseStock);

  const haccpRows = course.usesHaccp
    ? await prisma.hACCPEquipment.findMany({
        where: { businessId },
        orderBy: [{ equipType: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
      })
    : [];
  const haccp = haccpRows.map(toCourseHaccpUnit);

  // The check schedule feeds a lesson, not the quiz, so it is never carried on
  // the ticket \— a manager editing the times mid-course cannot change the paper.
  const scheduleRows = course.usesHaccp
    ? await prisma.hACCPSchedule.findMany({
        where: { businessId },
        orderBy: [{ checkType: "asc" }],
      })
    : [];
  const haccpChecks = scheduleRows.map(toCourseHaccpCheck);

  const seed = freshSeed();
  const data = { dishes, assets, stock, haccp, haccpChecks };
  const paper = buildQuiz(slug, data, seed);

  const token = signTicket({
    s: slug,
    d: seed,
    // Empty in practice mode — the submit route reads that as "grade it, file
    // nothing", so a practice pass can never mint a certificate.
    e: me?.id ?? "",
    b: businessId,
    // Dish ids for a menu course, asset ids for an equipment course, stock item
    // ids for a handling course. The submit route reloads whichever the course
    // declares, in this order.
    m: course.usesAssets
      ? assets.map((a) => a.id)
      : course.usesStock
        ? stock.map((s) => s.id)
        : course.usesHaccp
          ? haccp.map((u) => u.id)
          : dishes.map((d) => d.id),
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
      usesAssets: course.usesAssets,
      usesStock: course.usesStock,
      usesHaccp: course.usesHaccp,
    },
    practice,
    trainee: practice
      ? { id: null, name: session.user.name || "" }
      : { id: me.id, name: `${me.firstName} ${me.lastName}`.trim() },
    lessons: lessonsFor(slug, data),
    questions: publicQuiz(paper),
    token,
    menu: { dishes: dishes.length, checked: dishes.filter((d) => d.checked).length },
    equipment: { assets: assets.length, fireRisk: assets.filter((a) => a.fireRisk).length },
    stock: { items: stock.length, heavy: stock.filter((s) => s.heavy).length },
    haccp: {
      units: haccp.length,
      scheduled: haccpChecks.filter((c) => c.active).length,
    },
  });
}
