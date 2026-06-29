import type { Task } from "@/lib/tasks/types";
import { isRecentTask } from "@/lib/tasks/recentTasks";
import {
  getTaskDueStatus,
  isDueWithinNextDays,
  isTaskComplete,
} from "@/lib/tasks/taskDates";
import { isSubtaskComplete } from "@/lib/tasks/subtasks";

export type ProjectTaskStats = {
  open: number;
  completed: number;
  overdue: number;
  dueThisWeek: number;
  recentUpdates: number;
  subtasksOpen: number;
  subtasksCompleted: number;
  total: number;
  progressPercent: number;
};

export { isTaskComplete } from "@/lib/tasks/taskDates";

export function computeProjectTaskStats(tasks: Task[]): ProjectTaskStats {
  const mainTasks = tasks.filter((task) => !task.parent_task_id);
  const subtasks = tasks.filter((task) => task.parent_task_id);
  let open = 0;
  let completed = 0;
  let overdue = 0;
  let dueThisWeek = 0;
  let recentUpdates = 0;
  let subtasksOpen = 0;
  let subtasksCompleted = 0;

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

  for (const task of subtasks) {
    if (isSubtaskComplete(task)) {
      subtasksCompleted += 1;
    } else {
      subtasksOpen += 1;
    }
    if (isRecentTask(task)) {
      recentUpdates += 1;
    }
  }

  const completedWork = completed + subtasksCompleted;
  const totalWork = mainTasks.length + subtasks.length;

  return {
    open,
    completed,
    overdue,
    dueThisWeek,
    recentUpdates,
    subtasksOpen,
    subtasksCompleted,
    total: mainTasks.length,
    progressPercent:
      totalWork > 0 ? Math.round((completedWork / totalWork) * 100) : 0,
  };
}
