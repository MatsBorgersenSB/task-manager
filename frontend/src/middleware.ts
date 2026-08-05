import { type NextRequest } from "next/server";
import {
  redirectWithSession,
  updateSession,
} from "@/lib/supabase/middleware";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/today",
  "/admin",
  "/internal",
  "/client",
  "/share",
];

function matchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * Auth middleware — refresh session cookies; only redirect anonymous users
 * away from protected routes.
 *
 * Do NOT redirect signed-in users away from /login here. That redirect plus a
 * Server Component that disagreed about the session caused ERR_TOO_MANY_REDIRECTS
 * between /login and /dashboard on Vercel.
 */
export async function middleware(request: NextRequest) {
  const { response, user, cookiesToSet } = await updateSession(request);
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some((p) => matchesPrefix(pathname, p));

  if (!user && isProtected) {
    return redirectWithSession(request, response, cookiesToSet, "/login");
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
