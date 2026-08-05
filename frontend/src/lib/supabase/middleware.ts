import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";

type CookieToSet = { name: string; value: string; options: CookieOptions };

export type SessionContext = {
  response: NextResponse;
  user: User | null;
  /** Full cookie payloads from the last setAll (includes path/secure/httpOnly). */
  cookiesToSet: CookieToSet[];
};

/**
 * Refresh the auth session and return a response that carries updated cookies.
 * Call getUser() immediately after createServerClient — do not insert logic between them.
 */
export async function updateSession(request: NextRequest): Promise<SessionContext> {
  let supabaseResponse = NextResponse.next({ request });
  let cookiesToSet: CookieToSet[] = [];

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return { response: supabaseResponse, user: null, cookiesToSet };
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(nextCookies: CookieToSet[], headers?: Record<string, string>) {
        cookiesToSet = nextCookies;
        nextCookies.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({ request });
        nextCookies.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
        if (headers) {
          Object.entries(headers).forEach(([key, value]) => {
            supabaseResponse.headers.set(key, value);
          });
        }
      },
    },
  });

  // IMPORTANT: keep this immediately after createServerClient (token refresh).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response: supabaseResponse, user, cookiesToSet };
}

/**
 * Redirect while preserving session cookies with their original options.
 * Copying name/value only (without path/secure) breaks sessions on Vercel and
 * causes login ↔ dashboard redirect loops.
 */
export function redirectWithSession(
  request: NextRequest,
  sessionResponse: NextResponse,
  cookiesToSet: CookieToSet[],
  pathname: string
): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  const redirectResponse = NextResponse.redirect(url);

  if (cookiesToSet.length > 0) {
    cookiesToSet.forEach(({ name, value, options }) => {
      redirectResponse.cookies.set(name, value, {
        ...options,
        path: options?.path ?? "/",
      });
    });
  } else {
    // Fall back to whatever was already attached to the session response.
    sessionResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, { path: "/" });
    });
  }

  return redirectResponse;
}
