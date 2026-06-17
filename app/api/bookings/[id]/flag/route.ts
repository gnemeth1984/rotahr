// @ts-nocheck
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import {
  getEmployeeByEmail,
  createFlag,
} from "@/lib/services/notification.service";
import { z } from "zod";

const bodySchema = z.object({
  note: z.string().min(1, "Note is required"),
});

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const businessId = session.user.businessId;
    if (!businessId) {
      return NextResponse.json({ error: "No business" }, { status: 400 });
    }

    const employee = await getEmployeeByEmail(session.user.email, businessId);
    if (!employee) {
      return NextResponse.json({ error: "Not an employee" }, { status: 403 });
    }

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
