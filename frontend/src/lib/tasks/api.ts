import { createClient } from "@/lib/supabase/client";
import { fieldLabel } from "@/lib/tasks/labels";
import {
  OPTIONAL_TASK_WRITE_COLUMNS,
  payloadToRow,
  rowToTask,
  supabaseErrorMessage,
  TASK_SELECT_COLUMN_SETS,
  type TaskRow,
} from "@/lib/tasks/db-mapper";
import {
  selectWithColumnFallback,
  writeWithOptionalColumnFallback,
} from "@/lib/supabase/schemaFallback";
import { isClientVisibleTask } from "@/lib/tasks/visibility";
import { logTaskEvent } from "@/lib/tasks/activityLogging";
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
  const { data } = await selectWithColumnFallback(TASK_SELECT_COLUMN_SETS, (columns) =>
    supabase.from("tasks").select(columns).order("task_number", { ascending: true })
  );

  let rows = (data ?? []) as TaskRow[];

  if (mode === "client") {
    rows = rows.filter((row) => isClientVisibleTask(row.visibility_scope));
  }

  return rows.map((row) => {
    const task = rowToTask(row, mode);
    return mode === "internal" ? task : sanitizeTaskForExternal(task);
  });
}

/** Assign tasks missing project_id to the default project (internal maintenance). */
export async function repairOrphanTasks(defaultProjectId: string): Promise<number> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("id")
    .is("project_id", null);

  if (error) {
    throw new Error(supabaseErrorMessage(error));
  }

  const orphanIds = ((data ?? []) as { id: string }[]).map((row) => row.id);
  if (orphanIds.length === 0) {
    return 0;
  }

  const { error: updateError } = await supabase
    .from("tasks")
    .update({
      project_id: defaultProjectId,
      ...(await auditFields(supabase)),
    })
    .in("id", orphanIds);

  if (updateError) {
    throw new Error(supabaseErrorMessage(updateError));
  }

  return orphanIds.length;
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

/** Retry without optional columns when the DB schema is not fully migrated yet. */
async function writeTaskRowWithSchemaFallback<T>(
  write: (row: TaskWriteRow) => PromiseLike<{
    data: T | null;
    error: { message?: string; code?: string } | null;
  }>,
  row: TaskWriteRow
): Promise<{ data: T; strippedIntervention: boolean }> {
  const { data, strippedKeys } = await writeWithOptionalColumnFallback(
    write,
    row,
    OPTIONAL_TASK_WRITE_COLUMNS
  );

  return {
    data,
    strippedIntervention: strippedKeys.some((key) =>
      key.startsWith("intervention_")
    ),
  };
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
  if (!payload.project_id) {
    throw new Error("Every task must belong to a project.");
  }

  const row: TaskWriteRow = {
    ...payloadToRow(payload, mode),
    title: issue,
    project_id: payload.project_id,
    ...(await auditFields(supabase)),
  };

  if (payload.parent_task_id) {
    row.parent_task_id = payload.parent_task_id;
  }

  const { data } = await writeTaskRowWithSchemaFallback(
    (nextRow) => insertTaskRow(supabase, nextRow),
    row
  );

  const task = rowToTask(data as TaskRow, mode);
  try {
    await logTaskEvent(
      task._uuid,
      "task_created",
      "Task Created",
      null,
      issue
    );
  } catch {
    /* history is best-effort */
  }
  return task;
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

  const { data } = await writeTaskRowWithSchemaFallback(
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

  const { data } = await writeTaskRowWithSchemaFallback(
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

/** Client acknowledgement of a task or project update. */
export async function acknowledgeTask(
  mode: TaskViewMode,
  taskUuid: string,
  projectId: string | null | undefined
): Promise<Task> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be signed in to acknowledge.");
  }

  const now = new Date().toISOString();
  const { data } = await writeTaskRowWithSchemaFallback<TaskRow>(
    (nextRow) =>
      supabase
        .from("tasks")
        .update(nextRow)
        .eq("id", taskUuid)
        .select("*")
        .single(),
    {
      acknowledged_by: user.id,
      acknowledged_at: now,
      ...(await auditFields(supabase)),
    }
  );

  const task = rowToTask(data, mode);

  try {
    await logTaskEvent(taskUuid, "field_change", "Acknowledged", null, now);
    if (projectId) {
      const { logProjectActivity } = await import("@/lib/tasks/projectActivity");
      await logProjectActivity({
        projectId,
        taskId: taskUuid,
        eventType: "client_acknowledged",
        summary: `Client acknowledged task #${task.id}`,
        detail: task.Issue ?? undefined,
        clientVisible: true,
      });
      const { notifyProjectAcknowledged } = await import("@/lib/tasks/notifications");
      void notifyProjectAcknowledged({ projectId, task });
    }
  } catch {
    /* best-effort */
  }

  return task;
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
