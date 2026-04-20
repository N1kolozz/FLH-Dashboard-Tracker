import { NextRequest, NextResponse } from "next/server";
import { decrypt } from "@/lib/session-token";

const publicRoutes = ["/login", "/create-password", "/api"];

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // Let server action requests through — they handle their own auth
  // (Without this, middleware's 307 redirect preserves POST method,
  //  causing browsers to replay every server action POST to /login)
  if (req.headers.get("next-action")) {
    return NextResponse.next();
  }

  const isPublicRoute = publicRoutes.some((route) => path.startsWith(route));

  // Get session
  const cookie = req.cookies.get("session")?.value;
  const session = cookie ? await decrypt(cookie) : null;

  // Protect all non-public routes
  if (!isPublicRoute && !session) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Redirect to dashboard if logged in and trying to access auth pages
  if (isPublicRoute && session && (path === "/login" || path === "/create-password")) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Next.js convention: redirect from / directly to /dashboard if logged in
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
