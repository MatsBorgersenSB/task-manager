import {
  NOTIFICATION_EVENT_TYPES,
  NOTIFICATION_TITLES,
  type NotificationEventType,
} from "@/lib/tasks/notificationTypes";
import type { EnrichedUserNotification } from "@/lib/tasks/notifications";

export type NotificationFormatContext = {
  actorName: string;
  projectName?: string | null;
  taskNumber?: number | null;
  taskTitle?: string | null;
  detail?: string | null;
};

function taskRef(context: NotificationFormatContext): string {
  if (context.taskNumber != null) {
    return `task #${context.taskNumber}`;
  }
  if (context.taskTitle?.trim()) {
    return context.taskTitle.trim();
  }
  return "a task";
}

export function buildNotificationTitle(
  eventType: NotificationEventType,
  context: NotificationFormatContext
): string {
  const { actorName } = context;
  const task = taskRef(context);

  switch (eventType) {
    case NOTIFICATION_EVENT_TYPES.feedEntry:
      return `${actorName} added a project update`;
    case NOTIFICATION_EVENT_TYPES.feedEntryEdited:
      return `${actorName} edited a project update`;
    case NOTIFICATION_EVENT_TYPES.taskCreated:
      return `${actorName} created ${task}`;
    case NOTIFICATION_EVENT_TYPES.clientComment:
      return `${actorName} added a client comment`;
    case NOTIFICATION_EVENT_TYPES.internalComment:
      return `${actorName} added an internal note`;
    case NOTIFICATION_EVENT_TYPES.taskAssigned:
      return `${actorName} assigned you to ${task}`;
    case NOTIFICATION_EVENT_TYPES.taskCompleted:
      return `${actorName} completed ${task}`;
    case NOTIFICATION_EVENT_TYPES.dueDateChanged:
      return `${actorName} changed due date on ${task}`;
    case NOTIFICATION_EVENT_TYPES.statusChanged:
      return `${actorName} changed status on ${task}`;
    case NOTIFICATION_EVENT_TYPES.projectAcknowledged:
      return `${actorName} acknowledged project completion`;
    case NOTIFICATION_EVENT_TYPES.taskOverdue:
      return `${task} is overdue`;
    case NOTIFICATION_EVENT_TYPES.taskDueToday:
      return `${task} is due today`;
    case NOTIFICATION_EVENT_TYPES.dueTomorrow:
      return `${task} is due tomorrow`;
    case NOTIFICATION_EVENT_TYPES.waitingForResponse:
      return `Waiting for response on ${task}`;
    case NOTIFICATION_EVENT_TYPES.projectAtRisk:
      return context.projectName
        ? `${context.projectName} is at risk`
        : "Project at risk";
    case NOTIFICATION_EVENT_TYPES.commentMention:
      return `${actorName} mentioned you`;
    default:
      return `${actorName} performed an update`;
  }
}

export function buildNotificationBody(
  eventType: NotificationEventType,
  context: NotificationFormatContext
): string | null {
  const parts: string[] = [];

  if (context.projectName?.trim()) {
    parts.push(context.projectName.trim());
  }

  if (context.detail?.trim()) {
    parts.push(context.detail.trim());
  } else if (
    context.taskTitle?.trim() &&
    eventType !== NOTIFICATION_EVENT_TYPES.taskCreated
  ) {
    parts.push(context.taskTitle.trim());
  }

  return parts.length > 0 ? parts.join(" — ") : null;
}

const LEGACY_TITLE_TO_EVENT: Record<string, NotificationEventType> = {
  [NOTIFICATION_TITLES.clientComment]: NOTIFICATION_EVENT_TYPES.clientComment,
  [NOTIFICATION_TITLES.taskAssigned]: NOTIFICATION_EVENT_TYPES.taskAssigned,
  [NOTIFICATION_TITLES.dueTomorrow]: NOTIFICATION_EVENT_TYPES.dueTomorrow,
  [NOTIFICATION_TITLES.taskDueToday]: NOTIFICATION_EVENT_TYPES.taskDueToday,
  [NOTIFICATION_TITLES.taskOverdue]: NOTIFICATION_EVENT_TYPES.taskOverdue,
  [NOTIFICATION_TITLES.taskCompleted]: NOTIFICATION_EVENT_TYPES.taskCompleted,
  [NOTIFICATION_TITLES.projectAcknowledged]:
    NOTIFICATION_EVENT_TYPES.projectAcknowledged,
  [NOTIFICATION_TITLES.dueDateChanged]: NOTIFICATION_EVENT_TYPES.dueDateChanged,
  [NOTIFICATION_TITLES.feedEntry]: NOTIFICATION_EVENT_TYPES.feedEntry,
  [NOTIFICATION_TITLES.waitingForResponse]:
    NOTIFICATION_EVENT_TYPES.waitingForResponse,
  [NOTIFICATION_TITLES.projectAtRisk]: NOTIFICATION_EVENT_TYPES.projectAtRisk,
  [NOTIFICATION_TITLES.commentMention]: NOTIFICATION_EVENT_TYPES.commentMention,
};

export function resolveNotificationEventType(
  notification: EnrichedUserNotification
): NotificationEventType | null {
  if (notification.event_type) {
    return notification.event_type as NotificationEventType;
  }
  return LEGACY_TITLE_TO_EVENT[notification.title.trim()] ?? null;
}

export function formatNotificationHeadline(
  notification: EnrichedUserNotification
): string {
  const actorName = notification.actor_name ?? "Someone";
  const eventType = resolveNotificationEventType(notification);

  if (eventType) {
    return buildNotificationTitle(eventType, {
      actorName,
      projectName: notification.project_name,
      taskNumber: notification.task_number,
      taskTitle: notification.task_title,
      detail: notification.body,
    });
  }

  if (
    notification.title === NOTIFICATION_TITLES.feedEntry &&
    notification.actor_name
  ) {
    return `${actorName} added a project update`;
  }

  return notification.title.replace(/^🔔\s*/, "");
}

export function formatNotificationSubtitle(
  notification: EnrichedUserNotification
): string | null {
  const eventType = resolveNotificationEventType(notification);
  if (!eventType) {
    return notification.body;
  }

  const body = buildNotificationBody(eventType, {
    actorName: notification.actor_name ?? "Someone",
    projectName: notification.project_name,
    taskNumber: notification.task_number,
    taskTitle: notification.task_title,
    detail: notification.body,
  });

  const headline = formatNotificationHeadline(notification);
  if (body && body !== headline) {
    return body;
  }

  if (notification.project_name && !headline.includes(notification.project_name)) {
    return notification.project_name;
  }

  return notification.body;
}
