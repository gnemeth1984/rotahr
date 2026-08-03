/**
 * Shared auth for the SEO autopilot endpoints.
 *
 * Accepts either the cron secret (Vercel Cron sends it as a Bearer header) or a
 * logged-in platform admin session, so the same route works unattended and from
 * the /admin/seo dashboard's "run now" buttons.
 */

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";

export function hasCronSecret(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization");
  const alt = req.headers.get("x-cron-secret") || new URL(req.url).searchParams.get("secret");
  return header === `Bearer ${secret}` || alt === secret;
}

export async function isPlatformAdmin(): Promise<boolean> {
  const session = await getServerSession(authOptions);
  // Must be the platform-admin flag, never role. Every business owner is role
  // ADMIN inside their own business — gating on role would hand a customer the
  // whole platform's SEO console.
  return Boolean(session?.user?.isPlatformAdmin);
}

/** True when the caller may run/inspect the autopilot. */
export async function canRunSeo(req: Request): Promise<boolean> {
  return hasCronSecret(req) || (await isPlatformAdmin());
}
