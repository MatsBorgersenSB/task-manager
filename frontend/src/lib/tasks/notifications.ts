import { createClient } from "@/lib/supabase/client";
import { isMissingTableError } from "@/lib/supabase/schemaFallback";
import { supabaseErrorMessage } from "@/lib/tasks/db-mapper";
import { NOTIFICATION_TITLES } from "@/lib/tasks/notificationTypes";
import { parseSbOwners } from "@/lib/tasks/sbOwners";
import type { AppUser, Task } from "@/lib/tasks/types";
import {
  getTaskDueStatus,
  isDueWithinNextDays,
  isTaskComplete,
} from "@/lib/tasks/taskDates";

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

export type EnrichedUserNotification = UserNotification & {
  project_name: string | null;
  task_number: number | null;
  task_title: string | null;
};

export type NotificationFetchResult = {
  notifications: EnrichedUserNotification[];
  tableMissing: boolean;
  error: string | null;
};

function isNotificationsMissingError(error: { message: string; code?: string }): boolean {
  return isMissingTableError(error, "user_notifications");
}

function taskLabel(task: Pick<Task, "id" | "Issue">): string {
  const title = (task.Issue ?? "").trim();
  return title || `Task #${task.id}`;
}

async function enrichNotifications(
  notifications: UserNotification[]
): Promise<EnrichedUserNotification[]> {
  if (notifications.length === 0) return [];

  const supabase = createClient();
  const projectIds = [
    ...new Set(
      notifications.map((n) => n.project_id).filter((id): id is string => Boolean(id))
    ),
  ];
  const taskIds = [
    ...new Set(
      notifications.map((n) => n.task_id).filter((id): id is string => Boolean(id))
    ),
  ];

  const projectNameById = new Map<string, string>();
  const taskMetaById = new Map<string, { task_number: number; title: string | null }>();

  if (projectIds.length > 0) {
    const { data: projects } = await supabase
      .from("projects")
      .select("id, name")
      .in("id", projectIds);
    for (const project of projects ?? []) {
      if (project.id && project.name) {
        projectNameById.set(project.id, project.name);
      }
    }
  }

  if (taskIds.length > 0) {
    const { data: tasks } = await supabase
      .from("tasks")
      .select("id, task_number, title")
      .in("id", taskIds);
    for (const task of tasks ?? []) {
      if (task.id) {
        taskMetaById.set(task.id, {
          task_number: task.task_number,
          title: task.title ?? null,
        });
      }
    }
  }

  return notifications.map((notification) => {
    const taskMeta = notification.task_id
      ? taskMetaById.get(notification.task_id)
      : undefined;
    return {
      ...notification,
      project_name: notification.project_id
        ? projectNameById.get(notification.project_id) ?? null
        : null,
      task_number: taskMeta?.task_number ?? null,
      task_title: taskMeta?.title ?? null,
    };
  });
}

export async function fetchUserNotifications(
  limit = 40
): Promise<NotificationFetchResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { notifications: [], tableMissing: false, error: null };
  }

  const { data, error } = await supabase
    .from("user_notifications")
    .select("id, user_id, project_id, task_id, title, body, read_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (isNotificationsMissingError(error)) {
      return { notifications: [], tableMissing: true, error: null };
    }
    return {
      notifications: [],
      tableMissing: false,
      error: supabaseErrorMessage(error),
    };
  }

  const notifications = await enrichNotifications((data ?? []) as UserNotification[]);
  return { notifications, tableMissing: false, error: null };
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

export function unreadNotificationCount(notifications: UserNotification[]): number {
  return notifications.filter((n) => !n.read_at).length;
}

async function hasRecentNotification(input: {
  userId: string;
  title: string;
  taskId?: string | null;
  withinHours?: number;
}): Promise<boolean> {
  const supabase = createClient();
  const hours = input.withinHours ?? 24;
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  let query = supabase
    .from("user_notifications")
    .select("id")
    .eq("user_id", input.userId)
    .eq("title", input.title)
    .gte("created_at", cutoff)
    .limit(1);

  if (input.taskId) {
    query = query.eq("task_id", input.taskId);
  }

  const { data, error } = await query;
  if (error && isNotificationsMissingError(error)) {
    return true;
  }
  return (data?.length ?? 0) > 0;
}

export async function createNotification(input: {
  userId: string;
  projectId?: string | null;
  taskId?: string | null;
  title: string;
  body?: string | null;
  dedupeHours?: number;
}): Promise<void> {
  if (input.dedupeHours !== undefined) {
    const duplicate = await hasRecentNotification({
      userId: input.userId,
      title: input.title,
      taskId: input.taskId,
      withinHours: input.dedupeHours,
    });
    if (duplicate) return;
  }

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

export async function notifyUsers(input: {
  userIds: string[];
  projectId?: string | null;
  taskId?: string | null;
  title: string;
  body?: string | null;
  dedupeHours?: number;
}): Promise<void> {
  const uniqueIds = [...new Set(input.userIds.filter(Boolean))];
  await Promise.all(
    uniqueIds.map((userId) =>
      createNotification({
        userId,
        projectId: input.projectId,
        taskId: input.taskId,
        title: input.title,
        body: input.body,
        dedupeHours: input.dedupeHours,
      })
    )
  );
}

/** Notify all internal team members (in-app only). */
export async function notifyInternalTeam(input: {
  projectId: string;
  taskId?: string | null;
  title: string;
  body?: string | null;
  dedupeHours?: number;
}): Promise<void> {
  const supabase = createClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id")
    .in("role", ["admin", "internal"]);

  if (!profiles?.length) return;

  await notifyUsers({
    userIds: profiles.map((profile) => profile.id),
    projectId: input.projectId,
    taskId: input.taskId,
    title: input.title,
    body: input.body,
    dedupeHours: input.dedupeHours,
  });
}

function userIdsForSbOwners(
  owners: string[],
  users: AppUser[]
): string[] {
  const targets = new Set(owners.map((owner) => owner.toLowerCase()));
  return users
    .filter((user) => targets.has(user.name.toLowerCase()))
    .map((user) => user.id);
}

export async function notifySbOwners(input: {
  task: Task;
  projectId: string;
  users: AppUser[];
  title: string;
  body?: string | null;
  dedupeHours?: number;
}): Promise<void> {
  const owners = parseSbOwners(input.task["SB Owner"]);
  const userIds = userIdsForSbOwners(owners, input.users);
  if (userIds.length === 0) {
    await notifyInternalTeam({
      projectId: input.projectId,
      taskId: input.task._uuid,
      title: input.title,
      body: input.body,
      dedupeHours: input.dedupeHours,
    });
    return;
  }

  await notifyUsers({
    userIds,
    projectId: input.projectId,
    taskId: input.task._uuid,
    title: input.title,
    body: input.body,
    dedupeHours: input.dedupeHours,
  });
}

export async function notifyClientComment(input: {
  projectId: string;
  taskId: string;
  taskLabel: string;
  message: string;
}): Promise<void> {
  const body =
    input.message.length > 120
      ? `${input.message.slice(0, 117)}…`
      : input.message;

  await notifyInternalTeam({
    projectId: input.projectId,
    taskId: input.taskId,
    title: NOTIFICATION_TITLES.clientComment,
    body: `${input.taskLabel} — ${body}`,
    dedupeHours: 1,
  });
}

export async function notifyTaskAssigned(input: {
  projectId: string;
  task: Task;
  users: AppUser[];
  newOwners: string[];
}): Promise<void> {
  const userIds = userIdsForSbOwners(input.newOwners, input.users);
  if (userIds.length === 0) return;

  await notifyUsers({
    userIds,
    projectId: input.projectId,
    taskId: input.task._uuid,
    title: NOTIFICATION_TITLES.taskAssigned,
    body: taskLabel(input.task),
    dedupeHours: 12,
  });
}

export async function notifyTaskCompleted(input: {
  projectId: string;
  task: Task;
  users: AppUser[];
}): Promise<void> {
  await notifySbOwners({
    task: input.task,
    projectId: input.projectId,
    users: input.users,
    title: NOTIFICATION_TITLES.taskCompleted,
    body: taskLabel(input.task),
    dedupeHours: 24,
  });
}

export async function notifyDueDateChanged(input: {
  projectId: string;
  task: Task;
  users: AppUser[];
  newDueDate: string | null;
}): Promise<void> {
  await notifySbOwners({
    task: input.task,
    projectId: input.projectId,
    users: input.users,
    title: NOTIFICATION_TITLES.dueDateChanged,
    body: `${taskLabel(input.task)} — ${input.newDueDate ?? "No due date"}`,
    dedupeHours: 12,
  });
}

export async function notifyProjectAcknowledged(input: {
  projectId: string;
  task: Task;
}): Promise<void> {
  await notifyInternalTeam({
    projectId: input.projectId,
    taskId: input.task._uuid,
    title: NOTIFICATION_TITLES.projectAcknowledged,
    body: taskLabel(input.task),
    dedupeHours: 24,
  });
}

export async function notifyFeedEntry(input: {
  projectId: string;
  taskId?: string | null;
  summary: string;
  detail?: string | null;
  users: AppUser[];
  task?: Task | null;
}): Promise<void> {
  const body = input.detail ?? input.summary;
  if (input.task) {
    await notifySbOwners({
      task: input.task,
      projectId: input.projectId,
      users: input.users,
      title: NOTIFICATION_TITLES.feedEntry,
      body,
      dedupeHours: 6,
    });
    return;
  }

  await notifyInternalTeam({
    projectId: input.projectId,
    taskId: input.taskId ?? null,
    title: NOTIFICATION_TITLES.feedEntry,
    body,
    dedupeHours: 6,
  });
}

export async function scanDueDateNotifications(input: {
  projectId: string;
  tasks: Task[];
  users: AppUser[];
}): Promise<void> {
  for (const task of input.tasks) {
    if (task.parent_task_id || isTaskComplete(task)) continue;

    const status = getTaskDueStatus(task);
    const label = taskLabel(task);

    if (status === "overdue") {
      await notifySbOwners({
        task,
        projectId: input.projectId,
        users: input.users,
        title: NOTIFICATION_TITLES.taskOverdue,
        body: label,
        dedupeHours: 24,
      });
      continue;
    }

    if (isDueWithinNextDays(task["Date Due"], 1)) {
      await notifySbOwners({
        task,
        projectId: input.projectId,
        users: input.users,
        title: NOTIFICATION_TITLES.dueTomorrow,
        body: label,
        dedupeHours: 20,
      });
    }
  }
}

export async function notifyUnansweredClientComment(input: {
  projectId: string;
  task: Task;
  users: AppUser[];
}): Promise<void> {
  await notifySbOwners({
    task: input.task,
    projectId: input.projectId,
    users: input.users,
    title: NOTIFICATION_TITLES.clientComment,
    body: `${taskLabel(input.task)} — waiting for response`,
    dedupeHours: 12,
  });
}
