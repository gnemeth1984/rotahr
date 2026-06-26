import { NextRequest, NextResponse } from "next/server";
import { requireRole, isResponse } from "@/lib/auth/middleware";
import { timeOffService } from "@/lib/services/timeoff.service";
import { prisma } from "@/lib/db";
import { createNotification } from "@/lib/services/appNotification.service";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireRole("ADMIN", "MANAGER");
  if (isResponse(session)) return session;

  if (!session.user.businessId) {
    return NextResponse.json({ error: "No business associated" }, { status: 400 });
  }

  try {
    const request = await timeOffService.updateStatus(params.id, session.user.businessId, "APPROVED");

    // Notify the employee
    const employee = await prisma.employee.findUnique({
      where: { id: request.employeeId },
      select: { userId: true, firstName: true },
    });
    if (employee?.userId) {
      await createNotification({
        userId: employee.userId,
        type: "timeoff",
        title: "Time off approved ✓",
        body: `Your time off request has been approved.`,
        link: `/timeoff?id=${params.id}`,
      }).catch(() => {});
    }

    return NextResponse.json({ request });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
