// @ts-nocheck
// Late / No-Show Detection Cron
// Runs every 30 minutes via Vercel cron
// Finds shifts that started >15 minutes ago where the employee has NOT clocked in
// Creates an in-app notification for managers
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createNotification } from "@/lib/services/appNotification.service";

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const cutoff = new Date(now.getTime() - 15 * 60 * 1000); // 15 min ago
  const windowStart = new Date(now.getTime() - 60 * 60 * 1000); // only look 1h back (avoid spam)

  // Find shifts that started between 1h ago and 15min ago
  const lateShifts = await prisma.shift.findMany({
    where: {
      published: true,
      employeeId: { not: null },
      startTime: {
        gte: windowStart,
        lte: cutoff,
      },
    },
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          businessId: true,
        },
      },
    },
  });

  if (lateShifts.length === 0) {
    return NextResponse.json({ checked: 0, alerts: 0 });
  }

  let alertCount = 0;

  for (const shift of lateShifts) {
    if (!shift.employee) continue;

    const emp = shift.employee;

    // Check if employee has clocked in since shift start
    const clockIn = await prisma.clockEvent.findFirst({
      where: {
        employeeId: emp.id,
        type: "in",
        timestamp: { gte: shift.startTime },
      },
    });

    if (clockIn) continue; // They've clocked in — all good

    // Check if we already sent an alert for this shift in the last hour
    const existingAlert = await prisma.appNotification.findFirst({
      where: {
        userId: { not: undefined },
        type: "late_checkin",
        referenceId: shift.id,
        createdAt: { gte: windowStart },
      },
    });
    if (existingAlert) continue; // Already alerted

    // Find managers for this business
    const managers = await prisma.user.findMany({
      where: {
        businessId: emp.businessId,
        role: { in: ["MANAGER", "ADMIN"] },
      },
      select: { id: true },
    });

    const minutesLate = Math.round((now.getTime() - shift.startTime.getTime()) / 60000);
    const empName = `${emp.firstName} ${emp.lastName}`;
    const shiftTime = shift.startTime.toLocaleTimeString("en-IE", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Europe/Dublin",
    });

    for (const manager of managers) {
      await createNotification({
        userId: manager.id,
        type: "late_checkin",
        title: `${empName} hasn't clocked in`,
        body: `Shift started at ${shiftTime} (${minutesLate} min ago). No clock-in recorded.`,
        link: `/rota?date=${shift.date.toISOString().split("T")[0]}`,
      });
    }

    alertCount++;
  }

  return NextResponse.json({
    checked: lateShifts.length,
    alerts: alertCount,
    timestamp: now.toISOString(),
  });
}
