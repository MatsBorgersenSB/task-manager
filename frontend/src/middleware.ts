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
const AUTH_ROUTES = ["/login", "/signup"];
/** Allow recovery flow even when a session exists. */
const RECOVERY_ROUTES = ["/auth/callback", "/reset-password"];

function matchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * Auth middleware — session refresh + loop-safe redirects only.
 * Do not query profiles here: DB/RPC failures must never bounce users
 * between /login and /dashboard.
 */
export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some((p) => matchesPrefix(pathname, p));
  const isAuthRoute = AUTH_ROUTES.some((r) => matchesPrefix(pathname, r));
  const isRecoveryRoute = RECOVERY_ROUTES.some((r) => matchesPrefix(pathname, r));

  // Unauthenticated → login (protected routes only).
  if (!user && isProtected) {
    return redirectWithSession(request, response, "/login");
  }

  // Authenticated on login/signup → dashboard (skip recovery routes).
  if (user && isAuthRoute && !isRecoveryRoute) {
    return redirectWithSession(request, response, "/dashboard");
  }

  // Role gates (admin / internal) belong in server pages — not middleware —
  // so a missing profile cannot create a redirect loop.

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
