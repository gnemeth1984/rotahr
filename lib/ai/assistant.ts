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
  const s = msg
    .replace(/\bfrom\b/gi, "")
    .replace(/\buntil\b/gi, "-")
    .replace(/\bto\b/gi, "-")
    .replace(/\btill\b/gi, "-")
    .trim();

  const rangeRe =
    /(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*[-–]\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i;
  const match = s.match(rangeRe);
  if (!match) return null;

  const parseOnePart = (part: string): string | null => {
    part = part.trim();
    const ref = new Date(2000, 0, 1);
    const parsed = chrono.parseDate(part, ref);
    if (parsed) return formatTime(parsed);

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

interface ShiftEntry {
  date: Date;
  startTime: string;
  endTime: string;
}

function parseMultipleShifts(message: string, now: Date): ShiftEntry[] {
  const results: ShiftEntry[] = [];

  const segments = message
    .split(/,|\band\b/i)
    .map((s) => s.trim())
    .filter(Boolean);

  let lastTimeRange: { startTime: string; endTime: string } | null = null;

  for (const seg of segments) {
    const parsed = chrono.parse(seg, now, { forwardDate: true });
    const segTimeRange = parseTimeRange(seg);
    const timeRange = segTimeRange ?? lastTimeRange;
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
    return `Hello ${context.userName}! I'm your Rotahr assistant. I can:\n\n• **Check your schedule** — "Show my upcoming shifts"\n• **Time off** — "How do I request time off?"\n• **Bookings help** — guide you to the right page\n\nWhat do you need?`;
  }

  // ── Help ──
  if (isHelp) {
    return `Here's what I can do:\n\n• **Check your shifts** — "Show my upcoming shifts"\n• **Time off info** — "How do I request time off?"\n• **Bookings** — managers can use the AI Assist button on the Bookings page\n• **Staffing** — managers can view the AI Staffing page\n\nJust talk naturally — I'll point you in the right direction.`;
  }

  // ── Schedule query ──
  if (isScheduleQuery) {
    // Find the employee linked to this user
    const employee = await prisma.employee.findFirst({
      where: { userId: context.userId },
      select: { id: true },
    });

    if (!employee) {
      return "I couldn't find an employee record linked to your account. Please contact your manager.";
    }

    const shifts = await prisma.shift.findMany({
      where: {
        employeeId: employee.id,
        date: { gte: now },
        published: true,
      },
      orderBy: { date: "asc" },
      take: 10,
    });

    if (shifts.length === 0) {
      return "You have no upcoming published shifts scheduled. Check back after your manager publishes the schedule.";
    }

    const list = shifts
      .map((s) => {
        const d = new Date(s.date);
        const start = new Date(s.startTime);
        const end = new Date(s.endTime);
        return `• **${formatDate(d)}** — ${formatTime(start)} to ${formatTime(end)}${s.role ? ` (${s.role})` : ""}`;
      })
      .join("\n");

    return `Here are your upcoming shifts:\n\n${list}\n\nAnything else you need?`;
  }

  // ── Time off ──
  if (isTimeOff) {
    return `To request time off:\n\n1. Go to **Time Off** in the sidebar\n2. Click **New Request**\n3. Pick your dates and add a reason\n4. Submit — your manager will be notified\n\nYou'll get an email once it's approved or declined.`;
  }

  // ── Booking (shift booking request) ──
  if (isBooking) {
    const shifts = parseMultipleShifts(message, now);

    if (shifts.length === 0) {
      const timeRange = parseTimeRange(message);
      if (!timeRange) {
        return `Shift booking is handled by your manager. You can:\n\n• **View your schedule** — "Show my upcoming shifts"\n• **Request time off** — go to the Time Off section\n• **Contact your manager** to request specific shifts`;
      }
      return `Got the time **${timeRange.startTime}–${timeRange.endTime}**. Shift requests go through your manager — head to the **Rota** page to see your schedule.`;
    }

    // Shifts are manager-controlled — guide employee to the right process
    const list = shifts
      .map((s) => `• **${formatDate(s.date)}** — ${s.startTime}–${s.endTime}`)
      .join("\n");

    return `I can see you want shifts on:\n\n${list}\n\nShift scheduling is managed by your manager. If you have a preference, let them know directly or check the **Rota** page. Is there anything else I can help with?`;
  }

  // ── Fallback ──
  return `I can help with shifts and scheduling. Try:\n\n• **"Show my upcoming shifts"**\n• **"How do I request time off?"**\n\nWhat do you need?`;
}
