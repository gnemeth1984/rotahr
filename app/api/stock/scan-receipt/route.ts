// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { requirePermission, isResponse } from "@/lib/auth/middleware";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await requirePermission("stocktaking");
  if (isResponse(session)) return session;

  const businessId = session.user.businessId!;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    // Read bytes for AI
    const fileBuffer = await file.arrayBuffer();
    const base64Image = Buffer.from(fileBuffer).toString("base64");
    const mimeType = file.type || "image/jpeg";

    // Upload to Vercel Blob
    const blob = await put(`stock-receipts/${Date.now()}-${file.name}`, file, {
      access: "private",
    });

    // Load existing stock items for matching
    const existingItems = await prisma.stockItem.findMany({
      where: { businessId },
      select: { id: true, name: true, unit: true, lastPrice: true, supplierId: true, supplier: { select: { name: true } } },
    });

    const existingNames = existingItems.map((e) => e.name).join(", ");

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return NextResponse.json({ url: blob.url, suggestions: [], error: "GEMINI_API_KEY not set" });
    }

    const prompt = `You are a stock management assistant for a hospitality business. Scan this supplier invoice/delivery note/receipt and extract every line item.

Return ONLY valid JSON (no markdown, no explanation) in this exact format:
{
  "vendor": "supplier or company name if visible",
  "invoiceDate": "YYYY-MM-DD if visible, else null",
  "invoiceTotal": total amount as number if visible else null,
  "items": [
    {
      "name": "product name (clean, concise)",
      "quantity": number,
      "unit": one of: unit, kg, g, litre, ml, case, box, bottle, pack, pcs,
      "unitPrice": price per unit as number or null if not clear
    }
  ]
}

Existing stock items in the system (use these to help normalise names): ${existingNames || "none yet"}

Extract every line item you can see. If you can't read a field, use null.`;

    let aiData: {
      vendor?: string;
      invoiceDate?: string | null;
      invoiceTotal?: number | null;
      items?: Array<{ name: string; quantity: number; unit: string; unitPrice: number | null }>;
    } = {};

    const aiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                { inline_data: { mime_type: mimeType, data: base64Image } },
              ],
            },
          ],
          generationConfig: { maxOutputTokens: 1200, temperature: 0.1 },
        }),
      }
    );

    const aiJson = await aiRes.json();
    const content = aiJson.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    aiData = JSON.parse(cleaned);

    // Match each AI item to existing stock
    const suggestions = (aiData.items ?? []).map((item) => {
      const match = existingItems.find(
        (e) =>
          e.name.toLowerCase().includes(item.name.toLowerCase().slice(0, 6)) ||
          item.name.toLowerCase().includes(e.name.toLowerCase().slice(0, 6))
      );
      return {
        name: item.name,
        quantity: item.quantity ?? 1,
        unit: item.unit ?? "unit",
        unitPrice: item.unitPrice ?? null,
        existingItemId: match?.id ?? null,
        existingName: match?.name ?? null,
        existingPrice: match?.lastPrice ?? null,
        priceChanged: !!(match && item.unitPrice !== null && match.lastPrice !== item.unitPrice),
      };
    });

    return NextResponse.json({
      url: blob.url,
      vendor: aiData.vendor ?? null,
      invoiceDate: aiData.invoiceDate ?? null,
      invoiceTotal: aiData.invoiceTotal ?? null,
      suggestions,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Scan failed" }, { status: 500 });
  }
}
