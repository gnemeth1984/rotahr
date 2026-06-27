import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

function generateCode(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10);
  const rand = Math.random().toString(36).slice(2, 6);
  return `${slug}-${rand}`;
}

export async function POST(req: Request) {
  try {
    const { name, email, company, phone } = await req.json();

    if (!name || !email) {
      return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
    }

    // Check if already applied
    const existing = await prisma.referralPartner.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "This email is already registered as a partner." }, { status: 409 });
    }

    const code = generateCode(name);

    await prisma.referralPartner.create({
      data: { name, email, company, code, active: false },
    });

    // Notify Gabor
    await resend.emails.send({
      from: "Rotahr <hello@rotahr.com>",
      to: "gnemeth1984@gmail.com",
      subject: `New Partner Application: ${name}`,
      html: `
        <h2>New Partner Application</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Company:</strong> ${company || "—"}</p>
        <p><strong>Phone:</strong> ${phone || "—"}</p>
        <p><strong>Referral code (pending):</strong> ${code}</p>
        <p>Login to Rotahr admin to approve and send their referral link.</p>
      `,
    });

    // Confirm to applicant
    await resend.emails.send({
      from: "Rotahr <hello@rotahr.com>",
      to: email,
      subject: "Partner application received — Rotahr",
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#1e293b">
          <div style="margin-bottom:24px">
            <span style="font-size:22px;font-weight:800;color:#f97316">rotahr</span>
          </div>
          <h1 style="font-size:22px;font-weight:800;margin-bottom:12px">Thanks ${name.split(" ")[0]}!</h1>
          <p style="color:#475569;line-height:1.7;margin-bottom:16px">
            We've received your partner application. We'll review it and send you your unique referral link within 24 hours.
          </p>
          <p style="color:#475569;line-height:1.7;margin-bottom:16px">
            As a reminder — you'll earn <strong>20% recurring commission</strong> on every client you refer, every month, for life.
          </p>
          <p style="color:#475569;line-height:1.7">
            Any questions? Reply to this email or contact us at <a href="mailto:hello@rotahr.com" style="color:#f97316">hello@rotahr.com</a>
          </p>
          <div style="margin-top:32px;padding-top:24px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:13px">
            Rotahr · Built for Irish Hospitality
          </div>
        </div>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Partner apply error:", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
