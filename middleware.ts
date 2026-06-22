import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const token = req.nextauth.token as any;

    // Skip onboarding redirect for public/auth paths and API routes
    const isOnboarding = pathname === "/onboarding";
    const isAuth = pathname.startsWith("/auth/");
    const isApi = pathname.startsWith("/api/");
    const isPublic = ["/", "/pricing", "/pitch", "/terms", "/privacy"].some(
      (p) => pathname === p || pathname.startsWith(p + "/")
    );

    if (isAuth || isApi || isPublic || isOnboarding) return NextResponse.next();

    // If logged in but no businessId → force onboarding
    if (token && !token.businessId) {
      return NextResponse.redirect(new URL("/onboarding", req.url));
    }

    // If logged in and onboarding not complete → force onboarding
    // (We can't check DB here without edge Prisma, but businessId presence is a good proxy
    //  The onboarding page itself checks onboardingComplete and redirects to dashboard when done)

    return NextResponse.next();
  },
  {
    callbacks: {
      // Only run middleware for authenticated users on app routes
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;
        // Allow public routes without auth
        const publicPaths = ["/", "/pricing", "/pitch", "/terms", "/privacy", "/auth/"];
        const isPublic = publicPaths.some((p) => pathname.startsWith(p));
        const isApi = pathname.startsWith("/api/");
        if (isPublic || isApi) return true;
        // Everything else requires login
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: [
    // Run on all routes except static assets and Next.js internals
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)).*)",
  ],
};
