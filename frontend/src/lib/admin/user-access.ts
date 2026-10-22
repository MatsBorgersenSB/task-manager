import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/admin/delete-auth-user";

type RpcError = { message?: string; code?: string } | null;

function isMissingFunctionError(error: RpcError): boolean {
  if (!error?.message) return false;
  const message = error.message.toLowerCase();
  return (
    error.code === "PGRST202" ||
    message.includes("could not find the function") ||
    (message.includes("schema cache") && message.includes("function"))
  );
}

function accessControlUnavailableMessage(): string {
  return "Access was not changed. Run migration 059_admin_user_access.sql in the Supabase SQL editor, then try again.";
}

/** Long enough that a denied account cannot sign in again until an admin restores it. */
const DENY_DURATION = "876000h";

export function isAuthUserDenied(bannedUntil: string | null | undefined): boolean {
  if (!bannedUntil) return false;
  const until = new Date(bannedUntil).getTime();
  return Number.isFinite(until) && until > Date.now();
}

export function isUserAccessDenied(user: Pick<User, "banned_until" | "app_metadata">): boolean {
  if (user.app_metadata?.access_denied === true) return true;
  return isAuthUserDenied(user.banned_until);
}

/**
 * Auth user ids whose sign-in is currently blocked.
 * Prefers the admin RPC (session). Falls back to the Auth admin API.
 */
export async function readDeniedUserIds(
  session: SupabaseClient
): Promise<string[]> {
  const rpc = await session.rpc("admin_list_denied_user_ids");
  if (!rpc.error) {
    return (rpc.data ?? []).map((id: unknown) => String(id));
  }
  if (!isMissingFunctionError(rpc.error)) {
    throw new Error(rpc.error.message);
  }
  return listDeniedUserIds();
}

/** Block or restore sign-in. Uses the admin RPC, then the Auth admin API. */
export async function setUserAccessDenied(
  session: SupabaseClient,
  userId: string,
  denied: boolean
): Promise<{ success: true } | { success: false; error: string }> {
  const rpc = await session.rpc("admin_set_user_access", {
    target_user_id: userId,
    denied,
  });

  if (!rpc.error) {
    if (rpc.data !== denied) {
      return {
        success: false,
        error: "Access status did not change. Refresh and try again.",
      };
    }
    return { success: true };
  }

  if (!isMissingFunctionError(rpc.error)) {
    return { success: false, error: rpc.error.message };
  }

  try {
    const admin = createServiceRoleClient();
    return await setAuthUserDenied(admin, userId, denied);
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      return { success: false, error: accessControlUnavailableMessage() };
    }
    return {
      success: false,
      error: message || "Failed to update access.",
    };
  }
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
      if (isUserAccessDenied(user)) {
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
  const existing = await admin.auth.admin.getUserById(userId);
  if (existing.error || !existing.data.user) {
    return {
      success: false,
      error: existing.error?.message ?? "User was not found in authentication.",
    };
  }

  const previousMeta = existing.data.user.app_metadata ?? {};
  const { data, error } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: denied ? DENY_DURATION : "none",
    app_metadata: {
      ...previousMeta,
      access_denied: denied,
    },
  });

  if (error || !data.user) {
    return {
      success: false,
      error: error?.message ?? "Access status did not change.",
    };
  }

  if (isUserAccessDenied(data.user) !== denied) {
    return {
      success: false,
      error: "Access status did not change. Refresh and try again.",
    };
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
