export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireCopilot } from "@/lib/copilot/guard";
import { DEFAULT_TARGET_GP, loadTargetGp } from "@/lib/copilot/agents/margin";
import { isMissingTable } from "@/lib/copilot/db-errors";

/** GET /api/copilot/settings — { targetGpPct } */
export async function GET() {
  const u = await requireCopilot();
  if (u instanceof NextResponse) return u;
  return NextResponse.json({ targetGpPct: await loadTargetGp(u.businessId), defaultTargetGpPct: DEFAULT_TARGET_GP });
}

const schema = z.object({ targetGpPct: z.number().finite().min(1).max(99) });

/** PATCH /api/copilot/settings — managers only. */
export async function PATCH(req: NextRequest) {
  const u = await requireCopilot();
  if (u instanceof NextResponse) return u;
  if (!u.isManager) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "targetGpPct must be a number from 1 to 99" }, { status: 400 });
  const targetGpPct = Math.round(parsed.data.targetGpPct * 10) / 10;
  try {
    await prisma.copilotSettings.upsert({
      where: { businessId: u.businessId },
      create: { businessId: u.businessId, targetGpPct },
      update: { targetGpPct },
    });
  } catch (err) {
    if (isMissingTable(err))
      return NextResponse.json({ error: "Copilot settings aren't available yet — the database update is pending." }, { status: 503 });
    throw err;
  }
  return NextResponse.json({ targetGpPct });
}
