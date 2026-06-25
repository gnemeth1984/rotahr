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

    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      return NextResponse.json({ url: blob.url, suggestions: [], error: "OPENAI_API_KEY not set" });
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

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Image}`, detail: "high" } },
            ],
          },
        ],
        max_tokens: 4000,
        temperature: 0.1,
      }),
    });

    const aiJson = await aiRes.json();
    const content = aiJson.choices?.[0]?.message?.content ?? "";
    const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    // Safe JSON parse — attempt to recover truncated JSON
    try {
      aiData = JSON.parse(cleaned);
    } catch {
      // Try to extract partial items array if truncated
      const vendorMatch = cleaned.match(/"vendor"\s*:\s*"([^"]*)"/);
      const dateMatch = cleaned.match(/"invoiceDate"\s*:\s*"([^"]*)"/);
      const totalMatch = cleaned.match(/"invoiceTotal"\s*:\s*([\d.]+)/);
      const itemsMatch = cleaned.match(/"items"\s*:\s*(\[[\s\S]*)/);
      let items: any[] = [];
      if (itemsMatch) {
        // Try parsing whatever we got of the array, closing it if truncated
        let raw = itemsMatch[1];
        // Close any open object and the array
        const openBraces = (raw.match(/\{/g) || []).length - (raw.match(/\}/g) || []).length;
        raw += "}".repeat(Math.max(0, openBraces)) + "]";
        try { items = JSON.parse(raw); } catch { items = []; }
      }
      aiData = {
        vendor: vendorMatch?.[1] ?? undefined,
        invoiceDate: dateMatch?.[1] ?? null,
        invoiceTotal: totalMatch ? parseFloat(totalMatch[1]) : null,
        items,
      };
    }

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
