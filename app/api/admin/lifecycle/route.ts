export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { isSuperAdminEmail } from "@/lib/auth/super-admins";
import { planLifecycle, lifecycleSendingEnabled, LIFECYCLE_LABEL } from "@/lib/email/lifecycle";

/**
 * GET /api/admin/lifecycle — dry run of the lifecycle emails: who is due which
 * email right now, with the rendered message. Read-only; there is no send
 * action on this route.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isSuperAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const items = await planLifecycle();
  return NextResponse.json({
    enabled: lifecycleSendingEnabled(),
    labels: LIFECYCLE_LABEL,
    items,
  });
}
