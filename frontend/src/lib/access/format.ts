export function formatAccessDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function formatRelativeLastSeen(iso: string | null | undefined): string {
  if (!iso) return "Never";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "—";

  const diffMs = Date.now() - parsed.getTime();
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? "" : "s"} ago`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;

  return parsed.toLocaleDateString(undefined, { dateStyle: "medium" });
}

export function formatSessionDuration(seconds: number | null | undefined): string {
  if (seconds == null || seconds < 0) return "—";
  if (seconds < 60) return `${seconds}s`;
  const min = Math.floor(seconds / 60);
  const rem = seconds % 60;
  if (min < 60) return rem > 0 ? `${min}m ${rem}s` : `${min}m`;
  const hours = Math.floor(min / 60);
  const remMin = min % 60;
  return remMin > 0 ? `${hours}h ${remMin}m` : `${hours}h`;
}

export function isUserOnline(
  lastActivityAt: string | null | undefined,
  onlineUserIds?: Set<string>,
  userId?: string
): boolean {
  if (userId && onlineUserIds?.has(userId)) return true;
  if (!lastActivityAt) return false;
  const parsed = new Date(lastActivityAt);
  if (Number.isNaN(parsed.getTime())) return false;
  return Date.now() - parsed.getTime() < 2 * 60_000;
}

export function userDisplayName(email: string, displayName?: string | null): string {
  const name = displayName?.trim();
  if (name) return name;
  const local = email.split("@")[0] ?? email;
  return local.replace(/[._]/g, " ");
}

export function roleStatusLabel(role: string): string {
  switch (role) {
    case "admin":
      return "Admin";
    case "internal":
      return "Internal";
    case "external":
      return "Client";
    default:
      return role;
  }
}
