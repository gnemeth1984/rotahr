// @ts-nocheck
import { prisma } from "@/lib/db";
import { sendPushToUser } from "@/lib/services/push.service";
import { createNotification } from "@/lib/services/appNotification.service";

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

  // Look up the employee's linked userId — needed for both the in-app
  // notification center (AppNotification, what the bell/badge actually reads)
  // and the web push. Without this, "Notify Staff" silently did nothing
  // visible for anyone whose Employee record wasn't linked to a User —
  // which is exactly what happens for account owners/admins who select
  // themselves, since the two notification systems were never connected.
  try {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { userId: true, email: true, businessId: true },
    });

    // Employee/User accounts aren't always linked (e.g. an owner/admin's own
    // Employee row created for scheduling purposes, never connected to the
    // User account they actually log in with). Fall back to matching by
    // email within the same business, and heal the link for next time.
    let targetUserId = employee?.userId ?? null;
    if (!targetUserId && employee?.email) {
      const matchedUser = await prisma.user.findFirst({
        where: { email: employee.email, businessId: employee.businessId },
        select: { id: true },
      });
      if (matchedUser) {
        targetUserId = matchedUser.id;
        await prisma.employee.update({ where: { id: employeeId }, data: { userId: matchedUser.id } }).catch(() => {});
      }
    }

    if (targetUserId) {
      const res = notification.reservation;
      const title = "New booking notification";
      const body = message
        ? message
        : res
        ? `${res.customerName} — ${new Date(res.date).toLocaleDateString("en-IE")} at ${res.time}`
        : "You have a new booking notification";

      // Show up in the actual in-app notification center (bell/badge)
      await createNotification({
        userId: targetUserId,
        type: "booking",
        title,
        body,
        link: `/bookings?id=${reservationId}`,
      });

      // Also fire a direct push (createNotification already does this too,
      // but keep the explicit call in case push payload needs the notificationId)
      await sendPushToUser(targetUserId, title, body, {
        url: `/bookings?id=${reservationId}`,
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
