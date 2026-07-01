import type { ProjectStatus } from "@/lib/projects/lifecycle";

export function projectStatusLabel(status: ProjectStatus | undefined | null): string {
  switch (status ?? "active") {
    case "completed":
      return "Completed";
    case "archived":
      return "Archived";
    default:
      return "Active";
  }
}

export function projectStatusBadgeClass(status: ProjectStatus | undefined | null): string {
  switch (status ?? "active") {
    case "completed":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "archived":
      return "border-slate-300 bg-slate-100 text-slate-700";
    default:
      return "border-blue-200 bg-blue-50 text-blue-800";
  }
}

export function projectStatusIcon(status: ProjectStatus | undefined | null): string {
  switch (status ?? "active") {
    case "completed":
      return "✅";
    case "archived":
      return "📦";
    default:
      return "●";
  }
}

export function lifecycleActionLabel(action: string): string {
  switch (action) {
    case "project_created":
      return "Project created";
    case "project_completed":
      return "Project completed";
    case "project_archived":
      return "Project archived";
    case "project_restored":
      return "Project restored";
    case "project_deleted":
      return "Project deleted";
    default:
      return action.replace(/_/g, " ");
  }
}

export function formatProjectAge(days: number): string {
  if (days <= 0) return "Created today";
  if (days === 1) return "1 day old";
  if (days < 30) return `${days} days old`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month old" : `${months} months old`;
}
