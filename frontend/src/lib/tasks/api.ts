import { createClient } from "@/lib/supabase/client";
import { fieldLabel } from "@/lib/tasks/labels";
import {
  payloadToRow,
  rowToTask,
  supabaseErrorMessage,
  type TaskRow,
} from "@/lib/tasks/db-mapper";
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
  const row = {
    ...payloadToRow(payload, mode),
    title: issue,
    ...(await auditFields(supabase)),
  };

  const { data, error } = await supabase
    .from("tasks")
    .insert(row)
    .select("*")
    .single();

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
  const row = {
    ...payloadToRow(payload, mode),
    ...(await auditFields(supabase)),
  };

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
