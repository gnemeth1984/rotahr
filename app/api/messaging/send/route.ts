import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMessagingStatus } from "@/lib/messaging/config";
import { sendWhatsApp, sendSms } from "@/lib/messaging/twilio";
import { z } from "zod";

const schema = z.object({
  customerId: z.string(),
  channel: z.enum(["whatsapp", "sms"]),
  body: z.string().min(1).max(1000),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const businessId = session.user.businessId;
  const status = await getMessagingStatus(businessId);
  if (!status.configured) {
    return NextResponse.json({ error: "Messaging is not configured for this business yet" }, { status: 400 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { customerId, channel, body: msgBody } = parsed.data;

  const customer = await prisma.customer.findFirst({ where: { id: customerId, businessId } });
  if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  if (!customer.phone) return NextResponse.json({ error: "This guest has no phone number on file" }, { status: 400 });
  if (!customer.smsWhatsappConsent) {
    return NextResponse.json({ error: "This guest hasn't given consent for SMS/WhatsApp messages" }, { status: 400 });
  }

  const result = channel === "whatsapp"
    ? await sendWhatsApp(businessId, customer.phone, msgBody)
    : await sendSms(businessId, customer.phone, msgBody);

  const logged = await prisma.guestMessage.create({
    data: {
      businessId,
      customerId,
      sentById: session.user.id,
      channel,
      direction: "outbound",
      body: msgBody,
      status: result.success ? "sent" : "failed",
      providerSid: result.sid || null,
      errorMessage: result.error || null,
    },
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error, logId: logged.id }, { status: 502 });
  }
  return NextResponse.json({ success: true, id: logged.id });
}
