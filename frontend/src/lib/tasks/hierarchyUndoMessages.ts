import { hierarchyShortName } from "@/lib/tasks/hierarchyDisplay";
import type { Task } from "@/lib/tasks/types";
import { taskHierarchyLabel } from "@/lib/tasks/subtasks";

export type HierarchyUndoEntry = {
  taskUuid: string;
  previousParentId: string | null;
};

export function parentDisplayName(task: Task | undefined | null): string {
  if (!task) return "none";
  return hierarchyShortName(taskHierarchyLabel(task));
}

export function undoMessageConvert(task: Task, parent: Task): string {
  return `Task moved under ${parentDisplayName(parent)}`;
}

export function undoMessageReparent(
  task: Task,
  newParent: Task,
  oldParent: Task | null | undefined
): string {
  if (oldParent) {
    return `Task moved from ${parentDisplayName(oldParent)} to ${parentDisplayName(newParent)}`;
  }
  return undoMessageConvert(task, newParent);
}

export function undoMessagePromote(task: Task): string {
  return `Subtask promoted to main task: ${hierarchyShortName(taskHierarchyLabel(task))}`;
}

export function undoMessageBulk(count: number, parent: Task): string {
  return `${count} task${count === 1 ? "" : "s"} moved under ${parentDisplayName(parent)}`;
}
