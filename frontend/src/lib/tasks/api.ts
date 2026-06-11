import { createClient } from "@/lib/supabase/client";
import { fieldLabel } from "@/lib/tasks/labels";
import {
  payloadToRow,
  rowToTask,
  supabaseErrorMessage,
  type TaskRow,
} from "@/lib/tasks/db-mapper";
import type { AppUser, Task, TaskPayload, TaskViewMode } from "@/lib/tasks/types";

export async function fetchTasks(mode: TaskViewMode): Promise<Task[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .order("task_number", { ascending: true });

  if (error) {
    throw new Error(supabaseErrorMessage(error));
  }

  return ((data ?? []) as TaskRow[]).map((row) => rowToTask(row, mode));
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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const row: Record<string, unknown> = {
    ...payloadToRow(payload, mode),
    title: issue,
  };

  if (user?.id) {
    row.created_by = user.id;
  }

  const insert = await supabase.from("tasks").insert(row).select("*").single();

  let data = insert.data;
  let error = insert.error;

  if (error?.message.includes("created_by")) {
    const { created_by: _removed, ...withoutCreator } = row;
    const fallback = await supabase
      .from("tasks")
      .insert(withoutCreator)
      .select("*")
      .single();
    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    throw new Error(supabaseErrorMessage(error));
  }

  return rowToTask(data as TaskRow, mode);
}

export async function updateTask(
  mode: TaskViewMode,
  taskUuid: string,
  payload: TaskPayload
): Promise<Task> {
  const supabase = createClient();
  const row = payloadToRow(payload, mode);

  const { data, error } = await supabase
    .from("tasks")
    .update(row)
    .eq("id", taskUuid)
    .select("*")
    .single();

  if (error) {
    throw new Error(supabaseErrorMessage(error));
  }

  return rowToTask(data as TaskRow, mode);
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

/** Profiles for internal SB Owner pickers. */
export async function fetchAppUsers(): Promise<AppUser[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email")
    .in("role", ["admin", "internal"])
    .order("email");

  if (error) {
    throw new Error(supabaseErrorMessage(error));
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
