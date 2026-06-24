// @ts-nocheck
import { prisma } from "@/lib/db";
import { sendPushToUser } from "@/lib/services/push.service";

export async function getEmployeeByEmail(email: string, businessId: string) {
  return prisma.employee.findFirst({
    where: { email, businessId },
  });
}

export async function sendNotification({
  reservationId,
  employeeId,
  message,
}: {
  reservationId: string;
  employeeId: string;
  message?: string;
}) {
  // Save to DB
  const notification = await prisma.bookingNotification.create({
    data: { reservationId, employeeId, message },
    include: {
      reservation: { select: { customerName: true, date: true, time: true } },
    },
  });

  // Look up the employee's linked userId and fire a web push
  try {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { userId: true },
    });
    if (employee?.userId) {
      const res = notification.reservation;
      const title = "New booking notification";
      const body = message
        ? message
        : res
        ? `${res.customerName} — ${new Date(res.date).toLocaleDateString("en-IE")} at ${res.time}`
        : "You have a new booking notification";
      await sendPushToUser(employee.userId, title, body, {
        url: "/reservations",
        notificationId: notification.id,
      });
    }
  } catch (err) {
    console.error("[sendNotification] push failed", err);
  }

  return notification;
}

export async function getNotificationsForEmployee(employeeId: string) {
  return prisma.bookingNotification.findMany({
    where: { employeeId },
    orderBy: { createdAt: "desc" },
    include: {
      reservation: {
        select: {
          id: true,
          customerName: true,
          date: true,
          time: true,
          partySize: true,
          status: true,
          notes: true,
        },
      },
    },
  });
}

export async function getUnreadCount(employeeId: string) {
  return prisma.bookingNotification.count({
    where: { employeeId, read: false },
  });
}

export async function markRead(id: string, employeeId: string) {
  return prisma.bookingNotification.updateMany({
    where: { id, employeeId },
    data: { read: true },
  });
}

export async function createFlag({
  reservationId,
  employeeId,
  note,
}: {
  reservationId: string;
  employeeId: string;
  note: string;
}) {
  return prisma.bookingFlag.create({
    data: { reservationId, employeeId, note },
  });
}

export async function getFlagsForReservation(reservationId: string) {
  return prisma.bookingFlag.findMany({
    where: { reservationId },
    orderBy: { createdAt: "desc" },
    include: {
      employee: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });
}

export async function resolveFlag(flagId: string) {
  return prisma.bookingFlag.update({
    where: { id: flagId },
    data: { resolved: true },
  });
}
