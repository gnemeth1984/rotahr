import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { testCredentials, sendWhatsApp, sendSms } from "@/lib/messaging/twilio";
import { z } from "zod";

const schema = z.object({
  testPhone: z.string().min(1), // number to send the live test message to (Gabor's own phone)
  channel: z.enum(["whatsapp", "sms"]),
});

// POST — verifies the saved Twilio credentials actually work by sending one
// real test message. Only on success does it flip `enabled: true`, which is
// the single switch every UI entry point checks before rendering.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const settings = await prisma.messagingSettings.findUnique({ where: { businessId: session.user.businessId } });
  if (!settings?.twilioAccountSid || !settings.twilioAuthToken) {
    return NextResponse.json({ error: "Save Twilio credentials first" }, { status: 400 });
  }

  const credCheck = await testCredentials(settings.twilioAccountSid, settings.twilioAuthToken);
  if (!credCheck.ok) {
    return NextResponse.json({ error: `Twilio rejected these credentials: ${credCheck.error}` }, { status: 400 });
  }

  // Temporarily mark enabled so the send helper (which checks `enabled`) will work for this test
  await prisma.messagingSettings.update({ where: { businessId: session.user.businessId }, data: { enabled: true } });

  const result = parsed.data.channel === "whatsapp"
    ? await sendWhatsApp(session.user.businessId, parsed.data.testPhone, "✅ Rotahr WhatsApp messaging is now connected and working.")
    : await sendSms(session.user.businessId, parsed.data.testPhone, "✅ Rotahr SMS messaging is now connected and working.");

  if (!result.success) {
    // Roll back — do not leave it enabled if the real send failed
    await prisma.messagingSettings.update({ where: { businessId: session.user.businessId }, data: { enabled: false } });
    return NextResponse.json({ error: result.error || "Test message failed to send" }, { status: 400 });
  }

  return NextResponse.json({ success: true, enabled: true, sid: result.sid });
}
