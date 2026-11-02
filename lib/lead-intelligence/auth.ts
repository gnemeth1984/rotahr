import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth/options";
import { isSuperAdminEmail } from "@/lib/auth/super-admins";

export async function adminGuard() {
  const session = await getServerSession(authOptions);
  return session?.user?.email && isSuperAdminEmail(session.user.email)
    ? null : NextResponse.json({error:"Forbidden"},{status:403});
}
export { validCronAuth } from "./cron-auth";
export function mutationGuard(req: Request) {
  const origin = req.headers.get("origin");
  if (origin && origin!==new URL(req.url).origin) return NextResponse.json({error:"Cross-origin mutation denied"},{status:403});
  if (req.headers.get("sec-fetch-site")==="cross-site") return NextResponse.json({error:"Cross-site mutation denied"},{status:403});
  return null;
}
export { apiError } from "./errors";
