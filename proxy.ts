import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { Role } from "@prisma/client";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;

    // Manager/Admin only routes
    if (pathname.startsWith("/employees") || pathname.startsWith("/shifts")) {
      if (
        token?.role !== Role.MANAGER &&
        token?.role !== Role.ADMIN
      ) {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/employees/:path*",
    "/shifts/:path*",
    "/timeoff/:path*",
  ],
};
