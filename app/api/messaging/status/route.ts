import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getMessagingStatus } from "@/lib/messaging/config";

// GET /api/messaging/status — used by the UI to decide whether to render any
// messaging entry point at all. Returns configured:false until a real,
// verified Twilio setup exists for this business.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const status = await getMessagingStatus(session.user.businessId);
  return NextResponse.json(status);
}
