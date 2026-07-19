import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Twilio posts application/x-www-form-urlencoded for both status callbacks
// and inbound messages. No auth header from Twilio itself — validate via
// MessageSid lookups against rows we created, so an unknown SID is a no-op.
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const messageSid = form.get("MessageSid")?.toString() || form.get("SmsSid")?.toString();
  const messageStatus = form.get("MessageStatus")?.toString(); // queued|sent|delivered|failed|undelivered
  const from = form.get("From")?.toString();
  const bodyText = form.get("Body")?.toString();

  if (!messageSid) return NextResponse.json({ ok: true });

  if (messageStatus) {
    // Delivery status update for a message we sent
    await prisma.guestMessage.updateMany({
      where: { providerSid: messageSid },
      data: { status: messageStatus },
    });
    return NextResponse.json({ ok: true });
  }

  if (from && bodyText) {
    // Inbound reply from a guest — match by phone number (strip whatsapp: prefix)
    const phone = from.replace("whatsapp:", "");
    const customer = await prisma.customer.findFirst({ where: { phone } });
    if (customer) {
      await prisma.guestMessage.create({
        data: {
          businessId: customer.businessId,
          customerId: customer.id,
          channel: from.startsWith("whatsapp:") ? "whatsapp" : "sms",
          direction: "inbound",
          body: bodyText,
          status: "received",
          providerSid: messageSid,
        },
      });
    }
  }

  return NextResponse.json({ ok: true });
}
