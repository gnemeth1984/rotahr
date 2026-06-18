// @ts-nocheck
import { prisma } from "@/lib/db";

export type NotifType = "message" | "shift" | "timeoff" | "booking" | "rota";

export async function createNotification({
  userId,
  type,
  title,
  body,
  link,
}: {
  userId: string;
  type: NotifType;
  title: string;
  body: string;
  link?: string;
}) {
  return prisma.appNotification.create({
    data: { userId, type, title, body, link: link ?? null },
  });
}

/** Notify multiple users at once — errors are swallowed per-user */
export async function notifyUsers(
  userIds: string[],
  payload: { type: NotifType; title: string; body: string; link?: string }
) {
  return Promise.allSettled(
    userIds.map((userId) => createNotification({ userId, ...payload }))
  );
}

export async function getUnreadCount(userId: string) {
  return prisma.appNotification.count({ where: { userId, read: false } });
}

export async function listNotifications(userId: string) {
  return prisma.appNotification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function markRead(id: string, userId: string) {
  return prisma.appNotification.updateMany({
    where: { id, userId },
    data: { read: true },
  });
}

export async function markAllRead(userId: string) {
  return prisma.appNotification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });
}
