import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Resend } from "resend";
import { z } from "zod";
import { sendViaGmail } from "@/lib/google/gmail";

const resend = new Resend(process.env.RESEND_API_KEY);

const emailSchema = z.object({
  subject: z.string().min(1),
  body: z.string().min(1),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session?.user?.businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const customer = await prisma.customer.findFirst({
    where: { id, businessId: session.user.businessId },
  });
  if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!customer.email) return NextResponse.json({ error: "Customer has no email address" }, { status: 400 });
  if (!customer.gdprConsent) return NextResponse.json({ error: "Customer has not given GDPR marketing consent" }, { status: 403 });
  if (customer.isAnonymised) return NextResponse.json({ error: "Customer is anonymised" }, { status: 400 });

  const body = await req.json();
  const parsed = emailSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Send via the business's connected Gmail account if they've set one up,
  // otherwise fall back to the shared Rotahr sending address.
  let sentFrom = "Rotahr <no-reply@rotahr.com>";
  let fellBackToDefault = false;
  const emailConnection = await prisma.emailConnection.findUnique({
    where: { businessId: session.user.businessId },
  });

  if (emailConnection) {
    try {
      const result = await sendViaGmail({
        businessId: session.user.businessId,
        to: customer.email,
        subject: parsed.data.subject,
        html: parsed.data.body,
      });
      sentFrom = result.sentFrom;
    } catch (err) {
      console.error("Gmail send failed, falling back to Resend:", err);
      fellBackToDefault = true;
      const fallback = await resend.emails.send({
        from: "Rotahr <no-reply@rotahr.com>",
        to: customer.email,
        subject: parsed.data.subject,
        html: parsed.data.body,
      });
      if (fallback.error) {
        return NextResponse.json({ error: `Email failed to send: ${fallback.error.message}` }, { status: 502 });
      }
    }
  } else {
    const result = await resend.emails.send({
      from: "Rotahr <no-reply@rotahr.com>",
      to: customer.email,
      subject: parsed.data.subject,
      html: parsed.data.body,
    });
    if (result.error) {
      return NextResponse.json({ error: `Email failed to send: ${result.error.message}` }, { status: 502 });
    }
  }

  // Log
  const preview = parsed.data.body.replace(/<[^>]*>/g, "").slice(0, 200);
  const log = await prisma.crmEmail.create({
    data: {
      customerId: id,
      sentById: session.user.id,
      subject: parsed.data.subject,
      preview,
      body: parsed.data.body,
    },
    include: { sentBy: { select: { name: true, email: true } } },
  });

  return NextResponse.json({ ...log, sentFrom, fellBackToDefault }, { status: 201 });
}
