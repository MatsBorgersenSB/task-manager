import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createServiceRoleClient,
  findAuthUserIdByEmail,
} from "@/lib/admin/delete-auth-user";

export type UpdateAuthUserEmailResult =
  | { success: true; userId: string; oldEmail: string; newEmail: string }
  | { success: false; error: string };

/** Update auth.users email (source of truth for login). */
export async function updateAuthUserEmail(
  admin: SupabaseClient,
  userId: string,
  newEmail: string
): Promise<UpdateAuthUserEmailResult> {
  const normalized = newEmail.trim().toLowerCase();

  if (!normalized) {
    return { success: false, error: "Email is required." };
  }

  const { data: existing, error: getError } =
    await admin.auth.admin.getUserById(userId);

  if (getError) {
    return {
      success: false,
      error: `Failed to load auth user: ${getError.message}`,
    };
  }

  const oldEmail = (existing.user?.email ?? "").trim().toLowerCase();

  if (oldEmail === normalized) {
    return { success: true, userId, oldEmail, newEmail: normalized };
  }

  const { error } = await admin.auth.admin.updateUserById(userId, {
    email: normalized,
    email_confirm: true,
  });

  if (error) {
    return { success: false, error: `Auth email update failed: ${error.message}` };
  }

  return {
    success: true,
    userId,
    oldEmail,
    newEmail: normalized,
  };
}

export async function findConflictingAuthEmail(
  admin: SupabaseClient,
  email: string,
  excludeUserId: string
): Promise<boolean> {
  const userId = await findAuthUserIdByEmail(admin, email);
  return userId != null && userId !== excludeUserId;
}

export { createServiceRoleClient };
