import { createClient } from "@/lib/supabase/client";
import { supabaseErrorMessage } from "@/lib/tasks/db-mapper";

export type UserNotification = {
  id: string;
  user_id: string;
  project_id: string | null;
  task_id: string | null;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
};

function isNotificationsMissingError(error: { message: string; code?: string }): boolean {
  const message = error.message.toLowerCase();
  return (
    error.code === "PGRST205" ||
    (message.includes("user_notifications") &&
      (message.includes("schema cache") ||
        message.includes("does not exist") ||
        message.includes("could not find the table")))
  );
}

export async function fetchUserNotifications(
  limit = 30
): Promise<{ notifications: UserNotification[]; tableMissing: boolean }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { notifications: [], tableMissing: false };
  }

  const { data, error } = await supabase
    .from("user_notifications")
    .select("id, user_id, project_id, task_id, title, body, read_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (isNotificationsMissingError(error)) {
      return { notifications: [], tableMissing: true };
    }
    throw new Error(supabaseErrorMessage(error));
  }

  return { notifications: (data ?? []) as UserNotification[], tableMissing: false };
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("user_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId);

  if (error && !isNotificationsMissingError(error)) {
    throw new Error(supabaseErrorMessage(error));
  }
}

export async function markAllNotificationsRead(): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const { error } = await supabase
    .from("user_notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null)
    .eq("user_id", user.id);

  if (error && !isNotificationsMissingError(error)) {
    throw new Error(supabaseErrorMessage(error));
  }
}

export async function createNotification(input: {
  userId: string;
  projectId?: string | null;
  taskId?: string | null;
  title: string;
  body?: string | null;
}): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("user_notifications").insert({
    user_id: input.userId,
    project_id: input.projectId ?? null,
    task_id: input.taskId ?? null,
    title: input.title,
    body: input.body ?? null,
  });

  if (error && !isNotificationsMissingError(error)) {
    throw new Error(supabaseErrorMessage(error));
  }
}

export function unreadNotificationCount(notifications: UserNotification[]): number {
  return notifications.filter((n) => !n.read_at).length;
}

/** Notify all internal team members (in-app only). */
export async function notifyInternalTeam(input: {
  projectId: string;
  taskId?: string | null;
  title: string;
  body?: string | null;
}): Promise<void> {
  const supabase = createClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id")
    .in("role", ["admin", "internal"]);

  if (!profiles?.length) return;

  const rows = profiles.map((profile) => ({
    user_id: profile.id,
    project_id: input.projectId,
    task_id: input.taskId ?? null,
    title: input.title,
    body: input.body ?? null,
  }));

  const { error } = await supabase.from("user_notifications").insert(rows);
  if (error && !isNotificationsMissingError(error)) {
    throw new Error(supabaseErrorMessage(error));
  }
}
