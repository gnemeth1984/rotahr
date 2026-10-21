import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email/send";
import { logActivity } from "@/lib/services/activity.service";
import { UserRole } from "@/types/roles";

/**
 * Staff invites.
 *
 * Inviting an employee creates (or re-uses) a User with role EMPLOYEE in the
 * same business, links it via Employee.userId, and emails a one-time
 * set-password link. The link reuses the PasswordResetToken table and the
 * existing /auth/reset-password page, so there is one token flow to maintain.
 *
 * Never links across tenants: if the email already belongs to a User in a
 * different business (or to an unattached account), the invite is refused.
 */

export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type InviteResult =
  | { ok: true; status: "sent" | "linked"; userId: string; email: string }
  | { ok: false; code: number; error: string };

function appBaseUrl(): string {
  const url = process.env.NEXTAUTH_URL;
  return url && !url.includes("localhost") ? url.replace(/\/+$/, "") : "https://rotahr.com";
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export async function inviteEmployee(args: {
  employeeId: string;
  businessId: string;
  invitedBy: { id: string; name?: string | null; email?: string | null };
}): Promise<InviteResult> {
  const { employeeId, businessId, invitedBy } = args;

  const emp = await prisma.employee.findFirst({
    where: { id: employeeId, businessId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      active: true,
      userId: true,
      business: { select: { name: true } },
    },
  });
  if (!emp) return { ok: false, code: 404, error: "Employee not found" };
  if (!emp.active) return { ok: false, code: 400, error: "Reactivate this employee before inviting them" };

  const email = emp.email.trim().toLowerCase();
  const fullName = `${emp.firstName} ${emp.lastName}`.trim();

  let userId: string;

  if (emp.userId) {
    const linked = await prisma.user.findUnique({
      where: { id: emp.userId },
      select: { id: true, email: true, businessId: true, password: true, lastLoginAt: true },
    });
    if (!linked || linked.businessId !== businessId) {
      return { ok: false, code: 409, error: "This employee is linked to an account outside your business" };
    }
    if (linked.password || linked.lastLoginAt) {
      return {
        ok: false,
        code: 409,
        error: "This employee already has an active login. They can use 'Forgot password' on the sign-in page.",
      };
    }
    // Pending invite and the manager has since corrected the email: move the
    // login email with it, if nobody else has it.
    if (linked.email.toLowerCase() !== email) {
      const taken = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (taken) return { ok: false, code: 409, error: "That email is already used by another Rotahr account" };
      await prisma.user.update({ where: { id: linked.id }, data: { email } });
    }
    userId = linked.id;
  } else {
    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true, businessId: true },
    });
    if (existing && existing.businessId !== businessId) {
      return {
        ok: false,
        code: 409,
        error: "That email already belongs to a Rotahr account in another business. Use a different email for this employee.",
      };
    }
    if (existing) {
      // Same business already (e.g. a manager who is also on the rota):
      // link without touching their role.
      userId = existing.id;
      await prisma.employee.update({ where: { id: emp.id }, data: { userId } });
    } else {
      const created = await prisma.$transaction(async (tx) => {
        const u = await tx.user.create({
          data: { email, name: fullName || null, role: UserRole.EMPLOYEE, businessId, password: null },
          select: { id: true },
        });
        await tx.employee.update({ where: { id: emp.id }, data: { userId: u.id } });
        return u;
      });
      userId = created.id;
    }

    // An existing same-business account that already has a login doesn't need
    // a set-password email.
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { password: true, lastLoginAt: true } });
    if (u?.password || u?.lastLoginAt) {
      return { ok: true, status: "linked", userId, email };
    }
  }

  // One live link at a time.
  await prisma.passwordResetToken.deleteMany({ where: { userId } });
  const token = randomBytes(32).toString("hex");
  await prisma.passwordResetToken.create({
    data: { token, userId, expiresAt: new Date(Date.now() + INVITE_TTL_MS) },
  });

  const link = `${appBaseUrl()}/auth/reset-password?token=${token}&invite=1`;
  const bizName = escapeHtml(emp.business?.name ?? "your team");
  const inviter = escapeHtml(invitedBy.name || "Your manager");
  const first = escapeHtml(emp.firstName || "there");

  const sent = await sendEmail({
    context: "staff-invite",
    to: email,
    subject: `${emp.business?.name ?? "Your team"} invited you to Rotahr`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;">
        <h2 style="color:#1e293b;margin-bottom:8px;">Hi ${first},</h2>
        <p style="color:#475569;margin-bottom:16px;">${inviter} has added you to <strong>${bizName}</strong> on Rotahr.
        Set a password to see your shifts, clock in and out, swap shifts and request time off from your phone.</p>
        <a href="${link}" style="display:inline-block;background:#2563eb;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Set up my account</a>
        <p style="color:#94a3b8;font-size:12px;margin-top:24px;">This link works once and expires in 7 days. Your sign-in email is ${escapeHtml(email)}.
        If you weren't expecting this, you can ignore it.</p>
      </div>
    `,
    text: `Hi ${emp.firstName || "there"},\n\n${invitedBy.name || "Your manager"} has added you to ${emp.business?.name ?? "your team"} on Rotahr.\n\nSet your password (link expires in 7 days):\n${link}\n\nYour sign-in email is ${email}.`,
  });

  if (!sent.ok) {
    await prisma.passwordResetToken.deleteMany({ where: { userId } });
    console.error("[staff-invite] email failed for employee", emp.id, "-", sent.error);
    return { ok: false, code: 502, error: "We couldn't send the invite email. Check the address and try again." };
  }

  logActivity({
    businessId,
    userId: invitedBy.id,
    userName: invitedBy.name || invitedBy.email || null,
    action: "staff_invited",
    details: { employeeId: emp.id },
  }).catch(() => {});

  return { ok: true, status: "sent", userId, email };
}
