// @ts-nocheck
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sendNotification } from "@/lib/services/notification.service";
import { z } from "zod";

const bodySchema = z.object({
  reservationId: z.string().min(1),
  employeeIds: z.array(z.string().min(1)).min(1),
  message: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = session.user.role;
    if (role !== "ADMIN" && role !== "MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid body", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { reservationId, employeeIds, message } = parsed.data;

    const results = await Promise.all(
      employeeIds.map((employeeId) =>
        sendNotification({ reservationId, employeeId, message })
      )
    );

    return NextResponse.json({ sent: results.length });
  } catch (err) {
    console.error("POST /api/notifications/send", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
