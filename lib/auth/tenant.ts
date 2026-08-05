import { getServerSession } from "next-auth/next";
import { authOptions } from "./options";
import { NextResponse } from "next/server";

/**
 * Tenant guard for routes that take a record ID from the URL or body.
 *
 * Background: several write routes called `prisma.x.update({ where: { id } })`
 * on a client-supplied ID with no business check, so any signed-in manager
 * could read, edit or delete another business's records by guessing an ID.
 * `requireTenant` returns a guaranteed non-null businessId so a route can
 * never silently fall back to "any business".
 *
 * Usage:
 *   const t = await requireTenant({ manager: true });
 *   if (isResponse(t)) return t;
 *   const row = await prisma.thing.findFirst({ where: { id, businessId: t.businessId } });
 *   if (!row) return notFound();
 */
export type Tenant = {
  userId: string;
  email: string | null;
  role: string;
  businessId: string;
  isManager: boolean;
};

export async function requireTenant(opts?: {
  manager?: boolean;
}): Promise<Tenant | NextResponse> {
  const session = await getServerSession(authOptions);
  const user = session?.user as
    | { id?: string; email?: string | null; role?: string; businessId?: string | null }
    | undefined;

  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!user.businessId) {
    return NextResponse.json({ error: "No business associated" }, { status: 400 });
  }

  const role = user.role ?? "";
  const isManager = role === "ADMIN" || role === "MANAGER";
  if (opts?.manager && !isManager) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return {
    userId: user.id,
    email: user.email ?? null,
    role,
    businessId: user.businessId,
    isManager,
  };
}

export function isResponse(v: unknown): v is NextResponse {
  return v instanceof NextResponse;
}

export function notFound() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
