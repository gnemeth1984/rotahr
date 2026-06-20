// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { requirePermission, isResponse } from "@/lib/auth/middleware";
import { put } from "@vercel/blob";

export async function POST(req: NextRequest) {
  const session = await requirePermission("bookkeeping");
  if (isResponse(session)) return session;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    // Read file bytes and convert to base64 BEFORE uploading
    const fileBuffer = await file.arrayBuffer();
    const base64Image = Buffer.from(fileBuffer).toString("base64");
    const mimeType = file.type || "image/jpeg";

    // Upload to Vercel Blob (private store)
    const blob = await put(`receipts/${Date.now()}-${file.name}`, file, {
      access: "private",
    });

    // AI extraction via OpenAI GPT-4o vision (uses base64 — no public URL needed)
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

    if (process.env.OPENAI_API_KEY) {
      try {
        const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o",
            max_tokens: 800,
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: `You are a bookkeeping assistant. Extract data from this receipt/invoice image and return ONLY valid JSON with these fields:
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
Return ONLY the JSON object, no markdown, no explanation.`,
                  },
                  {
                    type: "image_url",
                    image_url: {
                      url: `data:${mimeType};base64,${base64Image}`,
                      detail: "high",
                    },
                  },
                ],
              },
            ],
          }),
        });

        const aiJson = await aiRes.json();
        const content = aiJson.choices?.[0]?.message?.content ?? "";
        const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        aiData = JSON.parse(cleaned);
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

    // Build a data URI so the caller can store it permanently in the DB
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
