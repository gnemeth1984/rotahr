export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { isSuperAdminEmail } from "@/lib/auth/super-admins";
import {
  planLifecycle,
  lifecycleSendingEnabled,
  sendLifecycleNow,
  LIFECYCLE_KEYS,
  LIFECYCLE_LABEL,
  type LifecycleKey,
} from "@/lib/email/lifecycle";

async function requireSuperAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isSuperAdminEmail(session.user.email)) return null;
  return session;
}

/**
 * GET /api/admin/lifecycle — who is due which setup email right now, with the
 * rendered message. Read-only.
 */
export async function GET() {
  if (!(await requireSuperAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const items = await planLifecycle();
  return NextResponse.json({
    enabled: lifecycleSendingEnabled(),
    labels: LIFECYCLE_LABEL,
    items,
  });
}

/**
 * POST /api/admin/lifecycle { businessId, key } — send ONE due email now, on an
 * explicit admin click. Re-plans server-side; refuses if that key is no longer
 * due, was already sent, or the address is unsubscribed/unroutable.
 */
export async function POST(req: NextRequest) {
  const session = await requireSuperAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { businessId?: unknown; key?: unknown };
  const businessId = typeof body.businessId === "string" ? body.businessId : "";
  const key = typeof body.key === "string" ? body.key : "";
  if (!businessId || !LIFECYCLE_KEYS.includes(key as LifecycleKey)) {
    return NextResponse.json({ error: "businessId and a valid key are required" }, { status: 400 });
  }
  const res = await sendLifecycleNow({
    businessId,
    key: key as LifecycleKey,
    sentBy: session.user.email ?? null,
  });
  return NextResponse.json(res, { status: res.ok ? 200 : 409 });
}
