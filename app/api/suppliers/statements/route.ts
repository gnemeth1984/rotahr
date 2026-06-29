import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/prisma";
import OpenAI from "openai";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

// Increase body size limit for base64 image payloads
export const fetchCache = "force-no-store";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user?.businessId) return NextResponse.json({ error: "No business" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const supplierId = searchParams.get("supplierId");

  const statements = await prisma.supplierStatement.findMany({
    where: {
      businessId: user.businessId,
      ...(supplierId ? { supplierId } : {}),
    },
    include: { supplier: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ statements });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user?.businessId) return NextResponse.json({ error: "No business" }, { status: 400 });
  const isManager = user.role === "MANAGER" || user.role === "ADMIN";
  if (!isManager) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { supplierId, fileUrl, fileName, dataUri } = body;
  if (!fileUrl || !fileName) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // ── AI extract line items ─────────────────────────────────────────────────
  let aiExtracted: unknown[] = [];
  let totalAmount: number | null = null;
  let invoiceRef: string | null = null;

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const prompt = `You are an invoice parser. Extract all line items from this supplier invoice/statement image.
Return a JSON object with:
{
  "invoiceRef": "invoice number or null",
  "invoiceDate": "date string or null",
  "totalAmount": number or null,
  "lineItems": [
    { "description": "item name", "sku": "sku or null", "qty": number, "unitPrice": number, "lineTotal": number }
  ]
}
Return only valid JSON, no markdown.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: dataUri ?? fileUrl } },
          ],
        },
      ],
      max_tokens: 2000,
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw.replace(/```json\n?|```/g, "").trim());
    aiExtracted = parsed.lineItems ?? [];
    totalAmount = parsed.totalAmount ?? null;
    invoiceRef = parsed.invoiceRef ?? null;
  } catch {
    // AI failed gracefully — statement is created but not parsed
  }

  // ── Auto-match against open supplier orders ───────────────────────────────
  const openOrder = await prisma.supplierOrder.findFirst({
    where: { businessId: user.businessId, ...(supplierId ? { supplierId } : {}), status: { in: ["draft", "sent"] } },
    include: { items: { include: { stockItem: true } } },
    orderBy: { createdAt: "desc" },
  });

  let status = "pending";
  let matchedOrderId: string | null = null;

  if (openOrder && aiExtracted.length > 0) {
    // Check if all AI line items roughly match order items
    const orderItemNames = openOrder.items.map((i) => i.stockItem.name.toLowerCase());
    type LineItem = { description?: string; sku?: string; qty?: number; unitPrice?: number; lineTotal?: number };
    const matches = (aiExtracted as LineItem[]).filter((li) =>
      orderItemNames.some((n) => n.includes((li.description ?? "").toLowerCase().substring(0, 6)))
    );
    const matchRate = matches.length / Math.max(aiExtracted.length, 1);
    status = matchRate > 0.6 ? "matched" : "discrepancy";
    matchedOrderId = openOrder.id;
  }

  const statement = await prisma.supplierStatement.create({
    data: {
      businessId: user.businessId,
      supplierId,
      fileUrl,
      fileName,
      status,
      aiExtracted: aiExtracted as object[],
      matchedOrderId,
      totalAmount,
      invoiceRef,
    },
  });

  return NextResponse.json({ statement, matchedOrder: openOrder }, { status: 201 });
}
