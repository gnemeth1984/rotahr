import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !["ADMIN", "MANAGER"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const businessId = session.user.businessId!;
  const { searchParams } = new URL(req.url);
  const dateParam = searchParams.get("date"); // optional YYYY-MM-DD

  let targetDate: Date;
  if (dateParam) {
    targetDate = new Date(`${dateParam}T00:00:00Z`);
  } else {
    targetDate = new Date();
    targetDate.setUTCHours(0, 0, 0, 0);
  }

  const snapshot = await prisma.posSnapshot.findUnique({
    where: { businessId_date: { businessId, date: targetDate } },
  });

  if (!snapshot) {
    return NextResponse.json({ snapshot: null });
  }

  // Fetch today's shifts with employee hourly rate for labour cost
  const shiftStart = new Date(targetDate);
  const shiftEnd = new Date(targetDate);
  shiftEnd.setUTCHours(23, 59, 59, 999);

  const shifts = await prisma.shift.findMany({
    where: {
      employee: { businessId },
      startTime: { gte: shiftStart, lte: shiftEnd },
      published: true,
    },
    include: { employee: { select: { hourlyRate: true } } },
  });

  let labourCost = 0;
  for (const shift of shifts) {
    const hours =
      (new Date(shift.endTime).getTime() - new Date(shift.startTime).getTime()) / 3_600_000;
    const rate = shift.employee?.hourlyRate ?? 0;
    labourCost += hours * rate;
  }

  const labourPct =
    snapshot.totalRevenue > 0 ? (labourCost / snapshot.totalRevenue) * 100 : null;

  return NextResponse.json({
    snapshot: {
      ...snapshot,
      labourCost: Math.round(labourCost * 100) / 100,
      labourPct: labourPct !== null ? Math.round(labourPct * 10) / 10 : null,
    },
  });
}
