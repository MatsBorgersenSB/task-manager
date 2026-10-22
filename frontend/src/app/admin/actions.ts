"use server";

import { revalidatePath } from "next/cache";
import {
  createServiceRoleClient,
  findConflictingAuthEmail,
  updateAuthUserEmail,
} from "@/lib/admin/update-user-email";
import { isValidUserRole } from "@/lib/admin/validation";
import {
  deleteAuthUserById,
  setAuthUserDenied,
} from "@/lib/admin/user-access";
import { getAuthContextServer } from "@/lib/profiles-server";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/roles";
import type { ActionResult, Invite, Profile } from "@/lib/types";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Gate all admin mutations — returns error instead of redirecting. */
async function assertAdmin(): Promise<
  ActionResult<{ userId: string; email: string | null }>
> {
  const ctx = await getAuthContextServer();
  if (!ctx.user || !ctx.profile) {
    return { success: false, error: "You must be signed in." };
  }
  if (!ctx.isAdmin) {
    return { success: false, error: "Admin access required." };
  }
  return {
    success: true,
    data: { userId: ctx.user.id, email: ctx.user.email ?? ctx.profile.email },
  };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Update another user's role via admin RPC (blocks self-change + last-admin removal). */
export async function updateUserRoleAction(
  targetUserId: string,
  newRole: UserRole
): Promise<ActionResult<Profile>> {
  const gate = await assertAdmin();
  if (!gate.success) return gate;

  if (!targetUserId?.trim()) {
    return { success: false, error: "Target user is required." };
  }

  if (!isValidUserRole(newRole)) {
    return { success: false, error: "Invalid role selected." };
  }

  if (targetUserId === gate.data.userId) {
    return { success: false, error: "You cannot change your own role." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_update_user_role", {
    target_user_id: targetUserId,
    new_role: newRole,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/admin");
  return { success: true, data: data as Profile };
}

/** Invite a user by email with a predefined role via admin RPC. */
export async function inviteUserAction(
  email: string,
  role: UserRole
): Promise<ActionResult<Invite>> {
  const gate = await assertAdmin();
  if (!gate.success) return gate;

  const normalized = normalizeEmail(email);
  if (!normalized || !EMAIL_PATTERN.test(normalized)) {
    return { success: false, error: "Enter a valid email address." };
  }

  if (!isValidUserRole(role)) {
    return { success: false, error: "Invalid role selected." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_create_invite", {
    invite_email: normalized,
    invite_role: role,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/admin");
  return { success: true, data: data as Invite };
}

/** Correct another user's email (auth + related tables). */
export async function updateUserEmailAction(
  targetUserId: string,
  newEmail: string
): Promise<ActionResult<Profile>> {
  const gate = await assertAdmin();
  if (!gate.success) return gate;

  if (!targetUserId?.trim()) {
    return { success: false, error: "Target user is required." };
  }

  if (targetUserId === gate.data.userId) {
    return {
      success: false,
      error: "You cannot change your own email here. Use account settings.",
    };
  }

  const normalized = normalizeEmail(newEmail);
  if (!normalized || !EMAIL_PATTERN.test(normalized)) {
    return { success: false, error: "Enter a valid email address." };
  }

  const supabase = await createClient();
  const { data: existing, error: profileError } = await supabase
    .from("profiles")
    .select("id, email")
    .eq("id", targetUserId)
    .maybeSingle();

  if (profileError) {
    return { success: false, error: profileError.message };
  }

  if (!existing) {
    return { success: false, error: "User not found." };
  }

  if (existing.email.trim().toLowerCase() === normalized) {
    return { success: true, data: existing as Profile };
  }

  try {
    const admin = createServiceRoleClient();
    const conflict = await findConflictingAuthEmail(
      admin,
      normalized,
      targetUserId
    );
    if (conflict) {
      return {
        success: false,
        error: "Another user already uses this email.",
      };
    }

    const authResult = await updateAuthUserEmail(admin, targetUserId, normalized);
    if (!authResult.success) {
      return { success: false, error: authResult.error };
    }

    const { data, error } = await supabase.rpc("admin_update_user_email", {
      target_user_id: targetUserId,
      new_email: normalized,
    });

    if (error) {
      if (authResult.oldEmail && authResult.oldEmail !== normalized) {
        await updateAuthUserEmail(admin, targetUserId, authResult.oldEmail);
      }
      return { success: false, error: error.message };
    }

    revalidatePath("/admin");
    revalidatePath("/admin/access");
    return { success: true, data: data as Profile };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update email.",
    };
  }
}

type TargetProfile = { id: string; email: string; role: string };

async function loadAdminTarget(
  targetUserId: string,
  actorUserId: string,
  actorEmail: string | null | undefined
): Promise<ActionResult<TargetProfile>> {
  if (!targetUserId?.trim()) {
    return { success: false, error: "Target user is required." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, role")
    .eq("id", targetUserId)
    .maybeSingle();

  if (error) return { success: false, error: error.message };
  if (!data) return { success: false, error: "User not found." };

  const sameAccount =
    targetUserId === actorUserId ||
    (Boolean(actorEmail?.trim()) &&
      (data.email ?? "").trim().toLowerCase() ===
        actorEmail!.trim().toLowerCase());
  if (sameAccount) {
    return { success: false, error: "You cannot change your own account here." };
  }

  if (data.role === "admin") {
    const { count, error: countError } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");

    if (countError) return { success: false, error: countError.message };
    if ((count ?? 0) <= 1) {
      return { success: false, error: "Cannot remove access for the last admin." };
    }
  }

  return { success: true, data: data as TargetProfile };
}

function revalidateAdminUsers() {
  revalidatePath("/admin");
  revalidatePath("/admin/users");
  revalidatePath("/admin/access");
}

/** Block or restore sign-in. The account and its role stay in place. */
export async function setUserAccessAction(
  targetUserId: string,
  denied: boolean
): Promise<ActionResult<null>> {
  const gate = await assertAdmin();
  if (!gate.success) return gate;

  const target = await loadAdminTarget(
    targetUserId,
    gate.data.userId,
    gate.data.email
  );
  if (!target.success) return target;

  try {
    const admin = createServiceRoleClient();
    const result = await setAuthUserDenied(admin, targetUserId, denied);
    if (!result.success) return result;

    revalidateAdminUsers();
    return { success: true, data: null };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update access.",
    };
  }
}

/** Permanently delete the auth account. The profile is removed with it. */
export async function deleteUserAction(
  targetUserId: string
): Promise<ActionResult<null>> {
  const gate = await assertAdmin();
  if (!gate.success) return gate;

  const target = await loadAdminTarget(
    targetUserId,
    gate.data.userId,
    gate.data.email
  );
  if (!target.success) return target;

  try {
    const admin = createServiceRoleClient();
    const result = await deleteAuthUserById(admin, targetUserId);
    if (!result.success) return result;

    revalidateAdminUsers();
    return { success: true, data: null };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to delete user.",
    };
  }
}
