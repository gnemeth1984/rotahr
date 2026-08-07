import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { isSuperAdminEmail } from "@/lib/auth/super-admins";

/**
 * The inbox contains real correspondence from real people and can send mail as
 * Rotahr, so it is platform-admin only.
 *
 * Gating on `role === "ADMIN"` would be wrong: every business owner is ADMIN
 * inside their own business, which would hand all of them the company inbox.
 */
export async function requirePlatformAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !isSuperAdminEmail(session.user.email)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }), session: null };
  }
  return { error: null, session };
}
