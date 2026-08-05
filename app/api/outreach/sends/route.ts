export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "../_auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const limit = Math.min(200, Math.max(1, Number(req.nextUrl.searchParams.get("limit") || 50)));

  const sends = await prisma.outreachSend.findMany({
    orderBy: { sentAt: "desc" },
    take: limit,
  });

  return NextResponse.json({
    sends: sends.map((s) => ({
      id: s.id,
      email: s.email,
      segment: s.segment,
      step: s.step,
      subject: s.subject,
      sent_at: s.sentAt.toISOString(),
      opened: s.opened,
      clicked: s.clicked,
      failedReason: s.failedReason,
    })),
  });
}
