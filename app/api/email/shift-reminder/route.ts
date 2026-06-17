// @ts-nocheck
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendShiftReminderEmail } from "@/lib/email/shift-reminder";

// This route is called by Vercel Cron daily at 8am UTC
// It finds all shifts starting tomorrow and emails each employee

export async function GET(req: NextRequest) {
  // Protect with cron secret
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const dayAfter = new Date(tomorrow);
  dayAfter.setHours(23, 59, 59, 999);

  // Find all shifts tomorrow across all businesses
  const shifts = await prisma.shift.findMany({
    where: {
      startTime: { gte: tomorrow, lte: dayAfter },
    },
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const shift of shifts) {
    const emp = shift.employee;
    if (!emp?.email) continue;

    try {
      await sendShiftReminderEmail({
        to: emp.email,
        employeeName: `${emp.firstName} ${emp.lastName}`,
        shiftDate: shift.startTime,
        startTime: shift.startTime,
        endTime: shift.endTime,
        role: shift.role ?? null,
      });
      sent++;
    } catch (err: any) {
      failed++;
      errors.push(`${emp.email}: ${err.message}`);
    }
  }

  console.log(`[shift-reminder cron] Sent: ${sent}, Failed: ${failed}`);

  return NextResponse.json({ sent, failed, total: shifts.length, errors });
}
