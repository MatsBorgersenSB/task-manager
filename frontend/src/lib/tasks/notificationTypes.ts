/** Standard in-app notification titles (legacy; stored before attribution). */
export const NOTIFICATION_TITLES = {
  clientComment: "Client comment added",
  taskAssigned: "Task assigned",
  dueTomorrow: "Task due tomorrow",
  taskDueToday: "Task due today",
  taskOverdue: "Task overdue",
  taskCompleted: "Task completed",
  projectAcknowledged: "Project acknowledged",
  dueDateChanged: "Due date changed",
  feedEntry: "New project feed entry",
  waitingForResponse: "Waiting for response",
  projectAtRisk: "Project at risk",
  commentMention: "You were mentioned",
} as const;

/** Machine-readable notification event keys (stored in user_notifications.event_type). */
export const NOTIFICATION_EVENT_TYPES = {
  clientComment: "client_comment",
  internalComment: "internal_comment",
  taskAssigned: "task_assigned",
  dueTomorrow: "due_tomorrow",
  taskDueToday: "task_due_today",
  taskOverdue: "task_overdue",
  taskCompleted: "task_completed",
  taskCreated: "task_created",
  projectAcknowledged: "project_acknowledged",
  dueDateChanged: "due_date_changed",
  statusChanged: "status_changed",
  feedEntry: "feed_entry",
  feedEntryEdited: "feed_entry_edited",
  waitingForResponse: "waiting_for_response",
  projectAtRisk: "project_at_risk",
  commentMention: "comment_mention",
} as const;

export type NotificationTitle =
  (typeof NOTIFICATION_TITLES)[keyof typeof NOTIFICATION_TITLES];

export type NotificationEventType =
  (typeof NOTIFICATION_EVENT_TYPES)[keyof typeof NOTIFICATION_EVENT_TYPES];

export function notificationTypeLabel(title: string): string {
  const normalized = title.trim();
  if (Object.values(NOTIFICATION_TITLES).includes(normalized as NotificationTitle)) {
    return normalized;
  }
  return normalized.replace(/^🔔\s*/, "");
}

export function notificationIcon(
  title: string,
  eventType?: string | null
): string {
  const key = eventType ?? title;

  switch (key) {
    case NOTIFICATION_EVENT_TYPES.waitingForResponse:
    case NOTIFICATION_TITLES.waitingForResponse:
      return "💬";
    case NOTIFICATION_EVENT_TYPES.projectAtRisk:
    case NOTIFICATION_TITLES.projectAtRisk:
      return "⚠";
    case NOTIFICATION_EVENT_TYPES.taskDueToday:
    case NOTIFICATION_EVENT_TYPES.dueTomorrow:
    case NOTIFICATION_TITLES.taskDueToday:
    case NOTIFICATION_TITLES.dueTomorrow:
      return "📅";
    case NOTIFICATION_EVENT_TYPES.taskOverdue:
    case NOTIFICATION_TITLES.taskOverdue:
      return "🔴";
    case NOTIFICATION_EVENT_TYPES.taskAssigned:
    case NOTIFICATION_TITLES.taskAssigned:
      return "📋";
    case NOTIFICATION_EVENT_TYPES.commentMention:
    case NOTIFICATION_TITLES.commentMention:
      return "@";
    case NOTIFICATION_EVENT_TYPES.clientComment:
    case NOTIFICATION_TITLES.clientComment:
      return "💬";
    default:
      return "🔔";
  }
}
