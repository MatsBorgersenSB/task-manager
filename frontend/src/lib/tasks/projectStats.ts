import { isRecentTask } from "@/lib/tasks/recentTasks";
import {
  getTaskDueStatus,
  isDueWithinNextDays,
  isTaskComplete,
} from "@/lib/tasks/taskDates";
import type { Task } from "@/lib/tasks/types";

export type ProjectTaskStats = {
  open: number;
  completed: number;
  overdue: number;
  dueThisWeek: number;
  recentUpdates: number;
  total: number;
  progressPercent: number;
};

export { isTaskComplete } from "@/lib/tasks/taskDates";

export function computeProjectTaskStats(tasks: Task[]): ProjectTaskStats {
  const mainTasks = tasks.filter((task) => !task.parent_task_id);
  let open = 0;
  let completed = 0;
  let overdue = 0;
  let dueThisWeek = 0;
  let recentUpdates = 0;

  for (const task of mainTasks) {
    const complete = isTaskComplete(task);

    if (complete) {
      completed += 1;
    } else {
      open += 1;
      const dueStatus = getTaskDueStatus(task);
      if (dueStatus === "overdue") overdue += 1;
      if (isDueWithinNextDays(task["Date Due"], 7)) dueThisWeek += 1;
    }

    if (isRecentTask(task)) {
      recentUpdates += 1;
    }
  }

  return {
    open,
    completed,
    overdue,
    dueThisWeek,
    recentUpdates,
    total: mainTasks.length,
    progressPercent:
      mainTasks.length > 0
        ? Math.round((completed / mainTasks.length) * 100)
        : 0,
  };
}
