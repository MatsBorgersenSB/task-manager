import { createClient } from "@/lib/supabase/client";
import { fieldLabel } from "@/lib/tasks/labels";
import {
  isMissingInterventionColumnError,
  payloadToRow,
  rowToTask,
  stripInterventionFieldsFromRow,
  supabaseErrorMessage,
  type TaskRow,
} from "@/lib/tasks/db-mapper";
import { isClientVisibleTask } from "@/lib/tasks/visibility";
import { sanitizeTaskForExternal } from "@/lib/tasks/taskLinks";
import type { AppUser, Task, TaskPayload, TaskViewMode } from "@/lib/tasks/types";

async function auditFields(
  supabase: ReturnType<typeof createClient>
): Promise<{ updated_by: string; updated_at: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email;
  if (!email) {
    throw new Error("You must be signed in to save tasks.");
  }
  return {
    updated_by: email,
    updated_at: new Date().toISOString(),
  };
}

export async function fetchTasks(mode: TaskViewMode): Promise<Task[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .order("task_number", { ascending: true });

  if (error) {
    throw new Error(supabaseErrorMessage(error));
  }

  let rows = (data ?? []) as TaskRow[];

  if (mode === "client") {
    rows = rows.filter((row) => isClientVisibleTask(row.visibility_scope));
  }

  return rows.map((row) => {
    const task = rowToTask(row, mode);
    return mode === "internal" ? task : sanitizeTaskForExternal(task);
  });
}

type TaskWriteRow = Partial<TaskRow> & {
  updated_by?: string;
  updated_at?: string;
  title?: string;
};

async function insertTaskRow(
  supabase: ReturnType<typeof createClient>,
  row: TaskWriteRow
) {
  return supabase.from("tasks").insert(row).select("*").single();
}

async function updateTaskRow(
  supabase: ReturnType<typeof createClient>,
  taskUuid: string,
  row: TaskWriteRow
) {
  return supabase.from("tasks").update(row).eq("id", taskUuid).select("*").single();
}

async function updateTaskRowsBulk(
  supabase: ReturnType<typeof createClient>,
  taskIds: string[],
  row: TaskWriteRow
) {
  return supabase.from("tasks").update(row).in("id", taskIds).select("*");
}

/** Retry without intervention columns when the DB schema is not migrated yet. */
async function writeTaskRowWithInterventionFallback<T>(
  write: (row: TaskWriteRow) => PromiseLike<{
    data: T | null;
    error: { message?: string; code?: string } | null;
  }>,
  row: TaskWriteRow
): Promise<{ data: T; strippedIntervention: boolean }> {
  const first = await write(row);
  if (!first.error && first.data) {
    return { data: first.data, strippedIntervention: false };
  }

  if (!isMissingInterventionColumnError(first.error)) {
    throw new Error(supabaseErrorMessage(first.error));
  }

  console.warn(
    "Intervention columns missing in tasks table; saving without intervention_date/intervention_hours. Run migrations 031–032 in Supabase."
  );

  const fallback = await write(stripInterventionFieldsFromRow(row));
  if (fallback.error || !fallback.data) {
    throw new Error(supabaseErrorMessage(fallback.error));
  }

  return { data: fallback.data, strippedIntervention: true };
}

export async function createTask(
  mode: TaskViewMode,
  payload: TaskPayload
): Promise<Task> {
  const issue = (payload.Issue ?? "").trim();
  if (!issue) {
    throw new Error(`${fieldLabel("Issue")} is required.`);
  }

  const supabase = createClient();
  const row: TaskWriteRow = {
    ...payloadToRow(payload, mode),
    title: issue,
    ...(await auditFields(supabase)),
  };

  const { data } = await writeTaskRowWithInterventionFallback(
    (nextRow) => insertTaskRow(supabase, nextRow),
    row
  );

  return rowToTask(data as TaskRow, mode);
}

export async function updateTask(
  mode: TaskViewMode,
  taskUuid: string,
  payload: TaskPayload
): Promise<Task> {
  const supabase = createClient();
  const row: TaskWriteRow = {
    ...payloadToRow(payload, mode),
    ...(await auditFields(supabase)),
  };

  const { data } = await writeTaskRowWithInterventionFallback(
    (nextRow) => updateTaskRow(supabase, taskUuid, nextRow),
    row
  );

  return rowToTask(data as TaskRow, mode);
}

export const BULK_UPDATE_CHUNK_SIZE = 100;

/** Apply the same field updates to a batch of tasks (single request). */
export async function updateTasksBulk(
  mode: TaskViewMode,
  taskIds: string[],
  updates: TaskPayload
): Promise<Task[]> {
  if (taskIds.length === 0) return [];

  const supabase = createClient();
  const row: TaskWriteRow = {
    ...payloadToRow(updates, mode),
    ...(await auditFields(supabase)),
  };

  const issue = (updates.Issue ?? "").trim();
  if (issue) {
    row.title = issue;
  }

  const { data } = await writeTaskRowWithInterventionFallback(
    (nextRow) => updateTaskRowsBulk(supabase, taskIds, nextRow),
    row
  );

  return (data as TaskRow[]).map((rowData) => rowToTask(rowData, mode));
}

export async function deleteTaskApi(
  _mode: TaskViewMode,
  taskUuid: string
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("tasks").delete().eq("id", taskUuid);

  if (error) {
    throw new Error(supabaseErrorMessage(error));
  }
}

/** Profiles for internal SB Owner pickers. Returns [] if unavailable. */
export async function fetchAppUsers(): Promise<AppUser[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email")
    .in("role", ["admin", "internal"])
    .order("email");

  if (error) {
    return [];
  }

  return (data ?? []).map((profile) => {
    const email = profile.email ?? "";
    const localPart = email.split("@")[0] ?? email;
    return {
      id: profile.id,
      name: localPart || email,
      email,
    };
  });
}
