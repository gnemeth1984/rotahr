// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { requireRole, isResponse } from "@/lib/auth/middleware";
import { employeeService, addEmployeeSchema } from "@/lib/services/employee.service";
import { prisma } from "@/lib/db";
import { computeAccess, ROTA_STAFF_CAP } from "@/lib/billing/access";

export async function POST(req: NextRequest) {
  const session = await requireRole("ADMIN", "MANAGER");
  if (isResponse(session)) return session;

  if (!session.user.businessId) {
    return NextResponse.json({ error: "No business associated" }, { status: 400 });
  }

  // Staff ceiling on the free rota tier.
  //
  // This is the only staff cap enforced anywhere in the app, and it applies to
  // exactly one state: a founding member past their term, on the free rota
  // tier. Paying and trialing businesses are untouched. It counts active
  // employees only, so deactivating someone frees a slot, and it never touches
  // staff who are already there — it only stops growth past the cap.
  try {
    const biz = await prisma.business.findUnique({
      where: { id: session.user.businessId },
      select: { lsStatus: true, trialEndsAt: true, foundingMember: true },
    });
    const access = computeAccess({
      lsStatus: biz?.lsStatus,
      trialEndsAt: biz?.trialEndsAt,
      foundingMember: biz?.foundingMember,
    });
    if (access.mode === "rota") {
      const active = await prisma.employee.count({
        where: { businessId: session.user.businessId, active: true },
      });
      if (active >= ROTA_STAFF_CAP) {
        return NextResponse.json(
          {
            error: "staff_cap",
            message: `The free rota tier covers up to ${ROTA_STAFF_CAP} staff, and you have ${active}. Choose a plan to add more, or deactivate someone who has left.`,
            billingUrl: "/settings/billing",
          },
          { status: 402 },
        );
      }
    }
  } catch {
    // Fail open, same as the rest of the access gate — a cap check that throws
    // must never stop a venue adding a member of staff.
  }

  const body = await req.json();
  const parsed = addEmployeeSchema.safeParse({ ...body, businessId: session.user.businessId });
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const employee = await employeeService.add(parsed.data);
    return NextResponse.json({ employee }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
