import { isInternal, type UserRole } from "@/lib/roles";
import type { TaskViewMode } from "@/lib/tasks/types";

export function canAccessInternalView(
  role: UserRole | string | null | undefined
): boolean {
  return isInternal(role);
}

export function viewPathForMode(
  mode: TaskViewMode,
  projectId?: string | null
): string {
  const base = mode === "internal" ? "/internal" : "/client";
  if (!projectId) return base;
  return `${base}?project=${encodeURIComponent(projectId)}`;
}

export function viewModeLabel(mode: TaskViewMode): string {
  return mode === "internal" ? "INTERNAL VIEW" : "CLIENT VIEW";
}

/** Application title shown in client vs internal contexts. */
export function appTitleForMode(mode: TaskViewMode): string {
  return mode === "client" ? "Project Portal" : "Task Manager";
}

/** Short description shown under the header title. */
export function viewModeDescription(mode: TaskViewMode): string {
  if (mode === "internal") {
    return "Full task access — internal fields, owners, and admin tools.";
  }
  return "Your shared project — progress, updates, and discussion with your team.";
}
