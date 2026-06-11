import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile, UserRole } from "@/lib/roles";
import type { Profile as ProfileRow } from "@/lib/types";

const COMPANY_DOMAIN =
  process.env.NEXT_PUBLIC_COMPANY_EMAIL_DOMAIN ?? "yourcompany.com";

/**
 * Low-level RPC call. Never throws — callers must check for null.
 * The RPC uses auth.uid() server-side; a valid session must exist first.
 */
async function callEnsureUserProfileRpc(
  supabase: SupabaseClient,
  userEmail: string
): Promise<Profile | null> {
  try {
    const { data, error } = await supabase.rpc("ensure_user_profile", {
      user_email: userEmail,
      company_domain: COMPANY_DOMAIN,
    });

    if (error) {
      console.warn("[ensure_user_profile RPC]", error.message);
      return null;
    }

    if (!data) {
      console.warn("[ensure_user_profile RPC] returned no profile row");
      return null;
    }

    return data as Profile;
  } catch (err) {
    console.warn(
      "[ensure_user_profile RPC]",
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * Bootstrap profile after auth.
 *
 * Session timing matters: immediately after signInWithPassword, getUser() can
 * lag behind the session cookie Supabase just wrote. getSession() reads the
 * local session first (fast path after login). getUser() validates with the
 * auth server (reliable on server components once cookies are set).
 *
 * Never throws — returns null if session is not ready or RPC fails.
 */
export async function bootstrapProfile(
  supabase: SupabaseClient
): Promise<Profile | null> {
  try {
    // 1. Prefer getSession — available immediately after client-side sign-in
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      console.warn("[bootstrapProfile] getSession:", sessionError.message);
    }

    if (session?.user?.email) {
      const profile = await callEnsureUserProfileRpc(
        supabase,
        session.user.email
      );
      if (profile) return profile;
    }

    // 2. Fall back to getUser — validated session (server routes, delayed client)
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      console.warn("[bootstrapProfile] getUser:", userError.message);
      return null;
    }

    if (!user?.email) {
      return null;
    }

    return callEnsureUserProfileRpc(supabase, user.email);
  } catch (err) {
    console.warn(
      "[bootstrapProfile]",
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/** @deprecated Use bootstrapProfile — kept for backward compatibility */
export async function tryEnsureProfile(
  supabase: SupabaseClient,
  _maxRetries?: number
): Promise<Profile | null> {
  return bootstrapProfile(supabase);
}

/** @deprecated Use bootstrapProfile — never throws */
export async function ensureProfile(
  supabase: SupabaseClient
): Promise<Profile | null> {
  return bootstrapProfile(supabase);
}

/** Read profile without creating (returns null if missing). */
export async function getProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<Profile | null> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, role, created_at")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.warn("[getProfile]", error.message);
      return null;
    }

    return (data as ProfileRow | null) ?? null;
  } catch (err) {
    console.warn("[getProfile]", err instanceof Error ? err.message : err);
    return null;
  }
}

/** Returns role for the signed-in user; creates profile via RPC when session is ready. */
export async function getCurrentUserRole(
  supabase: SupabaseClient,
  userId: string,
  _email: string
): Promise<UserRole | null> {
  try {
    const existing = await getProfile(supabase, userId);
    if (existing) return existing.role;

    const profile = await bootstrapProfile(supabase);
    return profile?.role ?? null;
  } catch {
    return null;
  }
}

export type { Profile, UserRole };
