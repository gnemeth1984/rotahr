// @ts-nocheck
import { Resend } from "resend";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY ?? "re_placeholder");
}

export async function sendTimeOffStatusEmail({
  to,
  name,
  status,
  startDate,
  endDate,
}: {
  to: string;
  name: string;
  status: "APPROVED" | "REJECTED";
  startDate: Date;
  endDate: Date;
}) {
  const resend = getResend();
  const statusColor = status === "APPROVED" ? "#22c55e" : "#ef4444";
  const statusText = status === "APPROVED" ? "Approved ✅" : "Rejected ❌";

  await resend.emails.send({
    from: process.env.EMAIL_FROM ?? "sales@rotahr.com",
    to,
    subject: `Time Off Request ${statusText} — Rotahr`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #1e293b;">Time Off Request Update</h1>
        <p>Hi ${name},</p>
        <p>Your time off request has been <strong style="color: ${statusColor};">${status.toLowerCase()}</strong>.</p>
        <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0;"><strong>From:</strong> ${startDate.toLocaleDateString("en-IE", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
          <p style="margin: 8px 0 0;"><strong>To:</strong> ${endDate.toLocaleDateString("en-IE", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
        </div>
        <p>Log in to <a href="${process.env.NEXTAUTH_URL}">Rotahr</a> to view your schedule.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0;" />
        <p style="font-size: 12px; color: #94a3b8;">Rotahr — Workforce Management</p>
      </div>
    `,
  });
}

export async function sendNewTimeOffRequestEmail({
  to,
  managerName,
  employeeName,
  startDate,
  endDate,
  reason,
}: {
  to: string;
  managerName: string;
  employeeName: string;
  startDate: Date;
  endDate: Date;
  reason?: string;
}) {
  const resend = getResend();
  await resend.emails.send({
    from: process.env.EMAIL_FROM ?? "sales@rotahr.com",
    to,
    subject: `New Time Off Request — ${employeeName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #1e293b;">New Time Off Request</h1>
        <p>Hi ${managerName},</p>
        <p><strong>${employeeName}</strong> has submitted a time off request that requires your approval.</p>
        <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0;"><strong>From:</strong> ${startDate.toLocaleDateString("en-IE", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
          <p style="margin: 8px 0 0;"><strong>To:</strong> ${endDate.toLocaleDateString("en-IE", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
          ${reason ? `<p style="margin: 8px 0 0;"><strong>Reason:</strong> ${reason}</p>` : ""}
        </div>
        <a href="${process.env.NEXTAUTH_URL}/dashboard" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 8px;">Review Request</a>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0;" />
        <p style="font-size: 12px; color: #94a3b8;">Rotahr — Workforce Management</p>
      </div>
    `,
  });
}
