/** Standard in-app notification titles (stored in user_notifications.title). */
export const NOTIFICATION_TITLES = {
  clientComment: "Client comment added",
  taskAssigned: "Task assigned",
  dueTomorrow: "Task due tomorrow",
  taskOverdue: "Task overdue",
  taskCompleted: "Task completed",
  projectAcknowledged: "Project acknowledged",
  dueDateChanged: "Due date changed",
  feedEntry: "New project feed entry",
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
