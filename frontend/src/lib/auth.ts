import { createClient } from "@/lib/supabase/client";
import type { Provider, SupabaseClient } from "@supabase/supabase-js";
import {
  bootstrapProfile,
  getCurrentUserRole as resolveCurrentUserRole,
  getProfile,
  type Profile,
} from "@/lib/profiles";
import type { UserRole } from "@/lib/roles";

export type { UserRole, Profile };

const PROFILE_BOOTSTRAP_RETRY_MS = 350;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * After sign-in/sign-up, create profile via RPC once the session is available.
 *
 * signInWithPassword resolves before cookies are always readable by getUser().
 * We call getSession() first inside bootstrapProfile; if that fails we retry
 * once after a short delay. Errors are logged only — login must not fail.
 */
async function bootstrapProfileAfterAuth(supabase: SupabaseClient) {
  try {
    const profile = await bootstrapProfile(supabase);
    if (profile) return;

    // Session may still be propagating to storage after sign-in
    await sleep(PROFILE_BOOTSTRAP_RETRY_MS);
    await bootstrapProfile(supabase);
  } catch (err) {
    console.warn(
      "[bootstrapProfileAfterAuth]",
      err instanceof Error ? err.message : err
    );
  }
}

/** Ensure a row exists in public.profiles for the authenticated user. */
export async function ensureUserProfile(_userId: string, _email: string) {
  const supabase = createClient();
  return bootstrapProfile(supabase);
}

/** Returns the current user's role (client-side). Never throws. */
export async function getCurrentUserRole(): Promise<UserRole | null> {
  try {
    const supabase = createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user?.email) return null;

    return resolveCurrentUserRole(supabase, user.id, user.email);
  } catch {
    return null;
  }
}

/** Email + password sign-up. */
export async function signUpWithEmail(email: string, password: string) {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  });

  if (error) throw error;

  // Profile is created when a session exists (immediate sign-up or via /auth/callback)
  if (data.session) {
    await bootstrapProfileAfterAuth(supabase);
  }

  return data;
}

/** Email + password sign-in. */
export async function signInWithEmail(email: string, password: string) {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;

  // Wait for session, then bootstrap profile (non-blocking on failure)
  await bootstrapProfileAfterAuth(supabase);

  return data;
}

/** OAuth sign-in / sign-up (Google or Azure/Microsoft). */
export async function signInWithOAuth(provider: Provider) {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });

  if (error) throw error;
  return data;
}

/** Sign out current user. */
export async function signOut() {
  const { endAccessSession } = await import("@/lib/access/client");
  await endAccessSession();
  const supabase = createClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/** Send a password reset email via Supabase Auth. */
export async function sendPasswordResetEmail(email: string) {
  const supabase = createClient();
  const redirectTo =
    process.env.NEXT_PUBLIC_RESET_PASSWORD_REDIRECT ??
    (typeof window !== "undefined"
      ? `${window.location.origin}/auth/callback?type=recovery&next=/reset-password`
      : "https://task-manager-theta-heppa-42.vercel.app/auth/callback?type=recovery&next=/reset-password");

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  if (error) throw error;
}

/** Set a new password after following the reset email link. */
export async function updatePassword(password: string) {
  const supabase = createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

/** Current session user + profile (client-side). Never throws. */
export async function getCurrentUserWithProfile(): Promise<{
  user: Awaited<
    ReturnType<SupabaseClient["auth"]["getUser"]>
  >["data"]["user"];
  profile: Profile | null;
}> {
  try {
    const supabase = createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      console.warn("[getCurrentUserWithProfile]", error.message);
      return { user: null, profile: null };
    }

    if (!user?.email) {
      return { user: null, profile: null };
    }

    const profile = await bootstrapProfile(supabase);
    return { user, profile };
  } catch (err) {
    console.warn(
      "[getCurrentUserWithProfile]",
      err instanceof Error ? err.message : err
    );
    return { user: null, profile: null };
  }
}

/** Fetch profile for a user id without creating one. */
export async function fetchProfile(userId: string) {
  const supabase = createClient();
  return getProfile(supabase, userId);
}
