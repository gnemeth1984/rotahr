// @ts-nocheck
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendShiftReminderEmail } from "@/lib/email/shift-reminder";
import { dublinDayStartUtcOffset } from "@/lib/cron/service-hours";

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
  // "Tomorrow" must mean tomorrow in Dublin, not UTC. With UTC boundaries a
  // shift starting 00:30 Dublin during summer time (23:30 UTC today) fell
  // outside the window and that employee never got their reminder email.
  const tomorrow = dublinDayStartUtcOffset(1, now);
  const dayAfter = new Date(dublinDayStartUtcOffset(2, now).getTime() - 1);

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
