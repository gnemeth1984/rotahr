// ─── Signup lifecycle email ───────────────────────────────────────────────────
//
// This module used to POST to a standalone email service at EMAIL_SYSTEM_URL
// (the Railway app). That service is gone — every route on it returns 404 — and
// because both calls swallow their errors by design, the failure was completely
// silent: every signup and every completed onboarding since the service died
// looked like it had triggered a welcome email and actually sent nothing.
//
// The welcome email now sends directly through Resend, the same path as every
// other email to a real Rotahr user. It is not marketing mail in the consent
// sense — it goes only to someone who just created an account — so it belongs
// with transactional mail, and deliberately not with Brevo cold outreach.

import { sendEmailQuiet } from "./send";
import { prisma } from "@/lib/db";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://rotahr.com";

interface WelcomePayload {
  first_name?: string;
  email: string;
  business_name?: string;
  business_type?: string;
  city?: string;
}

function welcomeHtml(firstName: string, businessName?: string): string {
  const greeting = firstName ? `Hi ${firstName},` : "Hi there,";
  const venue = businessName ? ` at <strong>${businessName}</strong>` : "";

  return `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
    <div style="background: #0f1c35; padding: 28px; border-radius: 12px 12px 0 0;">
      <h1 style="color: #ffffff; margin: 0; font-size: 22px;">Welcome to Rotahr</h1>
      <p style="color: #94a3b8; margin: 6px 0 0; font-size: 14px;">
        Rotas, bookings, payroll and food safety in one place.
      </p>
    </div>
    <div style="background: #f8fafc; padding: 28px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0; border-top: none;">
      <p style="color: #334155; margin-top: 0;">${greeting}</p>
      <p style="color: #475569;">
        Your account is ready. Here is the quickest route to getting your first week${venue} on the rota:
      </p>

      <ol style="color: #475569; padding-left: 20px; line-height: 1.7;">
        <li><strong>Add your team</strong> — names and emails are enough to start.</li>
        <li><strong>Build a week</strong> — drag shifts onto the rota, then publish. Staff are notified instantly.</li>
        <li><strong>Turn on what you need</strong> — bookings, HACCP checks, bookkeeping and payroll are all in the sidebar.</li>
      </ol>

      <p style="margin: 24px 0;">
        <a href="${BASE_URL}/rota"
           style="display: inline-block; background: #ff6b35; color: #ffffff; text-decoration: none;
                  padding: 12px 22px; border-radius: 8px; font-weight: 600; font-size: 15px;">
          Open your rota
        </a>
      </p>

      <p style="color: #64748b; font-size: 14px;">
        Your first month is free — no card needed until it ends.
      </p>

      <p style="color: #475569; font-size: 14px;">
        If something does not fit how your venue actually runs, reply to this email and tell me.
        I read every one.
      </p>

      <p style="color: #475569; font-size: 14px; margin-bottom: 0;">
        Gabor<br>
        <span style="color: #94a3b8;">Founder, Rotahr — former chef</span>
      </p>
    </div>
  </div>`;
}

/**
 * Sends the welcome email to a new signup.
 *
 * Fire-and-forget by contract — it must never break registration or onboarding.
 * `sendEmailQuiet` swallows and logs failures, so nothing here can throw.
 *
 * Idempotent: a user reaching both register and onboarding would otherwise get
 * two identical welcomes, so the send is recorded and skipped the second time.
 */
export async function triggerWelcomeEmail(payload: WelcomePayload): Promise<void> {
  const email = payload.email?.trim().toLowerCase();
  if (!email) return;

  try {
    // Claim the send first. A unique constraint on email means two concurrent
    // callers cannot both win, so the second simply finds a row and stops.
    const existing = await prisma.welcomeEmailLog.findUnique({ where: { email } });
    if (existing) return;
    await prisma.welcomeEmailLog.create({ data: { email } });
  } catch {
    // Already claimed by a concurrent caller (unique violation) — nothing to do.
    return;
  }

  await sendEmailQuiet({
    context: "welcome",
    to: email,
    subject: payload.business_name
      ? `Welcome to Rotahr, ${payload.business_name}`
      : "Welcome to Rotahr",
    html: welcomeHtml((payload.first_name ?? "").trim(), payload.business_name?.trim()),
  });
}

/**
 * Marks a lead as converted so cold outreach stops chasing someone who has
 * already paid. Previously this called the dead Railway service; the lead list
 * now lives in Postgres, so it updates it directly.
 */
export async function triggerLeadConverted(email: string): Promise<void> {
  const e = email?.trim().toLowerCase();
  if (!e) return;
  try {
    await prisma.outreachLead.updateMany({
      where: { email: e },
      data: { status: "converted" },
    });
  } catch {
    // Never block a payment webhook on lead bookkeeping.
  }
}
