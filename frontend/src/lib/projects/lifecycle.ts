export type ProjectStatus = "active" | "completed" | "archived";

export type ProjectLifecycleAction =
  | "complete"
  | "archive"
  | "restore_active"
  | "restore_completed";

export type DeleteReason =
  | "Duplicate Project"
  | "Test Data"
  | "Created By Mistake"
  | "Project Cancelled"
  | "Other";

export const DELETE_REASONS: DeleteReason[] = [
  "Duplicate Project",
  "Test Data",
  "Created By Mistake",
  "Project Cancelled",
  "Other",
];

export type ProjectLifecycleFilter = "all" | "active" | "completed" | "archived";

export type ProjectDeleteImpact = {
  project_id: string;
  project_name: string;
  project_status: ProjectStatus;
  created_at: string;
  project_age_days: number;
  template_name: string | null;
  template_version: number | null;
  main_tasks: number;
  subtasks: number;
  tasks_total: number;
  comments: number;
  activity_entries: number;
  users_assigned: number;
  invitations: number;
};

export type ProjectLifecycleEvent = {
  id: string;
  project_id: string | null;
  project_name: string;
  action: string;
  from_status: string | null;
  to_status: string | null;
  reason: string | null;
  actor_user_id: string | null;
  created_at: string;
};

export type LifecycleDashboard = {
  active_count: number;
  completed_count: number;
  archived_count: number;
  deleted_this_month: number;
  recent_events: ProjectLifecycleEvent[];
};

export function isProjectReadOnly(status: ProjectStatus | undefined | null): boolean {
  return status === "archived";
}

export function filterProjectsForToolbar(
  projects: Array<{ id: string; name: string; deleted_at?: string | null; project_status?: ProjectStatus | null }>,
  selectedProjectId: string | null
): Array<{ id: string; name: string; deleted_at?: string | null; project_status?: ProjectStatus | null }> {
  const operational = projects.filter(
    (project) =>
      !project.deleted_at && (project.project_status ?? "active") !== "archived"
  );
  if (!selectedProjectId) return operational;

  const selected = projects.find((project) => project.id === selectedProjectId);
  if (
    selected &&
    !selected.deleted_at &&
    (selected.project_status ?? "active") === "archived" &&
    !operational.some((project) => project.id === selectedProjectId)
  ) {
    return [selected, ...operational].sort((a, b) => a.name.localeCompare(b.name));
  }

  return operational;
}

export function isProjectDeleted(project: { deleted_at?: string | null }): boolean {
  return Boolean(project.deleted_at);
}
