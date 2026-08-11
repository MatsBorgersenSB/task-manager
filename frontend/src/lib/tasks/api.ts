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
  isMissingColumnError,
  selectWithColumnFallback,
  SupabaseWriteError,
  writeWithOptionalColumnFallback,
} from "@/lib/supabase/schemaFallback";
import { isClientVisibleTask } from "@/lib/tasks/visibility";
import { logTaskEvent } from "@/lib/tasks/activityLogging";
import { sanitizeTaskForExternal } from "@/lib/tasks/taskLinks";
import type { AppUser, Task, TaskPayload, TaskViewMode } from "@/lib/tasks/types";

/** Normalize any thrown write error into a loggable object with PG fields. */
function describeWriteError(err: unknown): Record<string, unknown> {
  if (err instanceof SupabaseWriteError) {
    return {
      name: err.name,
      message: err.message,
      code: err.code ?? null,
      details: err.details ?? null,
      hint: err.hint ?? null,
    };
  }
  if (err instanceof Error) {
    return { name: err.name, message: err.message };
  }
  return { value: String(err) };
}

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
): Promise<{ data: T; strippedKeys: string[] }> {
  const { data, strippedKeys } = await writeWithOptionalColumnFallback(
    write,
    row,
    OPTIONAL_TASK_WRITE_COLUMNS
  );

  return { data, strippedKeys };
}

/**
 * Guard against silent hierarchy-save failures. When a caller asks to change
 * `parent_task_id`, the optional-column fallback may strip it (schema not
 * migrated) or a trigger/RLS policy may reject the change while still returning
 * a row. In both cases the write looks successful but the parent never persists,
 * so we detect the mismatch and surface an actionable error instead.
 */
function assertParentTaskPersisted(input: {
  requestedParentId: string | null;
  returnedParentId: string | null;
  strippedKeys: string[];
  context: Record<string, unknown>;
}): void {
  if (input.strippedKeys.includes("parent_task_id")) {
    console.error("[move-under-task] parent_task_id column missing", input.context);
    throw new Error(
      "Task hierarchy could not be saved: the database is missing the parent_task_id column. Apply migrations 036_parent_task_id.sql and 046_task_hierarchy_protection.sql in Supabase."
    );
  }

  if (input.returnedParentId !== input.requestedParentId) {
    console.error("[move-under-task] parent_task_id did not persist", input.context);
    throw new Error(
      "Task hierarchy update did not persist — the parent change was rejected by the database. Please refresh and try again."
    );
  }
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

  let data: TaskRow;
  try {
    ({ data } = await writeTaskRowWithSchemaFallback(
      (nextRow) => insertTaskRow(supabase, nextRow),
      row
    ));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/tasks_task_number|duplicate key|unique constraint/i.test(message)) {
      throw new Error(
        "Could not assign a task number. Run migration 055_renumber_project_tasks.sql in Supabase, then try again."
      );
    }
    throw err;
  }

  const task = rowToTask(data, mode);
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

  const requestedParentChange = "parent_task_id" in payload;
  const requestedParentId = requestedParentChange
    ? payload.parent_task_id ?? null
    : null;

  if (requestedParentChange) {
    console.info("[move-under-task] updateTask →", {
      childTaskUuid: taskUuid,
      parentTaskUuid: requestedParentId,
      row,
    });
  }

  let data: TaskRow;
  let strippedKeys: string[];
  try {
    ({ data, strippedKeys } = await writeTaskRowWithSchemaFallback(
      (nextRow) => updateTaskRow(supabase, taskUuid, nextRow),
      row
    ));
  } catch (err) {
    if (requestedParentChange) {
      console.error("[move-under-task] updateTask FAILED", {
        childTaskUuid: taskUuid,
        parentTaskUuid: requestedParentId,
        error: describeWriteError(err),
      });
    }
    throw err;
  }

  const task = rowToTask(data as TaskRow, mode);

  if (requestedParentChange) {
    console.info("[move-under-task] updateTask ←", {
      taskUuid,
      requestedParentId,
      returnedParentId: task.parent_task_id ?? null,
      strippedKeys,
    });
    assertParentTaskPersisted({
      requestedParentId,
      returnedParentId: task.parent_task_id ?? null,
      strippedKeys,
      context: { taskUuid, requestedParentId },
    });
  }

  return task;
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

  const requestedParentChange = "parent_task_id" in updates;
  const requestedParentId = requestedParentChange
    ? updates.parent_task_id ?? null
    : null;

  if (requestedParentChange) {
    console.info("[move-under-task] updateTasksBulk →", {
      childTaskUuids: taskIds,
      parentTaskUuid: requestedParentId,
      row,
    });
  }

  let data: TaskRow[];
  let strippedKeys: string[];
  try {
    ({ data, strippedKeys } = await writeTaskRowWithSchemaFallback(
      (nextRow) => updateTaskRowsBulk(supabase, taskIds, nextRow),
      row
    ));
  } catch (err) {
    if (requestedParentChange) {
      console.error("[move-under-task] updateTasksBulk FAILED", {
        childTaskUuids: taskIds,
        parentTaskUuid: requestedParentId,
        error: describeWriteError(err),
      });
    }
    throw err;
  }

  const rows = (data as TaskRow[]).map((rowData) => rowToTask(rowData, mode));

  if (requestedParentChange) {
    console.info("[move-under-task] updateTasksBulk ←", {
      requestedParentId,
      returnedRows: rows.map((t) => ({
        taskUuid: t._uuid,
        parent_task_id: t.parent_task_id ?? null,
      })),
      strippedKeys,
      expected: taskIds.length,
      received: rows.length,
    });

    if (rows.length !== taskIds.length) {
      console.error("[move-under-task] bulk move affected fewer rows than requested", {
        expected: taskIds.length,
        received: rows.length,
      });
      throw new Error(
        "Task hierarchy update did not persist for all selected tasks — some rows were rejected by the database. Please refresh and try again."
      );
    }

    for (const updatedTask of rows) {
      assertParentTaskPersisted({
        requestedParentId,
        returnedParentId: updatedTask.parent_task_id ?? null,
        strippedKeys,
        context: { taskUuid: updatedTask._uuid, requestedParentId },
      });
    }
  }

  return rows;
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

/** Delete multiple tasks by UUID. */
export async function deleteTasksApi(
  _mode: TaskViewMode,
  taskUuids: string[]
): Promise<void> {
  if (taskUuids.length === 0) return;

  const supabase = createClient();
  const { error } = await supabase.from("tasks").delete().in("id", taskUuids);

  if (error) {
    throw new Error(supabaseErrorMessage(error));
  }
}

function isMissingRpcError(error: { message?: string; code?: string } | null): boolean {
  const message = (error?.message ?? "").toLowerCase();
  const code = error?.code ?? "";
  return (
    code === "PGRST202" ||
    code === "42883" ||
    message.includes("could not find the function") ||
    message.includes("function public.renumber_project_tasks") ||
    message.includes("function public.set_task_display_number") ||
    (message.includes("schema cache") && message.includes("function"))
  );
}

async function renumberProjectTasksClient(projectId: string): Promise<number> {
  const supabase = createClient();
  const { data: rows, error } = await supabase
    .from("tasks")
    .select("id, task_number, created_at")
    .eq("project_id", projectId)
    .order("task_number", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(supabaseErrorMessage(error));
  }

  const tasks = rows ?? [];
  if (tasks.length === 0) return 0;

  for (let index = 0; index < tasks.length; index += 1) {
    const { error: tempError } = await supabase
      .from("tasks")
      .update({ task_number: -(index + 1) })
      .eq("id", tasks[index].id);
    if (tempError) {
      throw new Error(supabaseErrorMessage(tempError));
    }
  }

  for (let index = 0; index < tasks.length; index += 1) {
    const { error: finalError } = await supabase
      .from("tasks")
      .update({ task_number: index + 1 })
      .eq("id", tasks[index].id);
    if (finalError) {
      throw new Error(
        `${supabaseErrorMessage(finalError)} Run migration 055_renumber_project_tasks.sql if task numbers are still global.`
      );
    }
  }

  return tasks.length;
}

/** Renumber all tasks in a project to 1..n (current order preserved). */
export async function renumberProjectTasksApi(projectId: string): Promise<number> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("renumber_project_tasks", {
    p_project_id: projectId,
  });

  if (!error) {
    return typeof data === "number" ? data : Number(data ?? 0);
  }

  if (isMissingRpcError(error)) {
    return renumberProjectTasksClient(projectId);
  }

  throw new Error(supabaseErrorMessage(error));
}

/** Change a task's display number within its project (swaps if taken). */
export async function setTaskNumberApi(
  mode: TaskViewMode,
  taskUuid: string,
  newNumber: number
): Promise<Task> {
  if (!Number.isInteger(newNumber) || newNumber < 1) {
    throw new Error("Task number must be a positive integer.");
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc("set_task_display_number", {
    p_task_id: taskUuid,
    p_new_number: newNumber,
  });

  if (!error && data) {
    return rowToTask(data as TaskRow, mode);
  }

  if (error && !isMissingRpcError(error)) {
    throw new Error(supabaseErrorMessage(error));
  }

  // Fallback: swap or assign when RPC is not deployed yet.
  const { data: current, error: currentError } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", taskUuid)
    .single();

  if (currentError || !current) {
    throw new Error(
      currentError ? supabaseErrorMessage(currentError) : "Task not found."
    );
  }

  const currentRow = current as TaskRow;
  if (currentRow.task_number === newNumber) {
    return rowToTask(currentRow, mode);
  }

  let occupantQuery = supabase
    .from("tasks")
    .select("id, task_number")
    .eq("task_number", newNumber)
    .neq("id", taskUuid)
    .limit(1);

  occupantQuery =
    currentRow.project_id == null
      ? occupantQuery.is("project_id", null)
      : occupantQuery.eq("project_id", currentRow.project_id);

  const { data: occupants, error: occupantError } = await occupantQuery;
  if (occupantError) {
    throw new Error(supabaseErrorMessage(occupantError));
  }

  const occupant = occupants?.[0];
  if (occupant) {
    const tempNumber = -Math.abs(currentRow.task_number) - 1_000_000;
    const { error: tempError } = await supabase
      .from("tasks")
      .update({ task_number: tempNumber })
      .eq("id", taskUuid);
    if (tempError) throw new Error(supabaseErrorMessage(tempError));

    const { error: swapError } = await supabase
      .from("tasks")
      .update({ task_number: currentRow.task_number })
      .eq("id", occupant.id);
    if (swapError) throw new Error(supabaseErrorMessage(swapError));
  }

  const { data: updated, error: updateError } = await supabase
    .from("tasks")
    .update({ task_number: newNumber })
    .eq("id", taskUuid)
    .select("*")
    .single();

  if (updateError || !updated) {
    throw new Error(
      updateError
        ? `${supabaseErrorMessage(updateError)} Run migration 055_renumber_project_tasks.sql if task numbers are still global.`
        : "Failed to update task number."
    );
  }

  return rowToTask(updated as TaskRow, mode);
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

type ProfileRow = {
  id: string;
  email: string | null;
  display_name?: string | null;
};

function mapProfilesToAppUsers(rows: ProfileRow[]): AppUser[] {
  return rows.map((profile) => {
    const email = profile.email ?? "";
    const localPart = email.split("@")[0] ?? email;
    const displayName = profile.display_name?.trim();
    return {
      id: profile.id,
      name: displayName || localPart || email,
      email,
    };
  });
}

/** Profiles for internal SB Owner pickers (admin + internal). Returns [] if unavailable. */
export async function fetchAppUsers(): Promise<AppUser[]> {
  const supabase = createClient();

  const withDisplayName = await supabase
    .from("profiles")
    .select("id, email, display_name")
    .in("role", ["admin", "internal"])
    .order("email");

  if (!withDisplayName.error) {
    return mapProfilesToAppUsers((withDisplayName.data ?? []) as ProfileRow[]);
  }

  // Older DBs may not have display_name yet — fall back without it.
  if (isMissingColumnError(withDisplayName.error, "display_name")) {
    const fallback = await supabase
      .from("profiles")
      .select("id, email")
      .in("role", ["admin", "internal"])
      .order("email");

    if (fallback.error) {
      console.error("fetchAppUsers failed:", fallback.error.message);
      return [];
    }

    return mapProfilesToAppUsers((fallback.data ?? []) as ProfileRow[]);
  }

  console.error("fetchAppUsers failed:", withDisplayName.error.message);
  return [];
}
