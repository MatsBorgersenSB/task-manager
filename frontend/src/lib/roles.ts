export type UserRole = "admin" | "internal" | "external";

export type { Profile, Invite, AuditLog } from "@/lib/types";

const COMPANY_DOMAIN =
  process.env.NEXT_PUBLIC_COMPANY_EMAIL_DOMAIN ?? "yourcompany.com";

/**
 * Resolve role for a brand-new profile (docs/tests only — DB RPC is source of truth).
 * Priority: first user → admin; else invite → invited role; else domain → internal; else external.
 */
export function resolveRoleForNewUser(
  email: string,
  profilesTableEmpty: boolean,
  invitedRole?: UserRole | null
): UserRole {
  if (profilesTableEmpty) {
    return "admin";
  }
  if (invitedRole) {
    return invitedRole;
  }
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  return domain === COMPANY_DOMAIN.toLowerCase() ? "internal" : "external";
}

export function isAdmin(role: UserRole | string | null | undefined): boolean {
  return role === "admin";
}

export function isInternal(role: UserRole | string | null | undefined): boolean {
  return role === "internal" || role === "admin";
}

export function roleBadgeClass(role: UserRole | string): string {
  if (role === "admin") {
    return "bg-accent/20 text-primary";
  }
  if (role === "internal") {
    return "bg-primary/10 text-primary";
  }
  return "bg-secondary/10 text-secondary";
}
