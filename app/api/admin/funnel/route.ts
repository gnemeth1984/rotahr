export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { isSuperAdminEmail } from "@/lib/auth/super-admins";
import { getFunnel } from "@/lib/analytics/funnel";

/** GET /api/admin/funnel?days=30 — visit → signup → activation → paid. days=0 is all time. */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isSuperAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const raw = Number(new URL(req.url).searchParams.get("days") ?? "30");
  const days = Number.isFinite(raw) && raw >= 0 && raw <= 3650 ? Math.floor(raw) : 30;
  try {
    return NextResponse.json(await getFunnel({ days }));
  } catch (e) {
    console.error("[admin/funnel]", e);
    return NextResponse.json({ error: "Could not build the funnel" }, { status: 500 });
  }
}
