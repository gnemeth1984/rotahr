// @ts-nocheck
/**
 * Cron: purge expired receiptDataUrl from DB.
 *
 * Runs daily via Vercel Cron. The receipt IMAGE (base64 data URI) is cleared
 * after 30 days to minimise DB size and comply with GDPR data minimisation (Art.5(1)(e)).
 * The financial RECORD (amounts, dates, VAT, vendor) is NEVER deleted — retained
 * permanently under TCA 1997 s.886 (Irish Revenue 6-year rule).
 *
 * If a Vercel Blob URL exists, images remain accessible there; only the DB copy is purged.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  // Protect: only Vercel Cron or requests with the correct secret
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

  const { count } = await prisma.expense.updateMany({
    where: {
      receiptDataUrl: { not: null },
      receiptExpiresAt: { lte: cutoff },
    },
    data: {
      receiptDataUrl: null,
    },
  });

  return NextResponse.json({
    ok: true,
    purged: count,
    cutoff: cutoff.toISOString(),
    note: "receiptDataUrl cleared; financial records retained per TCA 1997 s.886",
  });
}
