import { currentUserHandle, filterTasksForUser } from "@/lib/tasks/myTasks";
import type { Task } from "@/lib/tasks/types";
import {
  getTaskDueStatus,
  isDueWithinNextDays,
  isTaskComplete,
} from "@/lib/tasks/taskDates";
import { isDueToday, isTaskBlocked } from "@/lib/attention/attentionEngine";

export type MyTasksWorkspaceStats = {
  open: number;
  dueToday: number;
  overdue: number;
  dueThisWeek: number;
  completedThisWeek: number;
};

export type MyTaskPriorityGroup =
  | "overdue"
  | "dueToday"
  | "waiting"
  | "blocked"
  | "dueSoon"
  | "other";

export function computeMyTasksWorkspaceStats(
  tasks: Task[],
  userHandle: string
): MyTasksWorkspaceStats {
  const mine = filterTasksForUser(
    tasks.filter((task) => !task.parent_task_id),
    userHandle
  );

  let open = 0;
  let dueToday = 0;
  let overdue = 0;
  let dueThisWeek = 0;
  let completedThisWeek = 0;

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  for (const task of mine) {
    if (isTaskComplete(task)) {
      const completed = task["Date Completed"]?.trim();
      if (completed) {
        const completedTime = new Date(completed).getTime();
        if (!Number.isNaN(completedTime) && completedTime >= weekAgo) {
          completedThisWeek += 1;
        }
      }
      continue;
    }

    open += 1;
    if (getTaskDueStatus(task) === "overdue") overdue += 1;
    if (isDueToday(task["Date Due"])) dueToday += 1;
    if (isDueWithinNextDays(task["Date Due"], 7)) dueThisWeek += 1;
  }

  return { open, dueToday, overdue, dueThisWeek, completedThisWeek };
}

export function classifyMyTaskPriority(
  task: Task,
  waitingTaskIds: Set<string>
): MyTaskPriorityGroup {
  if (getTaskDueStatus(task) === "overdue") return "overdue";
  if (isDueToday(task["Date Due"])) return "dueToday";
  if (waitingTaskIds.has(task._uuid)) return "waiting";
  if (isTaskBlocked(task)) return "blocked";
  if (isDueWithinNextDays(task["Date Due"], 3)) return "dueSoon";
  return "other";
}

const PRIORITY_ORDER: Record<MyTaskPriorityGroup, number> = {
  overdue: 0,
  dueToday: 1,
  waiting: 2,
  blocked: 3,
  dueSoon: 4,
  other: 5,
};

export function sortMyTasksByPriority(
  tasks: Task[],
  waitingTaskIds: Set<string>
): Task[] {
  return [...tasks].sort((a, b) => {
    const rankA = PRIORITY_ORDER[classifyMyTaskPriority(a, waitingTaskIds)];
    const rankB = PRIORITY_ORDER[classifyMyTaskPriority(b, waitingTaskIds)];
    if (rankA !== rankB) return rankA - rankB;

    const dueA = a["Date Due"] ?? "9999-99-99";
    const dueB = b["Date Due"] ?? "9999-99-99";
    if (dueA !== dueB) return dueA.localeCompare(dueB);

    return a.id - b.id;
  });
}

export function filterPriorityTasks(
  tasks: Task[],
  userHandle: string,
  waitingTaskIds: Set<string>
): Task[] {
  const mine = filterTasksForUser(
    tasks.filter((task) => !task.parent_task_id && !isTaskComplete(task)),
    userHandle
  );

  return mine.filter((task) => {
    const group = classifyMyTaskPriority(task, waitingTaskIds);
    return (
      group === "overdue" ||
      group === "dueToday" ||
      group === "waiting" ||
      group === "blocked"
    );
  });
}

export function resolveUserHandle(email: string | null | undefined): string {
  return currentUserHandle(email);
}
