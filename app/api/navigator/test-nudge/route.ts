// Fires one nudge immediately, ignoring every gate — quiet hours, shift, caps,
// dedup. Purely a plumbing check: it answers "is the delivery chain alive?"
// without waiting for the right moment to arrive.
//
// It exists because the first question about a scheduled notification system is
// always "is it broken, or just not time yet?", and that is otherwise unanswerable.
import { NextResponse } from "next/server";
import { navigatorUserId, forbidden } from "@/lib/navigator/guard";
import { prisma } from "@/lib/db";
import { createNotification } from "@/lib/services/appNotification.service";

export const dynamic = "force-dynamic";

export async function POST() {
  const userId = await navigatorUserId();
  if (!userId) return forbidden();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { pushSubscription: true },
  });

  await createNotification({
    userId,
    type: "navigator",
    title: "Test nudge — this is what they look like",
    body: "Delivery is working. Real nudges follow your Setup rules and stay quiet during shifts and quiet hours.",
    link: "/navigator",
  });

  const hasPush = !!user?.pushSubscription;
  const vapidConfigured = !!process.env.VAPID_PRIVATE_KEY;

  return NextResponse.json({
    ok: true,
    bell: "sent",
    // Reported separately so a silent phone isn't mistaken for a broken system.
    push: !vapidConfigured
      ? "off — VAPID keys not set in Vercel"
      : !hasPush
        ? "off — no device subscribed yet, allow notifications in the browser"
        : "sent",
  });
}
