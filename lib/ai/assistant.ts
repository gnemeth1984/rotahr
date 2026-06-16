// @ts-nocheck
import { prisma } from "@/lib/db";
import { Resend } from "resend";
import * as chrono from "chrono-node";

function getResend() { return new Resend(process.env.RESEND_API_KEY ?? "re_placeholder"); }

export interface BookingContext {
  userId: string;
  userName: string;
  userEmail: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-IE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-IE", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

/**
 * Parse "11-19:30", "11:00-19:30", "11am-7:30pm", "11 to 19:30" etc.
 * Returns { startTime, endTime } as "HH:MM" strings or null.
 */
function parseTimeRange(msg: string): { startTime: string; endTime: string } | null {
  // Normalise
  const s = msg
    .replace(/\bfrom\b/gi, "")
    .replace(/\buntil\b/gi, "-")
    .replace(/\bto\b/gi, "-")
    .replace(/\btill\b/gi, "-")
    .trim();

  // Match patterns like:
  //   11-19:30 | 11:00-19:30 | 8:30-12:30 | 11am-7:30pm | 16-20:30
  const rangeRe =
    /(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*[-–]\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i;
  const match = s.match(rangeRe);
  if (!match) return null;

  const parseOnePart = (part: string): string | null => {
    part = part.trim();
    const ampm = /am|pm/i.test(part);
    const ref = new Date(2000, 0, 1); // fixed reference date
    const parsed = chrono.parseDate(part, ref);
    if (parsed) return formatTime(parsed);

    // Plain "16" or "8" — treat as 24h
    const plain = part.match(/^(\d{1,2})(?::(\d{2}))?$/);
    if (plain) {
      const h = parseInt(plain[1]);
      const m = plain[2] ? parseInt(plain[2]) : 0;
      if (h >= 0 && h <= 23) {
        return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      }
    }
    return null;
  };

  const startTime = parseOnePart(match[1]);
  const endTime = parseOnePart(match[2]);
  if (!startTime || !endTime) return null;
  return { startTime, endTime };
}

/**
 * Parse multiple shift entries from a single message.
 * e.g. "book me tomorrow 11-19:30, wednesday same, friday 8:30-12:30"
 */
interface ShiftEntry {
  date: Date;
  startTime: string;
  endTime: string;
}

function parseMultipleShifts(message: string, now: Date): ShiftEntry[] {
  const results: ShiftEntry[] = [];

  // Split on commas, "and", or "for X" patterns
  const segments = message
    .split(/,|\band\b/i)
    .map((s) => s.trim())
    .filter(Boolean);

  let lastTimeRange: { startTime: string; endTime: string } | null = null;

  for (const seg of segments) {
    // Try to find dates in this segment
    const parsed = chrono.parse(seg, now, { forwardDate: true });

    // Try to find time range in this segment
    const segTimeRange = parseTimeRange(seg);
    const timeRange: { startTime: string; endTime: string } | null = segTimeRange ?? lastTimeRange;
    if (timeRange) lastTimeRange = timeRange;

    if (parsed.length > 0 && timeRange) {
      for (const p of parsed) {
        results.push({
          date: p.start.date(),
          startTime: timeRange.startTime,
          endTime: timeRange.endTime,
        });
      }
    } else if (parsed.length > 0 && lastTimeRange) {
      // "same" / no time mentioned — inherit last time
      for (const p of parsed) {
        results.push({
          date: p.start.date(),
          startTime: lastTimeRange.startTime,
          endTime: lastTimeRange.endTime,
        });
      }
    }
  }

  return results;
}

// ─── Main intent classifier ──────────────────────────────────────────────────

function intent(msg: string) {
  const l = msg.toLowerCase();
  return {
    isGreeting: /\b(hi|hello|hey|good morning|good afternoon)\b/.test(l),
    isScheduleQuery:
      /\b(my shifts|my schedule|upcoming|what.*shift|when.*work)\b/.test(l),
    isTimeOff:
      /\b(time off|leave|vacation|day off|holiday|annual leave)\b/.test(l),
    isBooking:
      /\b(book|schedule|add|create|put me in|cover|shift)\b/.test(l),
    isHelp: /\b(help|what can you|what do you|capabilities)\b/.test(l),
  };
}

// ─── Main function ───────────────────────────────────────────────────────────

export async function generateBookingResponse(
  message: string,
  context: BookingContext
): Promise<string> {
  const now = new Date();
  const { isGreeting, isScheduleQuery, isTimeOff, isBooking, isHelp } =
    intent(message);

  // ── Greeting ──
  if (isGreeting) {
    return `Hello ${context.userName}! I'm your Rotahr assistant. I can:\n\n• **Book shifts** — e.g. "Book me tomorrow 11-19:30"\n• **Check your schedule** — "Show my upcoming shifts"\n• **Time off** — "How do I request time off?"\n\nWhat do you need?`;
  }

  // ── Help ──
  if (isHelp) {
    return `Here's what I can do:\n\n• **Book a single shift** — "Book me June 20 from 9am to 5pm"\n• **Book multiple shifts** — "Book me tomorrow 11-19:30, Wednesday same, Friday 8:30-12:30"\n• **Check your shifts** — "Show my upcoming shifts"\n• **Time off info** — "How do I request time off?"\n\nJust talk naturally — I'll figure out the dates and times.`;
  }

  // ── Schedule query ──
  if (isScheduleQuery) {
    const bookings = await prisma.booking.findMany({
      where: {
        userId: context.userId,
        date: { gte: now },
        status: "CONFIRMED",
      },
      orderBy: { date: "asc" },
      take: 10,
    });

    if (bookings.length === 0) {
      return "You have no upcoming shifts scheduled. Would you like to book one?";
    }

    const list = bookings
      .map((b) => `• **${formatDate(new Date(b.date))}** — ${b.startTime} to ${b.endTime}`)
      .join("\n");

    return `Here are your upcoming shifts:\n\n${list}\n\nWant to book more or make changes?`;
  }

  // ── Time off ──
  if (isTimeOff) {
    return `To request time off:\n\n1. Go to **Time Off** in the sidebar\n2. Click **New Request**\n3. Pick your dates and add a reason\n4. Submit — your manager will be notified\n\nYou'll get an email once it's approved or declined.`;
  }

  // ── Booking ──
  if (isBooking) {
    const shifts = parseMultipleShifts(message, now);

    if (shifts.length === 0) {
      // Try to extract just a time range without dates
      const timeRange = parseTimeRange(message);
      if (!timeRange) {
        return `I can book that shift! Just tell me:\n\n• **What date(s)?** (e.g. "tomorrow", "Monday", "June 20")\n• **What time?** (e.g. "11-19:30" or "9am to 5pm")`;
      }
      return `Got the time **${timeRange.startTime}–${timeRange.endTime}**. Which date(s) should I book?`;
    }

    // Create all bookings
    const created: ShiftEntry[] = [];
    const failed: ShiftEntry[] = [];

    for (const shift of shifts) {
      try {
        await prisma.booking.create({
          data: {
            userId: context.userId,
            date: shift.date,
            startTime: shift.startTime,
            endTime: shift.endTime,
            title: "Shift (AI Booked)",
            notes: `Booked via AI assistant: "${message}"`,
          },
        });
        created.push(shift);
      } catch {
        failed.push(shift);
      }
    }

    // Notify managers
    if (created.length > 0 && process.env.RESEND_API_KEY) {
      try {
        const managers = await prisma.user.findMany({
          where: { role: { in: ["MANAGER", "ADMIN"] } },
          select: { email: true },
        });
        const emails = managers.map((m) => m.email).filter(Boolean) as string[];
        if (emails.length > 0) {
          const shiftRows = created
            .map(
              (s) =>
                `<li>${formatDate(s.date)}: ${s.startTime}–${s.endTime}</li>`
            )
            .join("");
          await getResend().emails.send({
            from: process.env.EMAIL_FROM ?? "noreply@rotahr.app",
            to: emails,
            subject: `New Shift(s) Booked — ${context.userName}`,
            html: `<h2>New Shift Booking</h2><p><strong>${context.userName}</strong> booked via AI assistant:</p><ul>${shiftRows}</ul>`,
          });
        }
      } catch {
        // Email failure is non-critical
      }
    }

    if (created.length === 0) {
      return `❌ I couldn't create any of those bookings. Please try the **Bookings** section directly.`;
    }

    const list = created
      .map((s) => `• **${formatDate(s.date)}** — ${s.startTime}–${s.endTime}`)
      .join("\n");

    const failNote =
      failed.length > 0
        ? `\n\n⚠️ ${failed.length} shift(s) couldn't be created — please add them manually.`
        : "";

    return `✅ **${created.length} shift${created.length > 1 ? "s" : ""} booked!**\n\n${list}${failNote}\n\nYour manager has been notified. Anything else?`;
  }

  // ── Fallback ──
  return `I can help with shifts and scheduling. Try:\n\n• **"Book me tomorrow 11-19:30"**\n• **"Show my upcoming shifts"**\n• **"Book me Mon 9-5, Tue 9-5, Wed 10-6"**\n\nWhat do you need?`;
}
