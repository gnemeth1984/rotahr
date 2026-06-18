// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { requireRole, isResponse } from "@/lib/auth/middleware";
import { shiftService, createShiftSchema } from "@/lib/services/shift.service";
import { prisma } from "@/lib/db";
import { createNotification } from "@/lib/services/appNotification.service";
import { format } from "date-fns";

export async function POST(req: NextRequest) {
  const session = await requireRole("ADMIN", "MANAGER");
  if (isResponse(session)) return session;

  const body = await req.json();
  const parsed = createShiftSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const shift = await shiftService.create(parsed.data);

    // Notify the assigned employee
    if (shift.employeeId) {
      const employee = await prisma.employee.findUnique({
        where: { id: shift.employeeId },
        select: { userId: true, firstName: true },
      });
      if (employee?.userId) {
        const dateStr = format(new Date(shift.date), "EEE, MMM d");
        const startStr = format(new Date(shift.startTime), "HH:mm");
        const endStr = format(new Date(shift.endTime), "HH:mm");
        await createNotification({
          userId: employee.userId,
          type: "shift",
          title: "New shift assigned",
          body: `${dateStr} · ${startStr}–${endStr}${shift.role ? ` · ${shift.role}` : ""}`,
          link: "/schedule",
        }).catch(() => {});
      }
    }

    return NextResponse.json({ shift }, { status: 201 });
  } catch (e: any) {
    console.error("[shifts/create]", e);
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
