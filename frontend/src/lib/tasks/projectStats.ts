import { isRecentTask } from "@/lib/tasks/recentTasks";
import { getDueStatus, taskDateValue } from "@/lib/tasks/taskDates";
import type { Task } from "@/lib/tasks/types";

export type ProjectTaskStats = {
  open: number;
  completed: number;
  overdue: number;
  dueThisWeek: number;
  recentUpdates: number;
};

export function isTaskComplete(task: Task): boolean {
  return (task.status ?? "").trim() === "Complete";
}

function parseLocalDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map((part) => Number.parseInt(part, 10));
  return new Date(year, month - 1, day);
}

/** Monday–Sunday bounds for the week containing `reference`. */
function weekBounds(reference: Date): { start: Date; end: Date } {
  const date = new Date(reference);
  date.setHours(0, 0, 0, 0);
  const weekday = date.getDay();
  const daysFromMonday = weekday === 0 ? 6 : weekday - 1;
  const start = new Date(date);
  start.setDate(date.getDate() - daysFromMonday);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function isDueThisWeek(
  dueDate: string | null | undefined,
  reference = new Date()
): boolean {
  const normalized = taskDateValue(dueDate);
  if (!normalized) return false;
  const due = parseLocalDate(normalized);
  const { start, end } = weekBounds(reference);
  return due >= start && due <= end;
}

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
      if (getDueStatus(task["Date Due"]) === "overdue") {
        overdue += 1;
      }
      if (isDueThisWeek(task["Date Due"])) {
        dueThisWeek += 1;
      }
    }

    if (isRecentTask(task)) {
      recentUpdates += 1;
    }
  }

  return { open, completed, overdue, dueThisWeek, recentUpdates };
}
