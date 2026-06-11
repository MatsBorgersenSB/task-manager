import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { bootstrapProfileOnServer } from "@/lib/profiles-server";

/**
 * OAuth callback — exchange code for session, then bootstrap profile via RPC.
 * Session exists only after exchangeCodeForSession succeeds.
 * Redirects even if profile bootstrap fails; dashboard will retry server-side.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      await bootstrapProfileOnServer(supabase);
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
