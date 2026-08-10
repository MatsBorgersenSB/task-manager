import { createClient } from "@/lib/supabase/client";
import {
  extractMissingColumnName,
  isMissingColumnError,
  isMissingTableError,
} from "@/lib/supabase/schemaFallback";
import { supabaseErrorMessage } from "@/lib/tasks/db-mapper";
import {
  buildNotificationBody,
  buildNotificationTitle,
} from "@/lib/tasks/notificationFormatting";
import {
  NOTIFICATION_EVENT_TYPES,
  type NotificationEventType,
} from "@/lib/tasks/notificationTypes";
import { parseSbOwners } from "@/lib/tasks/sbOwners";
import type { AppUser, Task } from "@/lib/tasks/types";
import {
  getCurrentActorProfile,
  loadUserProfiles,
  profileDisplayName,
  type UserProfileRef,
} from "@/lib/tasks/userAttribution";
import {
  getTaskDueStatus,
  isDueWithinNextDays,
  isTaskComplete,
  taskDateValue,
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
  actor_user_id: string | null;
  event_type: string | null;
};

export type EnrichedUserNotification = UserNotification & {
  project_name: string | null;
  task_number: number | null;
  task_title: string | null;
  actor_name: string | null;
  actor_email: string | null;
};

export type NotificationFetchResult = {
  notifications: EnrichedUserNotification[];
  tableMissing: boolean;
  error: string | null;
};

function isNotificationsMissingError(error: { message: string; code?: string }): boolean {
  return isMissingTableError(error, "user_notifications");
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
  const actorIds = [
    ...new Set(
      notifications
        .map((n) => n.actor_user_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const projectNameById = new Map<string, string>();
  const taskMetaById = new Map<string, { task_number: number; title: string | null }>();
  const actorsById = await loadUserProfiles(actorIds);

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
    const actorProfile = notification.actor_user_id
      ? actorsById.get(notification.actor_user_id)
      : undefined;
    return {
      ...notification,
      project_name: notification.project_id
        ? projectNameById.get(notification.project_id) ?? null
        : null,
      task_number: taskMeta?.task_number ?? null,
      task_title: taskMeta?.title ?? null,
      actor_name: actorProfile ? profileDisplayName(actorProfile) : null,
      actor_email: actorProfile?.email ?? null,
    };
  });
}

const NOTIFICATION_SELECT =
  "id, user_id, project_id, task_id, title, body, read_at, created_at, actor_user_id, event_type";

const NOTIFICATION_LEGACY_SELECT =
  "id, user_id, project_id, task_id, title, body, read_at, created_at";

async function fetchNotificationRows(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  limit: number
) {
  const full = await supabase
    .from("user_notifications")
    .select(NOTIFICATION_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!full.error) {
    return full;
  }

  // Missing actor_user_id / event_type (migration 052) or schema-cache lag → legacy columns.
  if (
    extractMissingColumnName(full.error) ||
    isMissingColumnError(full.error) ||
    (full.error.message ?? "").toLowerCase().includes("actor_user_id") ||
    (full.error.message ?? "").toLowerCase().includes("event_type")
  ) {
    return supabase
      .from("user_notifications")
      .select(NOTIFICATION_LEGACY_SELECT)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
  }

  // Last resort: any failure on the extended select — try legacy once.
  const legacy = await supabase
    .from("user_notifications")
    .select(NOTIFICATION_LEGACY_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return legacy.error ? full : legacy;
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

  const { data, error } = await fetchNotificationRows(supabase, user.id, limit);

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

  const notifications = await enrichNotifications(
    ((data ?? []) as unknown as UserNotification[]).map((row) => ({
      ...row,
      actor_user_id: row.actor_user_id ?? null,
      event_type: row.event_type ?? null,
    }))
  );
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
  eventType?: string | null;
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
    .gte("created_at", cutoff)
    .limit(1);

  if (input.eventType) {
    query = query.eq("event_type", input.eventType);
  } else {
    query = query.eq("title", input.title);
  }

  if (input.taskId) {
    query = query.eq("task_id", input.taskId);
  }

  const { data, error } = await query;
  if (error && isNotificationsMissingError(error)) {
    return true;
  }
  return (data?.length ?? 0) > 0;
}

type NotificationContext = {
  projectName?: string | null;
  taskNumber?: number | null;
  taskTitle?: string | null;
  detail?: string | null;
};

async function insertNotificationRow(input: {
  userId: string;
  projectId?: string | null;
  taskId?: string | null;
  title: string;
  body?: string | null;
  actorUserId?: string | null;
  eventType?: string | null;
}): Promise<void> {
  const supabase = createClient();
  const payload: Record<string, unknown> = {
    user_id: input.userId,
    project_id: input.projectId ?? null,
    task_id: input.taskId ?? null,
    title: input.title,
    body: input.body ?? null,
  };

  if (input.actorUserId) {
    payload.actor_user_id = input.actorUserId;
  }
  if (input.eventType) {
    payload.event_type = input.eventType;
  }

  let { error } = await supabase.from("user_notifications").insert(payload);

  if (error && extractMissingColumnName(error)) {
    delete payload.actor_user_id;
    delete payload.event_type;
    ({ error } = await supabase.from("user_notifications").insert(payload));
  }

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
  actorUserId?: string | null;
  eventType?: string | null;
  dedupeHours?: number;
}): Promise<void> {
  if (input.dedupeHours !== undefined) {
    const duplicate = await hasRecentNotification({
      userId: input.userId,
      title: input.title,
      eventType: input.eventType,
      taskId: input.taskId,
      withinHours: input.dedupeHours,
    });
    if (duplicate) return;
  }

  await insertNotificationRow(input);
}

async function notifyAttributed(input: {
  userIds: string[];
  projectId?: string | null;
  taskId?: string | null;
  eventType: NotificationEventType;
  actor?: UserProfileRef | null;
  context?: NotificationContext;
  dedupeHours?: number;
}): Promise<void> {
  const actor = input.actor ?? (await getCurrentActorProfile());
  const actorName = actor ? profileDisplayName(actor) : "Someone";
  const title = buildNotificationTitle(input.eventType, {
    actorName,
    projectName: input.context?.projectName,
    taskNumber: input.context?.taskNumber,
    taskTitle: input.context?.taskTitle,
    detail: input.context?.detail,
  });
  const body = buildNotificationBody(input.eventType, {
    actorName,
    projectName: input.context?.projectName,
    taskNumber: input.context?.taskNumber,
    taskTitle: input.context?.taskTitle,
    detail: input.context?.detail,
  });

  const uniqueIds = [...new Set(input.userIds.filter(Boolean))];
  await Promise.all(
    uniqueIds.map((userId) =>
      createNotification({
        userId,
        projectId: input.projectId,
        taskId: input.taskId,
        title,
        body,
        actorUserId: actor?.id ?? null,
        eventType: input.eventType,
        dedupeHours: input.dedupeHours,
      })
    )
  );
}

function taskNotificationContext(
  task: Pick<Task, "id" | "Issue">,
  projectName?: string | null,
  detail?: string | null
): NotificationContext {
  return {
    projectName,
    taskNumber: task.id,
    taskTitle: (task.Issue ?? "").trim() || null,
    detail,
  };
}

export async function notifyUsers(input: {
  userIds: string[];
  projectId?: string | null;
  taskId?: string | null;
  title: string;
  body?: string | null;
  actorUserId?: string | null;
  eventType?: string | null;
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
        actorUserId: input.actorUserId,
        eventType: input.eventType,
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
  actorUserId?: string | null;
  eventType?: string | null;
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
    actorUserId: input.actorUserId,
    eventType: input.eventType,
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
  eventType: NotificationEventType;
  context?: NotificationContext;
  dedupeHours?: number;
}): Promise<void> {
  const owners = parseSbOwners(input.task["SB Owner"]);
  const userIds = userIdsForSbOwners(owners, input.users);
  const context = input.context ?? taskNotificationContext(input.task);

  if (userIds.length === 0) {
    const supabase = createClient();
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id")
      .in("role", ["admin", "internal"]);

    if (!profiles?.length) return;

    await notifyAttributed({
      userIds: profiles.map((profile) => profile.id),
      projectId: input.projectId,
      taskId: input.task._uuid,
      eventType: input.eventType,
      context,
      dedupeHours: input.dedupeHours,
    });
    return;
  }

  await notifyAttributed({
    userIds,
    projectId: input.projectId,
    taskId: input.task._uuid,
    eventType: input.eventType,
    context,
    dedupeHours: input.dedupeHours,
  });
}

export async function notifyClientComment(input: {
  projectId: string;
  taskId: string;
  taskLabel: string;
  message: string;
  taskNumber?: number | null;
}): Promise<void> {
  const detail =
    input.message.length > 120
      ? `${input.message.slice(0, 117)}…`
      : input.message;

  const supabase = createClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id")
    .in("role", ["admin", "internal"]);

  if (!profiles?.length) return;

  await notifyAttributed({
    userIds: profiles.map((profile) => profile.id),
    projectId: input.projectId,
    taskId: input.taskId,
    eventType: NOTIFICATION_EVENT_TYPES.clientComment,
    context: {
      taskNumber: input.taskNumber ?? null,
      taskTitle: input.taskLabel,
      detail,
    },
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

  await notifyAttributed({
    userIds,
    projectId: input.projectId,
    taskId: input.task._uuid,
    eventType: NOTIFICATION_EVENT_TYPES.taskAssigned,
    context: taskNotificationContext(input.task),
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
    eventType: NOTIFICATION_EVENT_TYPES.taskCompleted,
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
    eventType: NOTIFICATION_EVENT_TYPES.dueDateChanged,
    context: taskNotificationContext(
      input.task,
      null,
      input.newDueDate ?? "No due date"
    ),
    dedupeHours: 12,
  });
}

export async function notifyProjectAcknowledged(input: {
  projectId: string;
  task: Task;
}): Promise<void> {
  const supabase = createClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id")
    .in("role", ["admin", "internal"]);

  if (!profiles?.length) return;

  await notifyAttributed({
    userIds: profiles.map((profile) => profile.id),
    projectId: input.projectId,
    taskId: input.task._uuid,
    eventType: NOTIFICATION_EVENT_TYPES.projectAcknowledged,
    context: taskNotificationContext(input.task),
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
  projectName?: string | null;
}): Promise<void> {
  const context: NotificationContext = {
    projectName: input.projectName,
    taskNumber: input.task?.id ?? null,
    taskTitle: input.task ? (input.task.Issue ?? "").trim() || null : null,
    detail: input.detail ?? input.summary,
  };

  if (input.task) {
    await notifySbOwners({
      task: input.task,
      projectId: input.projectId,
      users: input.users,
      eventType: NOTIFICATION_EVENT_TYPES.feedEntry,
      context,
      dedupeHours: 6,
    });
    return;
  }

  const supabase = createClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id")
    .in("role", ["admin", "internal"]);

  if (!profiles?.length) return;

  await notifyAttributed({
    userIds: profiles.map((profile) => profile.id),
    projectId: input.projectId,
    taskId: input.taskId ?? null,
    eventType: NOTIFICATION_EVENT_TYPES.feedEntry,
    context,
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

    if (status === "overdue") {
      await notifySbOwners({
        task,
        projectId: input.projectId,
        users: input.users,
        eventType: NOTIFICATION_EVENT_TYPES.taskOverdue,
        context: taskNotificationContext(task),
        dedupeHours: 24,
      });
      continue;
    }

    if (isDueWithinNextDays(task["Date Due"], 1)) {
      const dueToday =
        taskDateValue(task["Date Due"]) === new Date().toISOString().slice(0, 10);
      await notifySbOwners({
        task,
        projectId: input.projectId,
        users: input.users,
        eventType: dueToday
          ? NOTIFICATION_EVENT_TYPES.taskDueToday
          : NOTIFICATION_EVENT_TYPES.dueTomorrow,
        context: taskNotificationContext(task),
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
    eventType: NOTIFICATION_EVENT_TYPES.waitingForResponse,
    context: taskNotificationContext(
      input.task,
      null,
      "waiting for response"
    ),
    dedupeHours: 12,
  });
}

export async function notifyProjectAtRisk(input: {
  projectId: string;
  projectName: string;
  users: AppUser[];
  reason: string;
}): Promise<void> {
  const supabase = createClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id")
    .in("role", ["admin", "internal"]);

  if (!profiles?.length) return;

  await notifyAttributed({
    userIds: profiles.map((profile) => profile.id),
    projectId: input.projectId,
    eventType: NOTIFICATION_EVENT_TYPES.projectAtRisk,
    context: {
      projectName: input.projectName,
      detail: input.reason,
    },
    dedupeHours: 24,
  });
}

export async function notifyCommentMention(input: {
  projectId: string;
  taskId: string;
  taskLabel: string;
  userIds: string[];
  message: string;
  taskNumber?: number | null;
}): Promise<void> {
  if (input.userIds.length === 0) return;

  const detail =
    input.message.length > 120
      ? `${input.message.slice(0, 117)}…`
      : input.message;

  await notifyAttributed({
    userIds: input.userIds,
    projectId: input.projectId,
    taskId: input.taskId,
    eventType: NOTIFICATION_EVENT_TYPES.commentMention,
    context: {
      taskNumber: input.taskNumber ?? null,
      taskTitle: input.taskLabel,
      detail,
    },
    dedupeHours: 1,
  });
}
