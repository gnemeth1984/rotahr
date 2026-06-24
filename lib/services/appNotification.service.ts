// @ts-nocheck
import { prisma } from "@/lib/db";
import { sendPushToUser, sendPushToUsers } from "./push.service";

export type NotifType = "message" | "shift" | "timeoff" | "booking" | "rota" | "late_checkin" | "cert_expiry";

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
  const notif = await prisma.appNotification.create({
    data: { userId, type, title, body, link: link ?? null },
  });

  // Fire push in background — never blocks the main flow
  sendPushToUser(userId, title, body, { type, link }).catch(() => {});

  return notif;
}

/** Notify multiple users at once — errors are swallowed per-user */
export async function notifyUsers(
  userIds: string[],
  payload: { type: NotifType; title: string; body: string; link?: string }
) {
  const results = await Promise.allSettled(
    userIds.map((userId) => createNotification({ userId, ...payload }))
  );

  // Also batch-push
  sendPushToUsers(userIds, payload.title, payload.body, { type: payload.type, link: payload.link }).catch(() => {});

  return results;
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
