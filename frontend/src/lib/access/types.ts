import type { UserRole } from "@/lib/roles";

export type AccessDirectoryUser = {
  id: string;
  email: string;
  role: UserRole;
  display_name: string;
  created_at: string;
  last_login_at: string | null;
  last_activity_at: string | null;
  projects_assigned: number;
  projects_shared: number;
  login_count: number;
  suspicious_login_count: number;
};

export type LoginSession = {
  id: string;
  login_at: string;
  logout_at: string | null;
  session_duration_seconds: number | null;
  auth_provider: string | null;
  ip_address: string | null;
  user_agent: string | null;
  device_type: string | null;
  browser: string | null;
  platform: string | null;
  is_suspicious: boolean;
  suspicion_reason: string | null;
};

export type SuspiciousLogin = LoginSession & {
  user_id: string;
  email: string;
};

export type UserAccessDetail = {
  profile: AccessDirectoryUser;
  sessions: LoginSession[];
};

export const ACCESS_SESSION_STORAGE_KEY = "sb_access_session_id";
