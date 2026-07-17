import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Resend } from "resend";
import { z } from "zod";
import { sendViaGmail } from "@/lib/google/gmail";
import { isDemoEmail, isDemoBusinessId } from "@/lib/demo/reset";

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

  // Auto-append a signature with the business's registered name + contact
  // details (from their default venue) — no manual setup needed per email.
  const business = await prisma.business.findUnique({
    where: { id: session.user.businessId },
    select: {
      name: true,
      venues: {
        where: { isDefault: true },
        select: { phone: true, email: true, address: true },
        take: 1,
      },
    },
  });
  const contactVenue = business?.venues?.[0];
  const contactLines = [contactVenue?.phone, contactVenue?.email, contactVenue?.address].filter(Boolean);
  const signatureHtml = business?.name
    ? `<p style="margin-top:24px;color:#64748b;font-size:13px;">${business.name}${
        contactLines.length ? `<br>${contactLines.join(" · ")}` : ""
      }</p>`
    : "";
  const emailBody = `${parsed.data.body}${signatureHtml}`;

  // Demo accounts/businesses never send a real email — visitors playing with
  // the demo (including anyone who types in a real address to "test" it)
  // must never actually trigger an outbound message.
  const isDemo = isDemoEmail(session.user.email || "") || isDemoBusinessId(session.user.businessId);

  let sentFrom = "Rotahr <no-reply@rotahr.com>";
  let fellBackToDefault = false;
  let simulated = false;

  if (isDemo) {
    simulated = true;
    sentFrom = business?.name ? `${business.name} <no-reply@rotahr.com>` : "Rotahr <no-reply@rotahr.com>";
  } else {
    // Send via the business's connected Gmail account if they've set one up,
    // otherwise fall back to the shared Rotahr sending address.
    const emailConnection = await prisma.emailConnection.findUnique({
      where: { businessId: session.user.businessId },
    });

    if (emailConnection) {
      try {
        const result = await sendViaGmail({
          businessId: session.user.businessId,
          to: customer.email,
          subject: parsed.data.subject,
          html: emailBody,
        });
        sentFrom = result.sentFrom;
      } catch (err) {
        console.error("Gmail send failed, falling back to Resend:", err);
        fellBackToDefault = true;
        const fallback = await resend.emails.send({
          from: business?.name ? `${business.name} <no-reply@rotahr.com>` : "Rotahr <no-reply@rotahr.com>",
          to: customer.email,
          subject: parsed.data.subject,
          html: emailBody,
        });
        if (fallback.error) {
          return NextResponse.json({ error: `Email failed to send: ${fallback.error.message}` }, { status: 502 });
        }
      }
    } else {
      const result = await resend.emails.send({
        from: business?.name ? `${business.name} <no-reply@rotahr.com>` : "Rotahr <no-reply@rotahr.com>",
        to: customer.email,
        subject: parsed.data.subject,
        html: emailBody,
      });
      if (result.error) {
        return NextResponse.json({ error: `Email failed to send: ${result.error.message}` }, { status: 502 });
      }
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

  return NextResponse.json({ ...log, sentFrom, fellBackToDefault, simulated }, { status: 201 });
}
