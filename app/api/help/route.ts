// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { z } from "zod";
import { findFAQAnswer, UserRole } from "@/lib/help/knowledge-base";

const schema = z.object({
  message: z.string().min(1).max(500),
});

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
  const message = parsed.data.message;

  // 1. Try static knowledge base first
  const faqAnswer = findFAQAnswer(message, role);
  if (faqAnswer) {
    return NextResponse.json({ response: faqAnswer, source: "faq" });
  }

  // 2. Fall back to OpenAI
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return NextResponse.json({
      response:
        "I don't have a specific answer for that. Try rephrasing, or contact your manager for help.\n\nYou can also ask me things like:\n• \"How do I request time off?\"\n• \"How does payroll work?\"\n• \"How do I publish the rota?\"",
      source: "fallback",
    });
  }

  try {
    const systemPrompt = `You are Rotahr Help, an in-app assistant that helps users understand how to use the Rotahr workforce management platform.

Rotahr is a hospitality workforce tool for Irish restaurants and bars. Features include:
- Rota/scheduling with Working Time Act 1997 compliance checks
- Time off requests with Irish statutory annual leave entitlement (8% of hours)
- Payroll summaries (gross only) with Irish NMW €13.50/hr warnings, BrightPay CSV export
- Bookings/reservations with AI staffing suggestions
- Tips management (Tips & Gratuities Act 2022 compliant)
- Employees management with role-based access (Admin / Manager / Staff)
- Menu Specials for announcements
- Messages/direct chat
- Expenses with AI receipt reading
- Settings (general, venue, AI assistant, billing)

The current user's role is: ${role}

Rules:
- Only answer questions about how to USE Rotahr features
- If asked about something unrelated to Rotahr, politely redirect: "I can only help with Rotahr features."
- Keep answers concise, use bullet points and bold text
- Use **bold** for UI element names
- If you're unsure, say so and suggest contacting their manager`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
        max_tokens: 400,
        temperature: 0.3,
      }),
    });

    if (!res.ok) throw new Error(`OpenAI ${res.status}`);
    const data = await res.json();
    const aiResponse = data.choices?.[0]?.message?.content ?? null;

    if (!aiResponse) throw new Error("Empty response");

    return NextResponse.json({ response: aiResponse, source: "ai" });
  } catch (err) {
    console.error("Help AI error:", err);
    return NextResponse.json({
      response:
        "I'm having trouble connecting right now. Try asking something like:\n• \"How do I request time off?\"\n• \"How does the rota work?\"\n• \"How do I export payroll?\"",
      source: "error",
    });
  }
}
