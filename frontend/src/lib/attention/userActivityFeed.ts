import { createClient } from "@/lib/supabase/client";
import { isMissingTableError } from "@/lib/supabase/schemaFallback";
import { supabaseErrorMessage } from "@/lib/tasks/db-mapper";
import type { ProjectActivityEventType } from "@/lib/tasks/projectActivity";

export type UserActivityEntry = {
  id: string;
  project_id: string;
  task_id: string | null;
  event_type: ProjectActivityEventType | string;
  summary: string;
  detail: string | null;
  created_at: string;
  project_name: string | null;
  task_number: number | null;
  task_title: string | null;
};

const RELEVANT_EVENTS = new Set([
  "task_created",
  "due_date_changed",
  "client_comment_added",
  "internal_comment_added",
  "subtask_completed",
  "project_shared",
  "link_added",
  "client_task_opened",
  "client_project_viewed",
  "client_acknowledged",
  "status_changed",
  "task_completed",
]);

function activityHeadline(eventType: string, summary: string): string {
  switch (eventType) {
    case "task_created":
      return "Task assigned";
    case "client_comment_added":
      return "Comment received";
    case "internal_comment_added":
      return "Internal comment";
    case "task_completed":
      return "Task completed";
    case "project_shared":
    case "link_added":
    case "status_changed":
    case "due_date_changed":
      return "Project updated";
    case "client_acknowledged":
      return "Acknowledgement";
    default:
      return summary;
  }
}

export async function fetchUserActivityFeed(
  limit = 30
): Promise<UserActivityEntry[]> {
  const supabase = createClient();
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("project_activity")
    .select(
      "id, project_id, task_id, event_type, summary, detail, created_at, projects:project_id (name), tasks:task_id (task_number, title)"
    )
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (isMissingTableError(error, "project_activity")) {
      return [];
    }
    throw new Error(supabaseErrorMessage(error));
  }

  return (data ?? [])
    .filter((row) => RELEVANT_EVENTS.has(row.event_type as string))
    .map((row) => {
      const project = Array.isArray(row.projects) ? row.projects[0] : row.projects;
      const task = Array.isArray(row.tasks) ? row.tasks[0] : row.tasks;
      const eventType = row.event_type as string;
      return {
        id: row.id,
        project_id: row.project_id,
        task_id: row.task_id,
        event_type: eventType,
        summary: activityHeadline(eventType, row.summary),
        detail: row.detail,
        created_at: row.created_at,
        project_name: project?.name ?? null,
        task_number: task?.task_number ?? null,
        task_title: task?.title ?? null,
      };
    });
}
