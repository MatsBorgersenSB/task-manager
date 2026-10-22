import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/admin/delete-auth-user";

/** Long enough that a denied account cannot sign in again until an admin restores it. */
const DENY_DURATION = "876000h";

export function isAuthUserDenied(bannedUntil: string | null | undefined): boolean {
  if (!bannedUntil) return false;
  const until = new Date(bannedUntil).getTime();
  return Number.isFinite(until) && until > Date.now();
}

/** Auth user ids whose sign-in is currently blocked. */
export async function listDeniedUserIds(): Promise<string[]> {
  const admin = createServiceRoleClient();
  const denied: string[] = [];
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new Error(error.message);
    }

    const users = data.users ?? [];
    for (const user of users) {
      if (isAuthUserDenied(user.banned_until)) {
        denied.push(user.id);
      }
    }

    if (users.length < perPage) break;
    page += 1;
  }

  return denied;
}

export async function setAuthUserDenied(
  admin: SupabaseClient,
  userId: string,
  denied: boolean
): Promise<{ success: true } | { success: false; error: string }> {
  const { error } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: denied ? DENY_DURATION : "none",
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function deleteAuthUserById(
  admin: SupabaseClient,
  userId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}
