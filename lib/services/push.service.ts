import webpush from "web-push";
import { prisma } from "@/lib/db";

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT ?? "mailto:gnemeth1984@gmail.com",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
  process.env.VAPID_PRIVATE_KEY ?? ""
);

export async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { pushSubscription: true },
    });

    if (!user?.pushSubscription) return;

    const subscription = JSON.parse(user.pushSubscription) as webpush.PushSubscription;

    await webpush.sendNotification(
      subscription,
      JSON.stringify({ title, body, data: data ?? {} })
    );
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
