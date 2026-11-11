import { NextRequest, NextResponse } from "next/server";
import { isSameOriginRequest } from "@/lib/auth/origin";
import { AUTH_COOKIE_NAME } from "@/lib/auth/session-cookie";

/**
 * Edge-of-app guards. Deliberately cheap: no DB, no JWT verification.
 * Real authorization happens server-side in every route/layout.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/")) {
    const allowed = isSameOriginRequest({
      method: request.method,
      url: request.url,
      headers: request.headers,
      allowedOrigins: [process.env.NEXT_PUBLIC_APP_URL],
    });
    if (!allowed) {
      return NextResponse.json(
        { success: false, error: "Cross-origin request blocked" },
        { status: 403 }
      );
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/dashboard") && !request.cookies.has(AUTH_COOKIE_NAME)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*", "/dashboard/:path*"],
};
