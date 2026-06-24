// @ts-nocheck
import Expo from "expo-server-sdk";
import { prisma } from "@/lib/db";

const expo = new Expo();

export async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { pushToken: true },
    });

    if (!user?.pushToken) return; // no token registered
    if (!Expo.isExpoPushToken(user.pushToken)) return; // invalid token

    const messages = [
      {
        to: user.pushToken,
        sound: "default" as const,
        title,
        body,
        data: data ?? {},
      },
    ];

    const chunks = expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      await expo.sendPushNotificationsAsync(chunk);
    }
  } catch (err) {
    // Never let push failures break the main flow
    console.error("[push.service] Error sending push:", err);
  }
}

/** Send push to multiple users — errors swallowed per user */
export async function sendPushToUsers(
  userIds: string[],
  title: string,
  body: string,
  data?: Record<string, unknown>
) {
  await Promise.allSettled(
    userIds.map((id) => sendPushToUser(id, title, body, data))
  );
}
