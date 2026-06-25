import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/prisma";
import OpenAI from "openai";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Get overstocked / recently received items
  const stockItems = await prisma.stockItem.findMany({
    where: {
      businessId: session.user.businessId,

      currentStock: { not: null },
    },
    select: { name: true, currentStock: true, reorderLevel: true, unit: true, category: true },
    orderBy: { currentStock: "desc" },
    take: 30,
  });

  if (stockItems.length === 0) {
    return NextResponse.json({
      suggestions: [],
      message: "No stock data found. Add stock levels to get AI suggestions.",
    });
  }

  const overstocked = stockItems.filter(
    (i) => i.currentStock !== null && i.reorderLevel !== null && i.currentStock! > i.reorderLevel! * 1.5
  );

  const itemsToUse = overstocked.length > 0 ? overstocked : stockItems.slice(0, 15);
  const itemsList = itemsToUse
    .map((i) => `${i.name} (${i.currentStock} ${i.unit}, category: ${i.category})`)
    .join(", ");

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a creative restaurant chef assistant. Given a list of available/overstocked ingredients, suggest 5 dishes that would make great daily specials or menu additions. Keep suggestions concise and practical for an Irish restaurant/pub. Return JSON array only.",
        },
        {
          role: "user",
          content: `Available/overstocked ingredients: ${itemsList}\n\nSuggest 5 dishes. Return as JSON array: [{"name":"dish name","description":"short description (1 sentence)","category":"starter|main|dessert|sides","usesIngredients":["ingredient1","ingredient2"]}]`,
        },
      ],
      temperature: 0.8,
      max_tokens: 800,
    });

    const raw = completion.choices[0].message.content ?? "[]";
    const clean = raw.replace(/```json|```/g, "").trim();
    const suggestions = JSON.parse(clean);

    return NextResponse.json({ suggestions, basedOn: itemsToUse.map((i) => i.name) });
  } catch (err: unknown) {
    console.error("AI suggestions error:", err);
    return NextResponse.json(
      { error: "AI unavailable", suggestions: [] },
      { status: 500 }
    );
  }
}
