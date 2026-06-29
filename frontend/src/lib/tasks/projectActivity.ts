import { createClient } from "@/lib/supabase/client";
import { supabaseErrorMessage } from "@/lib/tasks/db-mapper";
import type { TaskViewMode } from "@/lib/tasks/types";

export type ProjectActivityEventType =
  | "task_created"
  | "due_date_changed"
  | "client_comment_added"
  | "internal_comment_added"
  | "subtask_completed"
  | "project_shared"
  | "link_added"
  | "client_task_opened"
  | "client_project_viewed"
  | "client_acknowledged"
  | "status_changed"
  | "task_completed";

export type ProjectActivityEntry = {
  id: string;
  project_id: string;
  task_id: string | null;
  event_type: ProjectActivityEventType;
  summary: string;
  detail: string | null;
  client_visible: boolean;
  created_by: string | null;
  created_at: string;
  author_email: string | null;
  task_number: number | null;
  task_title: string | null;
};

type ProjectActivityRow = {
  id: string;
  project_id: string;
  task_id: string | null;
  event_type: string;
  summary: string;
  detail: string | null;
  client_visible: boolean;
  created_by: string | null;
  created_at: string;
  author: { email: string } | { email: string }[] | null;
  task: { task_number: number; title: string } | { task_number: number; title: string }[] | null;
};

function mapProjectActivityRow(row: ProjectActivityRow): ProjectActivityEntry {
  const author = Array.isArray(row.author) ? row.author[0] : row.author;
  const task = Array.isArray(row.task) ? row.task[0] : row.task;

  return {
    id: row.id,
    project_id: row.project_id,
    task_id: row.task_id,
    event_type: row.event_type as ProjectActivityEventType,
    summary: row.summary,
    detail: row.detail,
    client_visible: row.client_visible,
    created_by: row.created_by,
    created_at: row.created_at,
    author_email: author?.email ?? null,
    task_number: task?.task_number ?? null,
    task_title: task?.title ?? null,
  };
}

function isProjectActivityMissingError(error: { message: string; code?: string }): boolean {
  const message = error.message.toLowerCase();
  return (
    error.code === "PGRST205" ||
    (message.includes("project_activity") &&
      (message.includes("schema cache") ||
        message.includes("does not exist") ||
        message.includes("could not find the table")))
  );
}

export async function fetchProjectActivity(
  projectId: string,
  mode: TaskViewMode,
  limit = 50
): Promise<{ entries: ProjectActivityEntry[]; tableMissing: boolean }> {
  const supabase = createClient();
  let query = supabase
    .from("project_activity")
    .select(
      "id, project_id, task_id, event_type, summary, detail, client_visible, created_by, created_at, author:profiles!project_activity_created_by_fkey(email), task:tasks(task_number, title)"
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (mode === "client") {
    query = query.eq("client_visible", true);
  }

  const { data, error } = await query;

  if (error) {
    if (isProjectActivityMissingError(error)) {
      return { entries: [], tableMissing: true };
    }
    throw new Error(supabaseErrorMessage(error));
  }

  return {
    entries: ((data ?? []) as ProjectActivityRow[]).map(mapProjectActivityRow),
    tableMissing: false,
  };
}

export async function logProjectActivity(input: {
  projectId: string;
  taskId?: string | null;
  eventType: ProjectActivityEventType;
  summary: string;
  detail?: string | null;
  clientVisible?: boolean;
}): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("project_activity").insert({
    project_id: input.projectId,
    task_id: input.taskId ?? null,
    event_type: input.eventType,
    summary: input.summary,
    detail: input.detail ?? null,
    client_visible: input.clientVisible ?? false,
    created_by: user?.id ?? null,
  });

  if (error && !isProjectActivityMissingError(error)) {
    throw new Error(supabaseErrorMessage(error));
  }
}

export function formatProjectActivityDate(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatRelativeDaysAgo(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;

  const diffDays = Math.floor((Date.now() - parsed.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "1 day ago";
  return `${diffDays} days ago`;
}

export function countClientActivityLast7Days(entries: ProjectActivityEntry[]): number {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return entries.filter((entry) => {
    const created = new Date(entry.created_at).getTime();
    if (Number.isNaN(created) || created < cutoff) return false;
    return (
      entry.event_type === "client_comment_added" ||
      entry.event_type === "client_acknowledged" ||
      entry.event_type === "client_task_opened" ||
      entry.event_type === "status_changed" ||
      entry.event_type === "task_completed"
    );
  }).length;
}

export function lastClientActivityAt(entries: ProjectActivityEntry[]): string | null {
  const clientEvents = entries.filter(
    (entry) =>
      entry.client_visible &&
      (entry.event_type.startsWith("client_") ||
        entry.event_type === "client_comment_added" ||
        entry.event_type === "client_acknowledged")
  );
  return clientEvents[0]?.created_at ?? null;
}
