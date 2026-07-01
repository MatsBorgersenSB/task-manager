import { createClient } from "@/lib/supabase/server";
import type {
  AccessDirectoryUser,
  LoginSession,
  SuspiciousLogin,
  UserAccessDetail,
} from "@/lib/access/types";
import type { UserRole } from "@/lib/roles";

export async function fetchAccessDirectory(): Promise<AccessDirectoryUser[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_get_access_directory");

  if (error) {
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
    throw new Error(error.message);
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
    throw new Error(error.message);
  }

  return (data as SuspiciousLogin[]) ?? [];
}
