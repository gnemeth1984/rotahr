// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/prisma";
import { put } from "@vercel/blob";
import OpenAI from "openai";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user?.businessId) return NextResponse.json({ error: "No business" }, { status: 400 });
  if (user.role !== "MANAGER" && user.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const supplierId = formData.get("supplierId") as string | null;
    const fileName = file?.name ?? "statement";

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    // 1. Convert to base64 for OpenAI
    const fileBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(fileBuffer).toString("base64");
    const mimeType = file.type || "image/jpeg";
    const dataUri = `data:${mimeType};base64,${base64}`;

    // 2. Upload to Vercel Blob (private)
    const blob = await put(`stock-receipts/${Date.now()}-${fileName}`, file, { access: "private" });

    // 3. AI extract line items
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
              { type: "image_url", image_url: { url: dataUri, detail: "high" } },
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
      // AI failed — statement saved without parsing
    }

    // 4. Auto-match against open supplier orders
    const openOrder = await prisma.supplierOrder.findFirst({
      where: {
        businessId: user.businessId,
        ...(supplierId ? { supplierId } : {}),
        status: { in: ["draft", "sent"] },
      },
      include: { items: { include: { stockItem: true } } },
      orderBy: { createdAt: "desc" },
    });

    let status = "pending";
    let matchedOrderId: string | null = null;

    if (openOrder && aiExtracted.length > 0) {
      const orderItemNames = openOrder.items.map((i: any) => i.stockItem.name.toLowerCase());
      const matches = (aiExtracted as any[]).filter((li) =>
        orderItemNames.some((n: string) => n.includes((li.description ?? "").toLowerCase().substring(0, 6)))
      );
      const matchRate = matches.length / Math.max(aiExtracted.length, 1);
      status = matchRate > 0.6 ? "matched" : "discrepancy";
      matchedOrderId = openOrder.id;
    }

    // 5. Save statement
    const statement = await prisma.supplierStatement.create({
      data: {
        businessId: user.businessId,
        supplierId: supplierId || null,
        matchedOrderId: matchedOrderId || null,
        fileUrl: blob.url,
        fileName,
        status,
        aiExtracted: aiExtracted as object[],
        totalAmount,
        invoiceRef,
      },
    });

    return NextResponse.json({ statement, matchedOrder: openOrder }, { status: 201 });
  } catch (err: any) {
    console.error("[statements/upload]", err);
    return NextResponse.json({ error: err?.message ?? "Upload failed" }, { status: 500 });
  }
}
