import type { SubtaskProgress, Task } from "@/lib/tasks/types";

export function isSubtaskComplete(task: Task): boolean {
  const status = (task.status ?? "").trim().toLowerCase();
  return status === "complete" || Boolean(task["Date Completed"]?.trim());
}

export function getSubtasksForParent(
  allTasks: Task[],
  parentTaskUuid: string | null | undefined
): Task[] {
  if (!parentTaskUuid) return [];
  return allTasks
    .filter((task) => task.parent_task_id === parentTaskUuid)
    .sort((a, b) => a.id - b.id);
}

export function getSubtaskProgressForTask(
  parentTaskUuid: string,
  allTasks: Task[]
): SubtaskProgress | undefined {
  const subs = getSubtasksForParent(allTasks, parentTaskUuid);
  if (subs.length === 0) return undefined;
  return {
    completed: subs.filter(isSubtaskComplete).length,
    total: subs.length,
  };
}

export function subtaskProgressLabel(
  progress: SubtaskProgress | undefined
): string {
  if (!progress || progress.total === 0) return "";
  return `${progress.completed}/${progress.total}`;
}

export function subtaskProgressPercent(
  progress: SubtaskProgress | undefined
): number {
  if (!progress || progress.total === 0) return 0;
  return Math.round((progress.completed / progress.total) * 100);
}

/** Subtask column / indicator colors: 0% grey, 1–99% blue, 100% green. */
export function subtaskProgressColorClass(
  progress: SubtaskProgress | undefined
): string {
  const percent = subtaskProgressPercent(progress);
  if (percent === 0) return "text-slate-500";
  if (percent === 100) return "text-green-700";
  return "text-blue-700";
}

export function subtaskProgressBarClass(
  progress: SubtaskProgress | undefined
): string {
  const percent = subtaskProgressPercent(progress);
  if (percent === 0) return "bg-slate-400";
  if (percent === 100) return "bg-green-500";
  return "bg-blue-500";
}

export function countSubtasks(tasks: Task[]): {
  open: number;
  completed: number;
} {
  let open = 0;
  let completed = 0;
  for (const task of tasks) {
    if (!task.parent_task_id) continue;
    if (isSubtaskComplete(task)) completed += 1;
    else open += 1;
  }
  return { open, completed };
}

export function listParentTaskCandidates(
  allTasks: Task[],
  currentTask: Task
): Task[] {
  return allTasks
    .filter(
      (task) =>
        !task.parent_task_id &&
        task._uuid !== currentTask._uuid
    )
    .sort((a, b) => a.id - b.id);
}

export function validateMoveToSubtask(
  task: Task,
  parentTaskId: string,
  allTasks: Task[]
): void {
  if (parentTaskId === task._uuid) {
    throw new Error("A task cannot be a subtask of itself");
  }

  const parent = allTasks.find((row) => row._uuid === parentTaskId);
  if (!parent) {
    throw new Error("Parent task not found");
  }

  if (parent.parent_task_id) {
    throw new Error("Subtasks can only be added to main tasks");
  }

  const children = getSubtasksForParent(allTasks, task._uuid);
  if (children.length > 0) {
    throw new Error("A task with subtasks cannot become a subtask");
  }
}

export function canMoveTaskToSubtask(task: Task, allTasks: Task[]): boolean {
  if (task.parent_task_id) return false;
  return getSubtasksForParent(allTasks, task._uuid).length === 0;
}
