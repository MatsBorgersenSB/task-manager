import type { Task } from "@/lib/tasks/types";
import { isRecentTask } from "@/lib/tasks/recentTasks";
import {
  getTaskDueStatus,
  isDueWithinNextDays,
  isTaskComplete,
} from "@/lib/tasks/taskDates";
import { isSubtaskComplete } from "@/lib/tasks/subtasks";

function maxIsoDate(a: string | null | undefined, b: string | null | undefined): string | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
}

export function isClientActivityTask(task: Task, windowDays = 7): boolean {
  const cutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000;
  const updated = task._updatedAt ? new Date(task._updatedAt).getTime() : NaN;
  if (Number.isNaN(updated) || updated < cutoff) return false;
  if (task.acknowledged_at) {
    const ack = new Date(task.acknowledged_at).getTime();
    if (!Number.isNaN(ack) && ack >= cutoff) return true;
  }
  return task._createdByRole === "external";
}

export type ProjectTaskStats = {
  open: number;
  completed: number;
  overdue: number;
  dueSoon: number;
  dueThisWeek: number;
  recentUpdates: number;
  clientActivity: number;
  subtasksOpen: number;
  subtasksCompleted: number;
  total: number;
  progressPercent: number;
  /** Most recent task update timestamp in the project (ISO). */
  lastTaskActivityAt: string | null;
};

export { isTaskComplete } from "@/lib/tasks/taskDates";

export function computeProjectTaskStats(tasks: Task[]): ProjectTaskStats {
  const mainTasks = tasks.filter((task) => !task.parent_task_id);
  const subtasks = tasks.filter((task) => task.parent_task_id);
  let open = 0;
  let completed = 0;
  let overdue = 0;
  let dueSoon = 0;
  let dueThisWeek = 0;
  let recentUpdates = 0;
  let clientActivity = 0;
  let subtasksOpen = 0;
  let subtasksCompleted = 0;
  let lastTaskActivityAt: string | null = null;

  for (const task of mainTasks) {
    lastTaskActivityAt = maxIsoDate(lastTaskActivityAt, task._updatedAt);
    lastTaskActivityAt = maxIsoDate(lastTaskActivityAt, task.acknowledged_at);

    const complete = isTaskComplete(task);

    if (complete) {
      completed += 1;
    } else {
      open += 1;
      const dueStatus = getTaskDueStatus(task);
      if (dueStatus === "overdue") overdue += 1;
      if (isDueWithinNextDays(task["Date Due"], 7)) dueThisWeek += 1;
      if (
        dueStatus !== "overdue" &&
        dueStatus !== "completed" &&
        (dueStatus === "soon" || isDueWithinNextDays(task["Date Due"], 7))
      ) {
        dueSoon += 1;
      }
    }

    if (isRecentTask(task)) {
      recentUpdates += 1;
    }

    if (isClientActivityTask(task)) {
      clientActivity += 1;
    }
  }

  for (const task of subtasks) {
    lastTaskActivityAt = maxIsoDate(lastTaskActivityAt, task._updatedAt);
    if (isSubtaskComplete(task)) {
      subtasksCompleted += 1;
    } else {
      subtasksOpen += 1;
    }
    if (isRecentTask(task)) {
      recentUpdates += 1;
    }
    if (isClientActivityTask(task)) {
      clientActivity += 1;
    }
  }

  const completedWork = completed + subtasksCompleted;
  const totalWork = mainTasks.length + subtasks.length;

  return {
    open,
    completed,
    overdue,
    dueSoon,
    dueThisWeek,
    recentUpdates,
    clientActivity,
    subtasksOpen,
    subtasksCompleted,
    total: mainTasks.length,
    progressPercent:
      totalWork > 0 ? Math.round((completedWork / totalWork) * 100) : 0,
    lastTaskActivityAt,
  };
}
