import type { UserRole } from "@/lib/roles";

export const USER_ROLES: UserRole[] = ["admin", "internal", "external"];

/** Server-side validation before RPC calls — never trust client input alone. */
export function isValidUserRole(value: string): value is UserRole {
  return USER_ROLES.includes(value as UserRole);
}

export function countAdmins(
  profiles: { role: UserRole | string }[]
): number {
  return profiles.filter((p) => p.role === "admin").length;
}

/** Whether demoting this profile would remove the last admin. */
export function isLastAdminDemotion(
  profile: { id: string; role: UserRole | string },
  newRole: UserRole,
  adminCount: number
): boolean {
  return profile.role === "admin" && newRole !== "admin" && adminCount <= 1;
}
