import { parseSbOwners } from "@/lib/tasks/sbOwners";
import type { Task } from "@/lib/tasks/types";
import {
  getTaskDueStatus,
  isDueWithinNextDays,
  isTaskComplete,
} from "@/lib/tasks/taskDates";

export function currentUserHandle(email: string | null | undefined): string {
  if (!email) return "";
  return (email.split("@")[0] ?? email).trim();
}

/** True when Responsible or SB Owner matches the signed-in user handle. */
export function taskBelongsToUser(
  task: Task,
  userHandle: string | null | undefined
): boolean {
  const handle = (userHandle ?? "").trim().toLowerCase();
  if (!handle) return false;

  const responsible = (task.Responsible ?? "").trim().toLowerCase();
  if (responsible === handle || responsible.includes(handle)) {
    return true;
  }

  return parseSbOwners(task["SB Owner"]).some(
    (owner) => owner.toLowerCase() === handle
  );
}

export function filterTasksForUser(tasks: Task[], userHandle: string): Task[] {
  if (!userHandle) return tasks;
  return tasks.filter((task) => taskBelongsToUser(task, userHandle));
}

export type MyTaskStats = {
  open: number;
  dueSoon: number;
  overdue: number;
};

export function computeMyTaskStats(
  tasks: Task[],
  userHandle: string
): MyTaskStats {
  const mine = filterTasksForUser(tasks, userHandle);
  let open = 0;
  let dueSoon = 0;
  let overdue = 0;

  for (const task of mine) {
    if (isTaskComplete(task)) continue;
    open += 1;
    const status = getTaskDueStatus(task);
    if (status === "overdue") overdue += 1;
    if (status === "soon" || isDueWithinNextDays(task["Date Due"], 3)) {
      dueSoon += 1;
    }
  }

  return { open, dueSoon, overdue };
}
