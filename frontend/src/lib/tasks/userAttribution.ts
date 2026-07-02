import { createClient } from "@/lib/supabase/client";
import { userDisplayName } from "@/lib/access/format";

export type UserProfileRef = {
  id: string;
  email: string;
  display_name: string | null;
};

export function resolveDisplayName(
  email: string | null | undefined,
  displayName?: string | null
): string {
  if (!email?.trim()) return "Unknown user";
  return userDisplayName(email, displayName);
}

export function userInitials(
  displayName: string,
  email?: string | null
): string {
  const trimmed = displayName.trim();
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }
  if (trimmed.length >= 2) {
    return trimmed.slice(0, 2).toUpperCase();
  }
  if (email) {
    const local = email.split("@")[0] ?? "";
    const localParts = local.split(/[._-]+/).filter(Boolean);
    if (localParts.length >= 2) {
      return `${localParts[0][0] ?? ""}${localParts[1][0] ?? ""}`.toUpperCase();
    }
    return local.slice(0, 2).toUpperCase() || "?";
  }
  return "?";
}

export async function loadUserProfiles(
  userIds: string[]
): Promise<Map<string, UserProfileRef>> {
  const byId = new Map<string, UserProfileRef>();
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  if (uniqueIds.length === 0) return byId;

  const supabase = createClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, display_name")
    .in("id", uniqueIds);

  for (const profile of profiles ?? []) {
    if (!profile.id || !profile.email) continue;
    byId.set(profile.id, {
      id: profile.id,
      email: profile.email,
      display_name: profile.display_name ?? null,
    });
  }

  return byId;
}

export function profileDisplayName(profile: UserProfileRef | undefined): string {
  if (!profile) return "Unknown user";
  return resolveDisplayName(profile.email, profile.display_name);
}

export async function getCurrentActorProfile(): Promise<UserProfileRef | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, display_name")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.email) {
    return {
      id: user.id,
      email: user.email ?? "",
      display_name: null,
    };
  }

  return {
    id: profile.id,
    email: profile.email,
    display_name: profile.display_name ?? null,
  };
}
