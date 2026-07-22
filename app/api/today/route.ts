// @ts-nocheck
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";

// Unified "Today" feed — unread messages (1:1 + channel), open/overdue tasks,
// and unresolved log book items in one place, sorted by urgency, so a shift
// lead isn't checking three separate pages to know what needs attention.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const businessId = session.user.businessId ?? "christys-bar-seed-id";

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const me = await prisma.employee.findFirst({ where: { userId: session.user.id, businessId } });

  const [unreadDirect, channels, openTasks, unresolvedLog] = await Promise.all([
    me
      ? prisma.message.findMany({
          where: { businessId, recipientId: me.id, read: false },
          include: { sender: { select: { firstName: true, lastName: true } } },
          orderBy: { createdAt: "desc" },
          take: 20,
        })
      : [],
    me
      ? prisma.messageChannel.findMany({
          where: { businessId, OR: [{ departmentId: null }, ...(me.departmentId ? [{ departmentId: me.departmentId }] : [])] },
        })
      : [],
    prisma.opsTask.findMany({
      where: {
        businessId,
        completed: false,
        OR: [
          { assignedToId: me?.id },
          { assignedRole: me?.role },
          { assignedDepartmentId: me?.departmentId ?? undefined },
          { assignedToId: null, assignedRole: null, assignedDepartmentId: null },
        ],
      },
      include: { assignedTo: { select: { firstName: true, lastName: true } }, assignedDepartment: { select: { name: true } } },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      take: 30,
    }),
    prisma.logEntry.findMany({
      where: { businessId, resolved: false },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  let unreadChannelCount = 0;
  if (me && channels.length > 0) {
    unreadChannelCount = await prisma.channelMessage.count({
      where: {
        channelId: { in: channels.map((c) => c.id) },
        senderId: { not: me.id },
        receipts: { none: { employeeId: me.id } },
      },
    });
  }

  const now = new Date();
  const overdueTasks = openTasks.filter((t) => t.dueDate && new Date(t.dueDate) < now);
  const dueTodayTasks = openTasks.filter(
    (t) => t.dueDate && new Date(t.dueDate) >= todayStart && new Date(t.dueDate) <= todayEnd
  );

  return NextResponse.json({
    unreadDirectMessages: unreadDirect,
    unreadChannelCount,
    openTasksCount: openTasks.length,
    overdueTasks,
    dueTodayTasks,
    otherOpenTasks: openTasks.filter((t) => !overdueTasks.includes(t) && !dueTodayTasks.includes(t)),
    unresolvedLogEntries: unresolvedLog,
  });
}
