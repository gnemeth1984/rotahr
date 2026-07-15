// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { requirePermission, isResponse } from "@/lib/auth/middleware";
import { put } from "@vercel/blob";

export const maxDuration = 30;

// POST /api/log-book/tasks/upload-photo — proof-of-completion photo for an ops task
export async function POST(req: NextRequest) {
  const session = await requirePermission("logbook");
  if (isResponse(session)) return session;
  const businessId = session.user.businessId ?? "christys-bar-seed-id";

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "File must be an image" }, { status: 400 });
    }
    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ error: "Image must be under 8MB" }, { status: 400 });
    }

    const blob = await put(
      `ops-task-photos/${businessId}/${Date.now()}-${file.name}`,
      file,
      { access: "private" }
    );

    return NextResponse.json({ url: blob.url });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
