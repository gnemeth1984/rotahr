// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { requireRole, isResponse } from "@/lib/auth/middleware";
import { shiftService, updateShiftSchema } from "@/lib/services/shift.service";
import { prisma } from "@/lib/db";
import { createNotification } from "@/lib/services/appNotification.service";

async function handleUpdate(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireRole("ADMIN", "MANAGER");
  if (isResponse(session)) return session;

  if (!session.user.businessId) {
    return NextResponse.json({ error: "No business associated" }, { status: 400 });
  }

  const body = await req.json();
  const parsed = updateShiftSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const shift = await shiftService.update(params.id, session.user.businessId, parsed.data);

    // Notify the employee their shift was updated
    const employee = await prisma.employee.findUnique({
      where: { id: shift.employeeId },
      select: { userId: true },
    });
    if (employee?.userId) {
      const shiftDate = shift.date
        ? new Date(shift.date).toLocaleDateString("en-IE", { weekday: "short", day: "numeric", month: "short" })
        : "your shift";
      await createNotification({
        userId: employee.userId,
        type: "shift",
        title: "Shift Updated",
        body: `Your shift on ${shiftDate} has been updated.`,
        link: "/shifts",
      }).catch(() => {});
    }

    return NextResponse.json({ shift });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

// Support both PATCH and PUT from UI
export const PATCH = handleUpdate;
export const PUT = handleUpdate;

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireRole("ADMIN", "MANAGER");
  if (isResponse(session)) return session;

  try {
    // Fetch shift before deleting so we can notify the employee
    const shift = await prisma.shift.findUnique({
      where: { id: params.id },
      select: { id: true, employeeId: true, date: true },
    });

    if (!shift) {
      return NextResponse.json({ error: "Shift not found" }, { status: 404 });
    }

    await shiftService.delete(params.id);

    // Notify employee
    if (shift.employeeId) {
      const employee = await prisma.employee.findUnique({
        where: { id: shift.employeeId },
        select: { userId: true },
      });
      if (employee?.userId) {
        const shiftDate = shift.date
          ? new Date(shift.date).toLocaleDateString("en-IE", { weekday: "short", day: "numeric", month: "short" })
          : "a shift";
        await createNotification({
          userId: employee.userId,
          type: "shift",
          title: "Shift Cancelled",
          body: `Your shift on ${shiftDate} has been cancelled.`,
          link: "/shifts",
        }).catch(() => {});
      }
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
