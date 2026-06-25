// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { requirePermission, isResponse } from "@/lib/auth/middleware";
import { put } from "@vercel/blob";

export async function POST(req: NextRequest) {
  const session = await requirePermission("stocktaking");
  if (isResponse(session)) return session;
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
    const blob = await put(`stock-receipts/${Date.now()}-${file.name}`, file, { access: "private" });
    return NextResponse.json({ url: blob.url });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
