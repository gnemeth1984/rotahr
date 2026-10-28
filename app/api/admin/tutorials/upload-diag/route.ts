/**
 * POST /api/admin/tutorials/upload-diag
 *
 * The tutorials tab posts here when a video upload fails, stalls or is
 * cancelled: what each browser -> Vercel Blob request returned (status or
 * network error), plus file size/type and user agent. Stored in ActivityLog
 * as `tutorial_upload_diag` so a failed upload can be diagnosed afterwards
 * without screen-sharing. Super admin only; small, capped payload.
 */

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { isSuperAdminEmail } from "@/lib/auth/super-admins";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email ?? null;
  if (!isSuperAdminEmail(email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const raw = await req.text();
  if (raw.length > 50_000) return NextResponse.json({ error: "Too large" }, { status: 413 });
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }
  const events = Array.isArray(body.events) ? body.events.slice(-60) : [];
  await prisma.activityLog.create({
    data: {
      action: "tutorial_upload_diag",
      userName: email,
      details: {
        outcome: String(body.outcome ?? "").slice(0, 40),
        message: String(body.message ?? "").slice(0, 500),
        fileSize: typeof body.fileSize === "number" ? body.fileSize : null,
        fileType: String(body.fileType ?? "").slice(0, 60),
        seconds: typeof body.seconds === "number" ? body.seconds : null,
        progress: typeof body.progress === "number" ? body.progress : null,
        userAgent: (req.headers.get("user-agent") ?? "").slice(0, 300),
        country: req.headers.get("x-vercel-ip-country"),
        events,
      },
    },
  });
  return NextResponse.json({ ok: true });
}
