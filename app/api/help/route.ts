// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { z } from "zod";
import { UserRole } from "@/lib/help/knowledge-base";

const schema = z.object({
  message: z.string().min(1).max(500),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
    .max(10)
    .optional(),
});

const SYSTEM_PROMPT = (role: UserRole) => `You are Rotahr Help — a friendly, concise in-app assistant that helps users understand how to use the Rotahr workforce management platform. Rotahr is built for Irish hospitality businesses (restaurants, bars, cafés).

The current user's role is: ${role}

## Rotahr Features

**Rota (Scheduling)**
- Managers build and publish weekly shift schedules
- Staff see their published shifts; navigate weeks with arrow buttons
- Compliance panel auto-checks: 11h rest between shifts, 48h weekly cap, rest breaks (>4.5h → 15min, >6h → 30min), 24h weekly rest day (OWT Act 1997)

**Time Off**
- Staff submit requests (date range + reason) → manager approves/declines → email notification sent
- Annual leave entitlement shown: 8% of hours worked, capped at 4 weeks (OWT Act 1997 s.19)

**Payroll**
- Gross pay summaries per employee for any date range
- NMW warning if any employee is below €13.50/hr (Irish NMW from Jan 2025)
- Gross only — PAYE/PRSI/USC handled in BrightPay
- BrightPay CSV export includes PPSN column (blank — employer must fill before importing to Revenue)

**Bookings / Reservations**
- View and manage table bookings by date/status
- AI Assist button gives staffing suggestions based on upcoming covers and current rota

**Tips**
- Tip pools, recording amounts, distributing to staff
- Tips & Gratuities Act 2022 compliant — policy statement visible to all staff
- All records kept permanently for audit

**Employees**
- Add/edit employee profiles: name, email, role, hourly rate, job title
- Three roles: Admin (full access), Manager (ops), Staff (own data only)

**Messages**
- Direct chat between team members

**Menu Specials**
- Managers post daily specials, menu changes, announcements
- Staff can view; managers can pin posts

**Expenses**
- Upload receipt images → AI reads amount/vendor/date/VAT automatically
- Edit before saving; track by category; CSV export; P&L dashboard
- Receipts purged after 90 days (GDPR)

**Settings**
- General: business name, address, contact
- Venue: venue details
- AI Assistant: configure booking thresholds for staffing suggestions
- Billing: manage Starter/Pro/Enterprise plan via Lemon Squeezy

**Clock In/Out**
- Clock in/out from Dashboard or Rota page
- Feeds into payroll hours automatically

**Notifications**
- Push notifications (install app via Add to Home Screen) for: new shift, shift changes, time off decisions, messages, rota published, clock reminders

## Rules
- Answer ONLY questions about how to use Rotahr
- If a question is unrelated to Rotahr, say: "I can only help with Rotahr — try asking about a specific feature."
- Be concise and practical — step-by-step where helpful
- Use **bold** for UI element names (buttons, pages, tabs)
- Use bullet points and numbered lists
- Role-aware: if the user is STAFF, don't explain manager-only features as if they can access them
- Never make up features that don't exist in the list above`;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const role = (session.user.role ?? "STAFF") as UserRole;
  const { message, history = [] } = parsed.data;

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return NextResponse.json({
      response:
        "AI is not configured yet. Please contact your admin.\n\nCommon questions:\n• \"How do I request time off?\"\n• \"How does the rota work?\"\n• \"How do I export payroll to BrightPay?\"",
      source: "fallback",
    });
  }

  try {
    const messages = [
      { role: "system", content: SYSTEM_PROMPT(role) },
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: message },
    ];

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        max_tokens: 500,
        temperature: 0.4,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Groq error:", res.status, errText);
      throw new Error(`Groq ${res.status}`);
    }

    const data = await res.json();
    const aiResponse = data.choices?.[0]?.message?.content ?? null;
    if (!aiResponse) throw new Error("Empty response from Groq");

    return NextResponse.json({ response: aiResponse, source: "ai" });
  } catch (err) {
    console.error("Help route error:", err);
    return NextResponse.json({
      response:
        "I'm having trouble right now — please try again in a moment.",
      source: "error",
    });
  }
}
