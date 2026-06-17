// @ts-nocheck
import { Resend } from "resend";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY ?? "re_placeholder");
}

export async function sendShiftReminderEmail({
  to,
  employeeName,
  shiftDate,
  startTime,
  endTime,
  role,
}: {
  to: string;
  employeeName: string;
  shiftDate: Date;
  startTime: Date;
  endTime: Date;
  role?: string | null;
}) {
  const resend = getResend();

  const dateStr = shiftDate.toLocaleDateString("en-IE", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const startStr = startTime.toLocaleTimeString("en-IE", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const endStr = endTime.toLocaleTimeString("en-IE", {
    hour: "2-digit",
    minute: "2-digit",
  });

  await resend.emails.send({
    from: process.env.EMAIL_FROM ?? "noreply@rotahr.app",
    to,
    subject: `Shift Reminder for Tomorrow — ${dateStr}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <div style="background: #1e293b; padding: 24px; border-radius: 12px 12px 0 0;">
          <h1 style="color: #60a5fa; margin: 0; font-size: 20px;">⏰ Shift Reminder</h1>
        </div>
        <div style="background: #f8fafc; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0; border-top: none;">
          <p style="color: #475569; margin-top: 0;">Hi <strong>${employeeName}</strong>,</p>
          <p style="color: #475569;">You have a shift tomorrow. Here are the details:</p>
          <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Date</td>
                <td style="padding: 8px 0; font-weight: 600; color: #1e293b;">${dateStr}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Start</td>
                <td style="padding: 8px 0; font-weight: 600; color: #22c55e;">${startStr}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">End</td>
                <td style="padding: 8px 0; font-weight: 600; color: #ef4444;">${endStr}</td>
              </tr>
              ${role ? `
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Role</td>
                <td style="padding: 8px 0; font-weight: 600; color: #1e293b;">${role}</td>
              </tr>` : ""}
            </table>
          </div>
          <a href="${process.env.NEXTAUTH_URL ?? "https://rotahr.app"}/clock" 
             style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">
            View My Schedule
          </a>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0 16px;" />
          <p style="font-size: 12px; color: #94a3b8; margin: 0;">
            Rotahr — Workforce Management | You're receiving this because you have a shift tomorrow.
          </p>
        </div>
      </div>
    `,
  });
}
