"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isValidUserRole } from "@/lib/admin/validation";
import { getAuthContextServer } from "@/lib/profiles-server";
import type { UserRole } from "@/lib/roles";
import type { ActionResult, Invite, Profile } from "@/lib/types";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Gate all admin mutations — returns error instead of redirecting. */
async function assertAdmin(): Promise<ActionResult<{ userId: string }>> {
  const ctx = await getAuthContextServer();
  if (!ctx.user || !ctx.profile) {
    return { success: false, error: "You must be signed in." };
  }
  if (!ctx.isAdmin) {
    return { success: false, error: "Admin access required." };
  }
  return { success: true, data: { userId: ctx.user.id } };
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
