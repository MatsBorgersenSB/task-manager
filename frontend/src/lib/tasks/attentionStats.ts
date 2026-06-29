import type { Task } from "@/lib/tasks/types";
import {
  getTaskDueStatus,
  isDueWithinNextDays,
  isTaskComplete,
} from "@/lib/tasks/taskDates";

export type AttentionStats = {
  overdue: number;
  dueWithin24Hours: number;
  unansweredComments: number;
  total: number;
};

export function attentionCardColorClass(total: number): {
  card: string;
  value: string;
  ring: string;
} {
  if (total === 0) {
    return {
      card: "border-green-200 bg-green-50 hover:bg-green-100/80",
      value: "text-green-900",
      ring: "ring-green-400",
    };
  }
  if (total <= 4) {
    return {
      card: "border-amber-200 bg-amber-50 hover:bg-amber-100/80",
      value: "text-amber-900",
      ring: "ring-amber-400",
    };
  }
  return {
    card: "border-red-200 bg-red-50 hover:bg-red-100/80",
    value: "text-red-900",
    ring: "ring-red-400",
  };
}

export function computeAttentionStats(
  tasks: Task[],
  waitingTaskIds: Set<string>
): AttentionStats {
  const mainTasks = tasks.filter((task) => !task.parent_task_id);
  let overdue = 0;
  let dueWithin24Hours = 0;

  for (const task of mainTasks) {
    if (isTaskComplete(task)) continue;
    const status = getTaskDueStatus(task);
    if (status === "overdue") overdue += 1;
    if (isDueWithinNextDays(task["Date Due"], 1)) dueWithin24Hours += 1;
  }

  const unansweredComments = [...waitingTaskIds].filter((taskId) =>
    mainTasks.some((task) => task._uuid === taskId && !isTaskComplete(task))
  ).length;

  return {
    overdue,
    dueWithin24Hours,
    unansweredComments,
    total: overdue + dueWithin24Hours + unansweredComments,
  };
}

export function taskNeedsAttention(
  task: Task,
  waitingTaskIds: Set<string>
): boolean {
  if (isTaskComplete(task)) return false;
  if (waitingTaskIds.has(task._uuid)) return true;
  const status = getTaskDueStatus(task);
  if (status === "overdue") return true;
  return isDueWithinNextDays(task["Date Due"], 1);
}
