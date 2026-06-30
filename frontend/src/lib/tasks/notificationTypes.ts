/** Standard in-app notification titles (stored in user_notifications.title). */
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

export type NotificationTitle =
  (typeof NOTIFICATION_TITLES)[keyof typeof NOTIFICATION_TITLES];

export function notificationTypeLabel(title: string): string {
  const normalized = title.trim();
  if (Object.values(NOTIFICATION_TITLES).includes(normalized as NotificationTitle)) {
    return normalized;
  }
  return normalized.replace(/^🔔\s*/, "");
}

export function notificationIcon(title: string): string {
  switch (title) {
    case NOTIFICATION_TITLES.waitingForResponse:
      return "💬";
    case NOTIFICATION_TITLES.projectAtRisk:
      return "⚠";
    case NOTIFICATION_TITLES.taskDueToday:
    case NOTIFICATION_TITLES.dueTomorrow:
      return "📅";
    case NOTIFICATION_TITLES.taskOverdue:
      return "🔴";
    case NOTIFICATION_TITLES.taskAssigned:
      return "📋";
    case NOTIFICATION_TITLES.commentMention:
      return "@";
    case NOTIFICATION_TITLES.clientComment:
      return "💬";
    default:
      return "🔔";
  }
}
