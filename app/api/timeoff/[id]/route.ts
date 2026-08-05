import { NextRequest, NextResponse } from "next/server";
import { requireTenant, isResponse, notFound } from "@/lib/auth/tenant";
import { prisma } from "@/lib/db";
import { updateTimeOffSchema } from "@/lib/validators/timeoff";
import { sendTimeOffStatusEmail } from "@/lib/email";

// Tenant isolation: PATCH/DELETE used to write on a raw client-supplied ID, so
// a manager in one business could approve, reject or delete another business's
// time-off requests. TimeOffRequest has no businessId column — scope through
// the employee relation.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const t = await requireTenant({ manager: true });
  if (isResponse(t)) return t;

  const { id } = await params;
  const body = await req.json();
  const result = updateTimeOffSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: "Invalid input", details: result.error.flatten() },
      { status: 400 }
    );
  }

  const request = await prisma.timeOffRequest.findFirst({
    where: { id, employee: { businessId: t.businessId } },
    select: { id: true },
  });
  if (!request) return notFound();

  const updated = await prisma.timeOffRequest.update({
    where: { id },
    data: {
      status: result.data.status,
      managedById: t.userId,
    },
    include: {
      employee: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });

  // Send notification email
  const employeeEmail = updated.employee?.email;
  const employeeName = updated.employee
    ? `${updated.employee.firstName} ${updated.employee.lastName}`
    : "Team Member";

  if (
    employeeEmail &&
    (result.data.status === "APPROVED" || result.data.status === "REJECTED")
  ) {
    try {
      await sendTimeOffStatusEmail({
        to: employeeEmail,
        name: employeeName,
        status: result.data.status,
        startDate: updated.startDate,
        endDate: updated.endDate,
      });
    } catch (e) {
      console.error("Failed to send status email:", e);
    }
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const t = await requireTenant();
  if (isResponse(t)) return t;

  const { id } = await params;
  const request = await prisma.timeOffRequest.findFirst({
    where: { id, employee: { businessId: t.businessId } },
    include: { employee: { select: { userId: true } } },
  });
  if (!request) return notFound();

  const isOwner = request.employee?.userId === t.userId;
  if (!t.isManager && !isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.timeOffRequest.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
