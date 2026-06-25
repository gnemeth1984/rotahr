// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { requirePermission, isResponse } from "@/lib/auth/middleware";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/db";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = await requirePermission("stocktaking");
  if (isResponse(session)) return session;

  const businessId = session.user.businessId!;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const fileBuffer = await file.arrayBuffer();
    const mimeType = file.type || "image/jpeg";

    // Upload to Vercel Blob (do in parallel with AI)
    const blobPromise = put(`stock-receipts/${Date.now()}-${file.name}`, file, { access: "private" });

    // Load existing stock items for matching
    const existingItems = await prisma.stockItem.findMany({
      where: { businessId },
      select: { id: true, name: true, unit: true, lastPrice: true, supplierId: true, supplier: { select: { name: true } } },
    });
    const existingNames = existingItems.map((e) => e.name).join(", ");

    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      const blob = await blobPromise;
      return NextResponse.json({ url: blob.url, suggestions: [], error: "OPENAI_API_KEY not set" });
    }

    // Compress: cap base64 at ~1MB — resize large images client-side isn't possible server-side
    // but we can send as "auto" detail and let OpenAI decide
    const base64Image = Buffer.from(fileBuffer).toString("base64");

    const prompt = `You are a stock management assistant for a hospitality business. Scan this supplier invoice/delivery note/receipt and extract every line item.

Return ONLY valid JSON — no markdown, no explanation, no extra text. Exactly this format:
{"vendor":"name or null","invoiceDate":"YYYY-MM-DD or null","invoiceTotal":0,"items":[{"name":"product name","quantity":1,"unit":"unit","unitPrice":0}]}

Units must be one of: unit, kg, g, litre, ml, case, box, bottle, pack, pcs
Existing stock items to help normalise names: ${existingNames || "none yet"}
Extract every line item visible. Use null for any field you cannot read.`;

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
              { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Image}`, detail: "auto" } },
            ],
          },
        ],
        max_tokens: 4000,
        temperature: 0,
        response_format: { type: "json_object" },
      }),
    });

    const [blob, aiJson] = await Promise.all([blobPromise, aiRes.json()]);

    const content = aiJson.choices?.[0]?.message?.content ?? "";
    console.log("[scan-receipt] raw:", content.slice(0, 300));

    let aiData: any = {};
    try {
      aiData = JSON.parse(content);
    } catch {
      // regex fallback
      const vendorMatch = content.match(/"vendor"\s*:\s*"([^"]*)"/);
      const dateMatch = content.match(/"invoiceDate"\s*:\s*"([^"]*)"/);
      const totalMatch = content.match(/"invoiceTotal"\s*:\s*([\d.]+)/);
      const itemsMatch = content.match(/"items"\s*:\s*(\[[\s\S]*)/);
      let items: any[] = [];
      if (itemsMatch) {
        let raw = itemsMatch[1];
        const open = (raw.match(/\{/g) || []).length - (raw.match(/\}/g) || []).length;
        raw += "}".repeat(Math.max(0, open)) + "]";
        try { items = JSON.parse(raw); } catch { items = []; }
      }
      aiData = { vendor: vendorMatch?.[1], invoiceDate: dateMatch?.[1] ?? null, invoiceTotal: totalMatch ? parseFloat(totalMatch[1]) : null, items };
    }

    const suggestions = (aiData.items ?? []).map((item: any) => {
      const match = existingItems.find(
        (e) =>
          e.name.toLowerCase().includes(item.name?.toLowerCase().slice(0, 6) ?? "") ||
          item.name?.toLowerCase().includes(e.name.toLowerCase().slice(0, 6))
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

    console.log("[scan-receipt] suggestions:", suggestions.length);

    return NextResponse.json({
      url: blob.url,
      vendor: aiData.vendor ?? null,
      invoiceDate: aiData.invoiceDate ?? null,
      invoiceTotal: aiData.invoiceTotal ?? null,
      suggestions,
    });
  } catch (err: any) {
    console.error("[scan-receipt] error:", err);
    return NextResponse.json({ error: err.message ?? "Scan failed" }, { status: 500 });
  }
}
