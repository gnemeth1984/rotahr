// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { requirePermission, isResponse } from "@/lib/auth/middleware";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/db";
import OpenAI from "openai";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = await requirePermission("stocktaking");
  if (isResponse(session)) return session;
  const businessId = session.user.businessId!;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OPENAI_API_KEY not set" }, { status: 500 });
    }

    const fileBuffer = await file.arrayBuffer();
    const mimeType = file.type || "image/jpeg";
    const base64Image = Buffer.from(fileBuffer).toString("base64");

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Run blob upload + DB fetch in parallel with AI call
    const [blob, existingItems, aiResponse] = await Promise.all([
      put(`stock-receipts/${Date.now()}-${file.name}`, file, { access: "private" }),
      prisma.stockItem.findMany({
        where: { businessId },
        select: { id: true, name: true, unit: true, lastPrice: true },
      }),
      openai.chat.completions.create({
        model: "gpt-4o",
        response_format: { type: "json_object" },
        messages: [{
          role: "user",
          content: [
            { type: "text", text: `Extract every line item from this supplier invoice. Return ONLY valid JSON:\n{"vendor":"string or null","invoiceDate":"YYYY-MM-DD or null","invoiceTotal":null,"items":[{"name":"string","quantity":1,"unit":"unit","unitPrice":null}]}\nUnits must be one of: unit, kg, g, litre, ml, case, box, bottle, pack, pcs\nUse null for any field you cannot read.` },
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Image}`, detail: "high" } },
          ],
        }],
        max_tokens: 4000,
        temperature: 0,
      }),
    ]);

    const content = aiResponse.choices?.[0]?.message?.content ?? "{}";
    console.log("[scan-receipt] response:", content.slice(0, 300));

    let aiData: any = {};
    try { aiData = JSON.parse(content); } catch { aiData = {}; }

    const suggestions = (aiData.items ?? []).map((item: any) => {
      const match = existingItems.find(
        (e) =>
          e.name.toLowerCase().includes((item.name ?? "").toLowerCase().slice(0, 6)) ||
          (item.name ?? "").toLowerCase().includes(e.name.toLowerCase().slice(0, 6))
      );
      return {
        name: item.name,
        quantity: item.quantity ?? 1,
        unit: item.unit ?? "unit",
        unitPrice: item.unitPrice ?? null,
        existingItemId: match?.id ?? null,
        existingName: match?.name ?? null,
        existingPrice: match?.lastPrice ?? null,
        priceChanged: !!(match && item.unitPrice != null && match.lastPrice !== item.unitPrice),
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
    console.error("[scan-receipt] error:", err);
    return NextResponse.json({ error: err.message ?? "Scan failed" }, { status: 500 });
  }
}
