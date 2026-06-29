import type { Task } from "@/lib/tasks/types";

export const RECENT_WINDOW_MINUTES = 60;

export function isRecentTask(
  task: Task,
  windowMinutes = RECENT_WINDOW_MINUTES
): boolean {
  if (!task._updatedAt) return false;

  const updated = new Date(task._updatedAt).getTime();
  if (Number.isNaN(updated)) return false;

  const diffMinutes = (Date.now() - updated) / 1000 / 60;
  return diffMinutes <= windowMinutes;
}
