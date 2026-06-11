import type { UserRole } from "@/lib/roles";

export type Profile = {
  id: string;
  email: string;
  role: UserRole;
  created_at: string;
};

export type Invite = {
  id: string;
  email: string;
  role: UserRole;
  invited_by: string | null;
  created_at: string;
};

export type AuditLog = {
  id: string;
  action: string;
  actor_user_id: string | null;
  target_user_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  /** @deprecated Legacy column — use actor_user_id */
  user_id?: string | null;
  /** @deprecated Legacy column — use target_user_id */
  target_id?: string | null;
};

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

export type AdminDashboardData = {
  profiles: Profile[];
  invites: Invite[];
  auditLogs: AuditLog[];
  adminCount: number;
};
