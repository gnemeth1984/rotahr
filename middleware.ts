import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  computeAccess,
  isAlwaysWritable,
  isWriteMethod,
  readOnlyPayload,
} from "@/lib/billing/access";

// Public/marketing paths — platform admins can visit these while logged in
const PUBLIC_PATHS = ["/", "/pricing", "/pitch", "/privacy", "/terms", "/blog"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ---------------------------------------------------------------------
  // Read-only gate.
  //
  // This is the single enforcement point for trial expiry. It lives here
  // rather than in the route guards because there is no one guard every write
  // passes through — requirePermission, requireTenant, requireRole and
  // requireManager are all in use — and because only middleware sees the HTTP
  // method centrally.
  //
  // It blocks writes and nothing else. GET, HEAD and OPTIONS always pass, so
  // every page, report, PDF and CSV export keeps working after a trial ends.
  //
  // It fails open at every step: no token, no business, unreadable claims or
  // any thrown error all result in the request being allowed through.
  // See lib/billing/access.ts for why that asymmetry is deliberate.
  // ---------------------------------------------------------------------
  if (pathname.startsWith("/api")) {
    if (isWriteMethod(request.method) && !isAlwaysWritable(pathname)) {
      try {
        const token = await getToken({
          req: request,
          secret: process.env.NEXTAUTH_SECRET,
        });

        // Unauthenticated writes are the route's own problem, not ours — it
        // will 401 them. Platform admins are never gated.
        if (token && token.businessId && !token.isPlatformAdmin) {
          const state = computeAccess({
            lsStatus: token.lsStatus as string | null | undefined,
            trialEndsAt: token.trialEndsAt as string | null | undefined,
          });

          if (state.mode === "readonly") {
            return NextResponse.json(readOnlyPayload(state), { status: 402 });
          }
        }
      } catch {
        // Never let a gate failure become an outage. Allow the write.
      }
    }
    return NextResponse.next();
  }

  // Skip static files, auth routes, and public pages
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/favicon") ||
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))
  ) {
    return NextResponse.next();
  }

  // Read JWT token (works in Edge runtime)
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // Platform admin (no business) can visit any app route freely

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except Next.js static files.
     * We do our own filtering inside the middleware body above.
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
