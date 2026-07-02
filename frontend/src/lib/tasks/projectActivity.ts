import { createClient } from "@/lib/supabase/client";
import {
  extractMissingColumnName,
  isMissingTableError,
} from "@/lib/supabase/schemaFallback";
import { supabaseErrorMessage } from "@/lib/tasks/db-mapper";
import type { TaskViewMode } from "@/lib/tasks/types";
import {
  loadUserProfiles,
  profileDisplayName,
} from "@/lib/tasks/userAttribution";

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
  | "task_completed"
  | "project_generated_from_template";

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
  updated_by: string | null;
  updated_at: string | null;
  author_email: string | null;
  author_name: string | null;
  editor_name: string | null;
  task_number: number | null;
  task_title: string | null;
};

export type ProjectActivityFetchResult = {
  entries: ProjectActivityEntry[];
  /** True only when the project_activity table itself is absent. */
  tableMissing: boolean;
  error: string | null;
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
  updated_by?: string | null;
  updated_at?: string | null;
  task?: { task_number: number; title: string } | { task_number: number; title: string }[] | null;
};

const PROJECT_ACTIVITY_BASE_SELECT =
  "id, project_id, task_id, event_type, summary, detail, client_visible, created_by, created_at, updated_by, updated_at";

const PROJECT_ACTIVITY_LEGACY_SELECT =
  "id, project_id, task_id, event_type, summary, detail, client_visible, created_by, created_at";

function mapProjectActivityRow(
  row: ProjectActivityRow,
  profilesById: Awaited<ReturnType<typeof loadUserProfiles>>
): ProjectActivityEntry {
  const task = Array.isArray(row.task) ? row.task[0] : row.task;
  const authorProfile = row.created_by
    ? profilesById.get(row.created_by)
    : undefined;
  const editorProfile = row.updated_by
    ? profilesById.get(row.updated_by)
    : undefined;

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
    updated_by: row.updated_by ?? null,
    updated_at: row.updated_at ?? null,
    author_email: authorProfile?.email ?? null,
    author_name: authorProfile ? profileDisplayName(authorProfile) : null,
    editor_name: editorProfile ? profileDisplayName(editorProfile) : null,
    task_number: task?.task_number ?? null,
    task_title: task?.title ?? null,
  };
}

export async function fetchProjectActivity(
  projectId: string,
  mode: TaskViewMode,
  limit = 50
): Promise<ProjectActivityFetchResult> {
  const supabase = createClient();

  async function queryRowsBase(selectColumns: string) {
    let request = supabase
      .from("project_activity")
      .select(selectColumns)
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (mode === "client") {
      request = request.eq("client_visible", true);
    }

    return request;
  }

  async function queryRowsWithTask(selectColumns: string) {
    let request = supabase
      .from("project_activity")
      .select(`${selectColumns}, task:tasks(task_number, title)`)
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (mode === "client") {
      request = request.eq("client_visible", true);
    }

    return request;
  }

  let selectColumns = PROJECT_ACTIVITY_BASE_SELECT;
  let withTaskResult = await queryRowsWithTask(selectColumns);
  let rows: ProjectActivityRow[];

  if (
    withTaskResult.error &&
    extractMissingColumnName(withTaskResult.error) &&
    selectColumns === PROJECT_ACTIVITY_BASE_SELECT
  ) {
    selectColumns = PROJECT_ACTIVITY_LEGACY_SELECT;
    withTaskResult = await queryRowsWithTask(selectColumns);
  }

  if (
    withTaskResult.error &&
    withTaskJoinError(withTaskResult.error) &&
    !isMissingTableError(withTaskResult.error, "project_activity")
  ) {
    const baseResult = await queryRowsBase(selectColumns);
    if (baseResult.error) {
      if (isMissingTableError(baseResult.error, "project_activity")) {
        return { entries: [], tableMissing: true, error: null };
      }
      return {
        entries: [],
        tableMissing: false,
        error: supabaseErrorMessage(baseResult.error),
      };
    }
    rows = (baseResult.data ?? []) as unknown as ProjectActivityRow[];
  } else if (withTaskResult.error) {
    if (isMissingTableError(withTaskResult.error, "project_activity")) {
      return { entries: [], tableMissing: true, error: null };
    }
    return {
      entries: [],
      tableMissing: false,
      error: supabaseErrorMessage(withTaskResult.error),
    };
  } else {
    rows = (withTaskResult.data ?? []) as unknown as ProjectActivityRow[];
  }
  const userIds = [
    ...new Set(
      rows
        .flatMap((row) => [row.created_by, row.updated_by])
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const profilesById = await loadUserProfiles(userIds);

  return {
    entries: rows.map((row) => mapProjectActivityRow(row, profilesById)),
    tableMissing: false,
    error: null,
  };
}

function withTaskJoinError(error: { message?: string }): boolean {
  const message = (error.message ?? "").toLowerCase();
  return (
    message.includes("tasks") ||
    message.includes("relationship") ||
    message.includes("embed")
  );
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

  if (error && !isMissingTableError(error, "project_activity")) {
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
