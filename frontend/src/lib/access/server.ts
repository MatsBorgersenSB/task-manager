import { createClient } from "@/lib/supabase/server";
import type {
  AccessDirectoryUser,
  LoginSession,
  SuspiciousLogin,
  UserAccessDetail,
} from "@/lib/access/types";
import type { UserRole } from "@/lib/roles";

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

function directoryFromProfile(row: {
  id: string;
  email: string;
  role: string;
  created_at: string;
}): AccessDirectoryUser {
  const email = row.email ?? "";
  return {
    id: row.id,
    email,
    role: row.role as UserRole,
    display_name: email.split("@")[0] || email,
    created_at: row.created_at,
    last_login_at: null,
    last_activity_at: null,
    projects_assigned: 0,
    projects_shared: 0,
    login_count: 0,
    suspicious_login_count: 0,
  };
}

async function listProfilesForAccess(): Promise<AccessDirectoryUser[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, role, created_at")
    .order("email", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as {
    id: string;
    email: string;
    role: string;
    created_at: string;
  }[]).map(directoryFromProfile);
}

export async function fetchAccessDirectory(): Promise<AccessDirectoryUser[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_get_access_directory");

  if (error) {
    if (isMissingFunctionError(error)) return listProfilesForAccess();
    throw new Error(error.message);
  }

  return ((data as AccessDirectoryUser[]) ?? []).map((row) => ({
    ...row,
    role: row.role as UserRole,
  }));
}

export async function fetchUserAccessDetail(
  userId: string
): Promise<UserAccessDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_get_user_access_detail", {
    p_user_id: userId,
  });

  if (error) {
    if (!isMissingFunctionError(error)) {
      throw new Error(error.message);
    }
    const users = await listProfilesForAccess();
    const profile = users.find((user) => user.id === userId);
    if (!profile) return null;
    return { profile, sessions: [] };
  }

  if (!data) return null;

  const payload = data as {
    profile: AccessDirectoryUser;
    sessions: LoginSession[];
  };

  return {
    profile: { ...payload.profile, role: payload.profile.role as UserRole },
    sessions: payload.sessions ?? [],
  };
}

export async function fetchSuspiciousLogins(limit = 25): Promise<SuspiciousLogin[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_get_recent_suspicious_logins", {
    p_limit: limit,
  });

  if (error) {
    if (isMissingFunctionError(error)) return [];
    throw new Error(error.message);
  }

  return (data as SuspiciousLogin[]) ?? [];
}

/** True when login-history RPCs from migration 050 are installed. */
export async function accessLoginHistoryAvailable(): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_get_access_directory");
  if (!error) return true;
  return !isMissingFunctionError(error);
}
