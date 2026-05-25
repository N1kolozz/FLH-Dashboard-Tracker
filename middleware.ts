// Next.js Edge Middleware — runs on every non-static request before any page or
// API handler. Its only job is lightweight session gating: read the cookie,
// verify the JWT signature, and redirect unauthenticated users to /login.
//
// Heavy authorization (role checks, department checks) is NOT done here because
// middleware runs in the Edge Runtime which has limited Node.js APIs. Instead,
// individual server actions call requireAuthenticatedSession() / requireHeadOrAdminSession()
// from lib/action-auth.ts, which have full access to the pg pool and all helpers.

import { NextRequest, NextResponse } from "next/server";
import { decrypt } from "@/lib/session-token";

// These path prefixes bypass the session check entirely.
// /api routes handle their own auth (or are intentionally public, e.g. /api/holidays).
const publicRoutes = ["/login", "/create-password", "/api"];

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // Server actions arrive as POST requests with a "next-action" header.
  // If we redirected them here (e.g. to /login), the browser would replay the
  // POST to /login with method preserved (307 Temporary Redirect), which breaks
  // the action entirely. Server actions guard themselves via action-auth.ts, so
  // passing them through here is safe.
  if (req.headers.get("next-action")) {
    return NextResponse.next();
  }

  const isPublicRoute = publicRoutes.some((route) => path.startsWith(route));

  const cookie = req.cookies.get("session")?.value;
  const session = cookie ? await decrypt(cookie) : null;

  // Unauthenticated access to any protected route → redirect to login.
  if (!isPublicRoute && !session) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Logged-in users hitting the auth pages → send them to the dashboard.
  if (isPublicRoute && session && (path === "/login" || path === "/create-password")) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Root path has no page of its own; send logged-in users to the dashboard.
  if (path === "/" && session) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - fonts/ (font files inside public or app)
     * - \.svg (svg images)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
