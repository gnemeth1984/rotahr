export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { isSuperAdminEmail } from "@/lib/auth/super-admins";
import { diagnoseGsc } from "@/lib/seo/gsc-diagnose";

/**
 * Reports which Search Console properties the configured service account can
 * actually reach. Platform-admin only: it echoes the service account email.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !isSuperAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json(await diagnoseGsc());
}
