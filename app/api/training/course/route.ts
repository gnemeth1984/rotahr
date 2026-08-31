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
  toCourseHaccpLog,
  toCourseCleaningRecord,
  toCourseCleaningTemplate,
  toCourseCustomer,
  toCourseDelivery,
  toCourseShift,
  toCourseClock,
  buildQuiz,
  publicQuiz,
} from "@/lib/training/courses";
import { signTicket, freshSeed } from "@/lib/training/quiz-token";
import { CLEANING_CHECK_TYPES } from "@/lib/training/kit";

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

  // Logged checks. This is the only course that reads them, and it reads them
  // as evidence rather than as temperatures: how recent the newest one is, how
  // many failed, whether a failure was ever followed by a corrective action,
  // and whether anybody wrote a note. toCourseHaccpLog deliberately drops
  // checkedById \— equipment and supplier names are the venue's property and
  // safe to print, but who logged a check never travels into training content.
  const logRows = course.usesHaccpLogs
    ? await prisma.hACCPRecord.findMany({
        where: { businessId },
        orderBy: [{ checkedAt: "desc" }],
        take: 250,
      })
    : [];
  const haccpLogs = logRows.map(toCourseHaccpLog);

  // Cleaning, opening and closing checks that were actually logged. What makes
  // this worth teaching from is not the tick — it is how much of the list was
  // ticked, and how long ago.
  const cleaningRows = course.usesCleaning
    ? await prisma.hACCPRecord.findMany({
        where: { businessId, checkType: { in: [...CLEANING_CHECK_TYPES] } },
        orderBy: [{ checkedAt: "desc" }],
        take: 40,
      })
    : [];
  const cleaning = cleaningRows.map(toCourseCleaningRecord);

  // A venue's own edited checklists feed a lesson, not the quiz, so like the
  // HACCP schedule they never go on the ticket.
  const templateRows = course.usesCleaning
    ? await prisma.hACCPChecklistTemplate.findMany({
        where: { businessId },
        orderBy: [{ checkType: "asc" }],
      })
    : [];
  const cleaningTemplates = templateRows.map(toCourseCleaningTemplate);

  // Goods-in checks. What teaches here is not that a delivery was logged — it
  // is whether the record could answer a recall: which supplier, what came in,
  // and what temperature it arrived at. Missing fields stay missing; a blank
  // temperature is a lesson, not something to fill in with a guess.
  const deliveryRows = course.usesDeliveries
    ? await prisma.hACCPRecord.findMany({
        where: { businessId, checkType: "delivery" },
        orderBy: [{ checkedAt: "desc" }],
        take: 40,
      })
    : [];
  const deliveries = deliveryRows.map(toCourseDelivery);

  // Guest records. toCourseCustomer keeps shape only — counts, flags and the
  // length of the note field, never a name, a note or an allergy line. A
  // privacy course that printed a real guest's name and their allergy note onto
  // a page every member of staff opens would be a breach of its own, and the
  // completion stores a snapshot of what the course read, so that text would
  // sit in the evidence record forever. A higher take than the other courses is
  // deliberate: every question here is a count, and a truncated list would
  // state a false figure about the venue's own data.
  const customerRows = course.usesCustomers
    ? await prisma.customer.findMany({
        where: { businessId },
        orderBy: [{ createdAt: "desc" }],
        take: 200,
      })
    : [];
  const customers = customerRows.map(toCourseCustomer);

  // The rota and the time clock. Shift has no businessId of its own — it hangs
  // off the employee — so the venue's own staff ids are the tenant boundary
  // here. toCourseShift keeps shape only: date, times, length, published flag.
  // Never a name. A working time course that printed who was rostered thin
  // would be handing one member of staff another's hours, and the completion
  // snapshot would keep that forever.
  const rotaStaff = course.usesShifts
    ? await prisma.employee.findMany({ where: { businessId }, select: { id: true } })
    : [];
  const rotaStaffIds = rotaStaff.map((e) => e.id);
  const shiftRows =
    course.usesShifts && rotaStaffIds.length > 0
      ? await prisma.shift.findMany({
          where: { employeeId: { in: rotaStaffIds } },
          orderBy: [{ date: "desc" }, { startTime: "asc" }],
          take: 250,
        })
      : [];
  const shifts = shiftRows.map(toCourseShift);

  // Clock events are counted, not listed: how many people clocked in, whether
  // anybody ever clocked out, and whether a break was ever recorded. The
  // counts ride on the ticket rather than being re-read at submit time.
  const clockRows = course.usesShifts
    ? await prisma.clockEvent.findMany({
        where: { businessId },
        orderBy: [{ timestamp: "desc" }],
        take: 500,
      })
    : [];
  const clock = toCourseClock(clockRows);

  const seed = freshSeed();
  const data = {
    dishes,
    assets,
    stock,
    haccp,
    haccpChecks,
    haccpLogs,
    cleaning,
    cleaningTemplates,
    deliveries,
    customers,
    shifts,
    clock,
  };
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
          : course.usesCleaning
            ? cleaning.map((r) => r.id)
            : course.usesDeliveries
              ? deliveries.map((d) => d.id)
              : course.usesCustomers
                ? customers.map((c) => c.id)
                : course.usesShifts
                  ? shifts.map((sh) => sh.id)
                  : dishes.map((d) => d.id),
    // Only the working time course reads the clock, and only counts travel.
    c: course.usesShifts ? clock : undefined,
    // The HACCP system course grades against the schedule and the logged checks
    // as well as the register, and m is already spoken for by the unit ids.
    k: course.usesHaccpLogs ? scheduleRows.map((r) => r.id) : undefined,
    l: course.usesHaccpLogs ? logRows.map((r) => r.id) : undefined,
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
      usesCleaning: course.usesCleaning,
      usesDeliveries: course.usesDeliveries,
      usesCustomers: course.usesCustomers,
      usesShifts: course.usesShifts,
      usesHaccpLogs: course.usesHaccpLogs,
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
      logged: haccpLogs.length,
      failures: haccpLogs.filter((l) => l.status !== "pass").length,
    },
    cleaning: {
      records: cleaning.length,
      lastDeepClean: cleaning.find((r) => r.checkType === "cleaning_deep")?.checkedAt ?? null,
    },
    deliveries: {
      records: deliveries.length,
      missingTemp: deliveries.filter((d) => d.temp === null).length,
    },
    customers: {
      profiles: customers.length,
      consented: customers.filter((c) => c.consent).length,
      withNotes: customers.filter((c) => c.hasInternalNotes).length,
    },
    shifts: {
      total: shifts.length,
      people: new Set(shifts.map((sh) => sh.employeeId).filter(Boolean)).size,
      breaksRecorded: clock.breakStarts,
    },
  });
}
