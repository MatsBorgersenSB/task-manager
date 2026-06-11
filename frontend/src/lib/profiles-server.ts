import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { countAdmins } from "@/lib/admin/validation";
import {
  getCurrentUserRole,
  getProfile,
} from "@/lib/profiles";
import type { UserRole } from "@/lib/roles";
import type { AdminDashboardData, AuditLog, Invite, Profile } from "@/lib/types";

const COMPANY_DOMAIN =
  process.env.NEXT_PUBLIC_COMPANY_EMAIL_DOMAIN ?? "yourcompany.com";

/**
 * Server-side profile bootstrap via RPC.
 * Uses getUser() (cookie-backed, validated on the server) — never throws.
 */
async function bootstrapProfileOnServer(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<Profile | null> {
  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.email) {
      if (userError) {
        console.warn("[bootstrapProfileOnServer] getUser:", userError.message);
      }
      return null;
    }

    const { data, error } = await supabase.rpc("ensure_user_profile", {
      user_email: user.email,
      company_domain: COMPANY_DOMAIN,
    });

    if (error) {
      console.warn("[bootstrapProfileOnServer] RPC:", error.message);
      return null;
    }

    if (!data) {
      console.warn("[bootstrapProfileOnServer] RPC returned no profile");
      return null;
    }

    return data as Profile;
  } catch (err) {
    console.warn(
      "[bootstrapProfileOnServer]",
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

export async function ensureUserProfileServer(_email: string) {
  const supabase = await createClient();
  return bootstrapProfileOnServer(supabase);
}

export async function getCurrentUserRoleServer(): Promise<UserRole | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) return null;
  return getCurrentUserRole(supabase, user.id, user.email);
}

export async function getProfileServer(userId: string) {
  const supabase = await createClient();
  return getProfile(supabase, userId);
}

/**
 * Load session + profile for server components.
 * Bootstraps via RPC when profile is missing; never throws.
 */
export async function getAuthContextServer() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return { user: null, profile: null, isAdmin: false };
  }

  let profile = await getProfile(supabase, user.id);
  if (!profile) {
    profile = await bootstrapProfileOnServer(supabase);
  }

  return {
    user,
    profile,
    isAdmin: profile?.role === "admin",
  };
}

/**
 * Server-side admin gate — redirects non-admins to /dashboard.
 * Always enforce on admin pages (never rely on UI-only checks).
 */
export async function requireAdminAccess() {
  const ctx = await getAuthContextServer();

  if (!ctx.user) {
    redirect("/login");
  }

  if (!ctx.profile || !ctx.isAdmin) {
    redirect("/dashboard");
  }

  return ctx;
}

/**
 * Internal-only gate — admin and internal roles.
 * External users are redirected to /dashboard.
 */
export async function requireInternalAccess(): Promise<{
  user: NonNullable<Awaited<ReturnType<typeof getAuthContextServer>>["user"]>;
  profile: Profile;
  isAdmin: boolean;
}> {
  const ctx = await getAuthContextServer();

  if (!ctx.user) {
    redirect("/login");
  }

  if (!ctx.profile) {
    redirect("/dashboard");
  }

  if (ctx.profile.role !== "admin" && ctx.profile.role !== "internal") {
    redirect("/dashboard");
  }

  return {
    user: ctx.user,
    profile: ctx.profile,
    isAdmin: ctx.isAdmin,
  };
}

/** Single round-trip admin dashboard load (parallel queries, one client). */
export async function fetchAdminDashboardData(): Promise<AdminDashboardData> {
  const supabase = await createClient();

  const [profilesResult, invitesResult, auditResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, role, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("invites")
      .select("id, email, role, invited_by, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("audit_logs")
      .select(
        "id, action, actor_user_id, target_user_id, metadata, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (profilesResult.error) throw new Error(profilesResult.error.message);
  if (invitesResult.error) throw new Error(invitesResult.error.message);
  if (auditResult.error) throw new Error(auditResult.error.message);

  const profiles = (profilesResult.data as Profile[]) ?? [];

  return {
    profiles,
    invites: (invitesResult.data as Invite[]) ?? [],
    auditLogs: normalizeAuditLogs(auditResult.data),
    adminCount: countAdmins(profiles),
  };
}

function normalizeAuditLogs(
  rows: Record<string, unknown>[] | null
): AuditLog[] {
  return (rows ?? []).map((row) => ({
    id: row.id as string,
    action: row.action as string,
    actor_user_id: (row.actor_user_id ?? row.user_id ?? null) as string | null,
    target_user_id: (row.target_user_id ?? row.target_id ?? null) as
      | string
      | null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    created_at: row.created_at as string,
  }));
}

/** @deprecated Use fetchAdminDashboardData */
export async function listAllProfilesServer(): Promise<Profile[]> {
  const { profiles } = await fetchAdminDashboardData();
  return profiles;
}

/** @deprecated Use fetchAdminDashboardData */
export async function listInvitesServer(): Promise<Invite[]> {
  const { invites } = await fetchAdminDashboardData();
  return invites;
}

/** @deprecated Use fetchAdminDashboardData */
export async function listAuditLogsServer(limit = 50): Promise<AuditLog[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("audit_logs")
    .select(
      "id, action, actor_user_id, target_user_id, metadata, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return normalizeAuditLogs(data as Record<string, unknown>[]);
}

/** @deprecated Use requireAdminAccess */
export async function requireAdminServer() {
  return requireAdminAccess();
}

/** Re-export for dashboard retry — uses server RPC path */
export { bootstrapProfileOnServer };
