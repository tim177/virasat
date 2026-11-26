import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

// A quick first check for /admin: visitors without any session cookie go straight to the
// login page, before the admin screens render. It can't tell who the cookie belongs to;
// requireAdmin() (lib/admin-auth.ts) checks the session, role and two-factor on every request.
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Every /admin page except the login page itself.
  matcher: ["/admin", "/admin/((?!login).*)"],
};
