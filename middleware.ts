import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Public/marketing paths — platform admins can visit these while logged in
const PUBLIC_PATHS = ["/", "/pricing", "/pitch", "/privacy", "/terms", "/blog"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip static files, API routes, auth routes, and public pages
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
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

  if (token && token.role === "ADMIN" && !token.businessId) {
    // Platform admin with no business — only /admin is a valid app destination
    if (!pathname.startsWith("/admin")) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
  }

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
