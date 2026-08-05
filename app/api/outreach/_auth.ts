import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { isSuperAdminEmail } from "@/lib/auth/super-admins";
import { NextResponse } from "next/server";

/**
 * Cold outreach is a platform-owner tool, not a customer feature. Gate on the
 * hardcoded super-admin list — never on `role === "ADMIN"`, which every paying
 * business owner has inside their own business.
 */
export async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isSuperAdminEmail(session.user.email)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }), session: null };
  }
  return { error: null as null, session };
}
