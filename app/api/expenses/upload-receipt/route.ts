// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { requirePermission, isResponse } from "@/lib/auth/middleware";
import { put } from "@vercel/blob";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = await requirePermission("bookkeeping");
  if (isResponse(session)) return session;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const fileBuffer = await file.arrayBuffer();
    const base64Image = Buffer.from(fileBuffer).toString("base64");
    const mimeType = file.type || "image/jpeg";

    // Upload to Vercel Blob (private store)
    const blob = await put(`receipts/${Date.now()}-${file.name}`, file, {
      access: "private",
    });

    let aiData: {
      vendor?: string;
      date?: string;
      amount?: number;
      vatAmount?: number;
      category?: string;
      description?: string;
      paymentMethod?: string;
      rawText?: string;
    } = {};

    const openaiKey = process.env.OPENAI_API_KEY;

    if (openaiKey) {
      try {
        const prompt = `You are a bookkeeping assistant. Extract data from this receipt/invoice image and return ONLY valid JSON with these fields:
{
  "vendor": "business name on receipt",
  "date": "YYYY-MM-DD format",
  "amount": total amount as number (including VAT if shown),
  "vatAmount": VAT amount as number (0 if not shown),
  "category": one of: wages, supplier, food_beverage, utilities, equipment, general,
  "description": short description of what was purchased,
  "paymentMethod": one of: cash, card, bank_transfer, direct_debit (or null if unclear),
  "rawText": all text you can read from the receipt
}
Return ONLY the JSON object, no markdown, no explanation.`;

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
            max_tokens: 2000,
            temperature: 0,
            response_format: { type: "json_object" },
          }),
        });

        const aiJson = await aiRes.json();
        const content = aiJson.choices?.[0]?.message?.content ?? "";
        const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        try {
          aiData = JSON.parse(cleaned);
        } catch {
          // Partial extraction fallback
          const vendorMatch = cleaned.match(/"vendor"\s*:\s*"([^"]*)"/);
          const dateMatch = cleaned.match(/"date"\s*:\s*"([^"]*)"/);
          const amountMatch = cleaned.match(/"amount"\s*:\s*([\d.]+)/);
          const vatMatch = cleaned.match(/"vatAmount"\s*:\s*([\d.]+)/);
          const catMatch = cleaned.match(/"category"\s*:\s*"([^"]*)"/);
          const descMatch = cleaned.match(/"description"\s*:\s*"([^"]*)"/);
          aiData = {
            vendor: vendorMatch?.[1],
            date: dateMatch?.[1],
            amount: amountMatch ? parseFloat(amountMatch[1]) : undefined,
            vatAmount: vatMatch ? parseFloat(vatMatch[1]) : undefined,
            category: catMatch?.[1],
            description: descMatch?.[1],
          };
        }
      } catch (aiErr: any) {
        return NextResponse.json({
          url: blob.url,
          ai: {},
          aiError: aiErr?.message ?? "AI extraction failed",
        });
      }
    } else {
      return NextResponse.json({
        url: blob.url,
        ai: {},
        aiError: "OPENAI_API_KEY not set",
      });
    }

    const dataUri = `data:${mimeType};base64,${base64Image}`;

    return NextResponse.json({
      url: blob.url,
      dataUri,
      ai: aiData,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Upload failed" }, { status: 500 });
  }
}
