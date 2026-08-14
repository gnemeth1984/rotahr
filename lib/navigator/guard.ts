import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { isSuperAdminEmail } from "@/lib/auth/super-admins";

/**
 * Navigator is a private personal tool. Only the real platform super-admin
 * (Gabor) may touch it — never a business owner with role ADMIN.
 * Returns the userId, or null when access must be refused.
 */
export async function navigatorUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  if (!isSuperAdminEmail(session.user.email)) return null;
  return session.user.id;
}

export function forbidden() {
  return new Response(JSON.stringify({ error: "Forbidden" }), {
    status: 403,
    headers: { "content-type": "application/json" },
  });
}
