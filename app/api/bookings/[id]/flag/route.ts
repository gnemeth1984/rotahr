import { NextResponse } from "next/server";
import { requireTenant, isResponse, notFound } from "@/lib/auth/tenant";
import { prisma } from "@/lib/db";
import { getEmployeeByEmail, createFlag } from "@/lib/services/notification.service";
import { z } from "zod";

const bodySchema = z.object({
  note: z.string().min(1, "Note is required"),
});

// Tenant isolation: reservationId came straight from the URL and was never
// checked against the caller's business, so a flag could be attached to another
// business's reservation.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const t = await requireTenant();
    if (isResponse(t)) return t;
    if (!t.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const employee = await getEmployeeByEmail(t.email, t.businessId);
    if (!employee) {
      return NextResponse.json({ error: "Not an employee" }, { status: 403 });
    }

    const reservation = await prisma.reservation.findFirst({
      where: { id: params.id, businessId: t.businessId },
      select: { id: true },
    });
    if (!reservation) return notFound();

    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid body", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const flag = await createFlag({
      reservationId: params.id,
      employeeId: employee.id,
      note: parsed.data.note,
    });

    return NextResponse.json({ flag });
  } catch (err) {
    console.error("POST /api/bookings/[id]/flag", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
