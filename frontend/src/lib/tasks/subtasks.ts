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

export function getParentTask(
  allTasks: Task[],
  task: Task
): Task | undefined {
  if (!task.parent_task_id) return undefined;
  return allTasks.find((row) => row._uuid === task.parent_task_id);
}

/** 0 = main task, 1 = subtask, 2 = subtask of a subtask, and so on. */
export function taskDepth(
  task: Task,
  allTasks: Task[],
  seen: Set<string> = new Set()
): number {
  if (!task.parent_task_id || seen.has(task._uuid)) return 0;
  seen.add(task._uuid);
  const parent = allTasks.find((row) => row._uuid === task.parent_task_id);
  if (!parent) return 1;
  return 1 + taskDepth(parent, allTasks, seen);
}

/** Every nested child under `parentId`, depth-first, siblings in id order. */
export function getDescendantTasks(allTasks: Task[], parentId: string): Task[] {
  const result: Task[] = [];
  const seen = new Set<string>();

  const walk = (id: string) => {
    for (const child of getSubtasksForParent(allTasks, id)) {
      if (seen.has(child._uuid)) continue;
      seen.add(child._uuid);
      result.push(child);
      walk(child._uuid);
    }
  };

  walk(parentId);
  return result;
}

export function collectDescendantIds(
  rootId: string,
  allTasks: Task[]
): Set<string> {
  return new Set(getDescendantTasks(allTasks, rootId).map((task) => task._uuid));
}

/**
 * Ids to expand so `task` and its ancestors are visible in the table tree.
 * Includes the task itself.
 */
export function hierarchyExpandIds(task: Task, allTasks: Task[]): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  let current: Task | undefined = task;

  while (current && !seen.has(current._uuid)) {
    seen.add(current._uuid);
    ids.push(current._uuid);
    if (!current.parent_task_id) break;
    current = allTasks.find((row) => row._uuid === current?.parent_task_id);
  }

  return ids;
}

/** Main tasks, then each expanded parent's children, at every depth. */
export function flattenVisibleHierarchy(
  mainTasks: Task[],
  allTasks: Task[],
  expandedParentIds: ReadonlySet<string>
): Task[] {
  const rows: Task[] = [];
  const seen = new Set<string>();

  const visit = (task: Task) => {
    if (seen.has(task._uuid)) return;
    seen.add(task._uuid);
    rows.push(task);
    if (!expandedParentIds.has(task._uuid)) return;
    for (const child of getSubtasksForParent(allTasks, task._uuid)) {
      visit(child);
    }
  };

  for (const main of mainTasks) visit(main);
  return rows;
}

function sameProject(task: Task, parent: Task): boolean {
  if (!task.project_id || !parent.project_id) return true;
  return task.project_id === parent.project_id;
}

/** True when `parentId` is `taskId` or sits under it. */
export function parentCreatesCycle(
  taskId: string,
  parentId: string,
  allTasks: Task[]
): boolean {
  if (parentId === taskId) return true;
  const seen = new Set<string>();
  let current: string | null | undefined = parentId;

  while (current && !seen.has(current)) {
    if (current === taskId) return true;
    seen.add(current);
    const row = allTasks.find((task) => task._uuid === current);
    current = row?.parent_task_id ?? null;
  }

  return false;
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
  currentTask: Task,
  options?: { excludeParentId?: string | null }
): Task[] {
  const blocked = collectDescendantIds(currentTask._uuid, allTasks);
  blocked.add(currentTask._uuid);
  if (options?.excludeParentId) blocked.add(options.excludeParentId);

  return allTasks
    .filter(
      (task) =>
        !blocked.has(task._uuid) && sameProject(currentTask, task)
    )
    .sort((a, b) => a.id - b.id);
}

export function listBulkParentCandidates(
  allTasks: Task[],
  selected: Task[]
): Task[] {
  const blocked = new Set<string>();
  for (const task of selected) {
    blocked.add(task._uuid);
    for (const id of collectDescendantIds(task._uuid, allTasks)) {
      blocked.add(id);
    }
  }

  return allTasks
    .filter((task) => !blocked.has(task._uuid))
    .sort((a, b) => a.id - b.id);
}

/** Validates placing `task` under `parentTaskId`. Any depth is allowed; cycles are not. */
export function validateAssignParent(
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

  if (!sameProject(task, parent)) {
    throw new Error("Parent task must belong to the same project");
  }

  if (parentCreatesCycle(task._uuid, parentTaskId, allTasks)) {
    throw new Error("A task cannot be placed under one of its own subtasks");
  }
}

/** @deprecated Use validateAssignParent */
export function validateMoveToSubtask(
  task: Task,
  parentTaskId: string,
  allTasks: Task[]
): void {
  validateAssignParent(task, parentTaskId, allTasks);
}

export function canMoveTaskToSubtask(task: Task, allTasks: Task[]): boolean {
  if (task.parent_task_id) return false;
  return listParentTaskCandidates(allTasks, task).length > 0;
}

export function canReparentSubtask(task: Task, allTasks: Task[]): boolean {
  if (!task.parent_task_id) return false;
  return listParentTaskCandidates(allTasks, task, {
    excludeParentId: task.parent_task_id,
  }).length > 0;
}

export function subtaskTreePrefix(
  task: Task,
  visibleTasks: Task[]
): string {
  const siblings = visibleTasks.filter(
    (row) => row.parent_task_id && row.parent_task_id === task.parent_task_id
  );
  const index = siblings.findIndex((row) => row._uuid === task._uuid);
  if (index < 0) return "├─ ";
  return index === siblings.length - 1 ? "└─ " : "├─ ";
}

/**
 * Main tasks in display order (sorted by task_number / id ascending).
 */
export function getMainTasksInOrder(
  allTasks: Task[],
  projectId?: string | null
): Task[] {
  return allTasks
    .filter(
      (row) =>
        !row.parent_task_id &&
        (projectId == null || !row.project_id || row.project_id === projectId)
    )
    .sort((a, b) => a.id - b.id || a._uuid.localeCompare(b._uuid));
}

/**
 * Visible WBS task id. Main tasks are numbered 1, 2, 3… sequentially in
 * project order; subtasks are parent.1, parent.2, … in sibling order.
 */
export function taskDisplayId(
  task: Task,
  allTasks: Task[],
  seen: Set<string> = new Set()
): string {
  if (!task.parent_task_id || seen.has(task._uuid)) {
    if (allTasks.length > 0 && !task.parent_task_id) {
      const mains = getMainTasksInOrder(allTasks, task.project_id);
      const mainIndex = mains.findIndex((row) => row._uuid === task._uuid);
      if (mainIndex >= 0) {
        return String(mainIndex + 1);
      }
    }
    return String(task.id);
  }

  seen.add(task._uuid);
  const parent = allTasks.find((row) => row._uuid === task.parent_task_id);
  const parentLabel = parent
    ? taskDisplayId(parent, allTasks, seen)
    : String(task.id);
  const siblings = getSubtasksForParent(allTasks, task.parent_task_id);
  const index = siblings.findIndex((row) => row._uuid === task._uuid);
  const position = index >= 0 ? index + 1 : siblings.length + 1;
  return `${parentLabel}.${position}`;
}

export function taskHierarchyLabel(task: Task, allTasks: Task[] = []): string {
  const title = (task.Issue ?? "").trim() || "Untitled";
  const id =
    allTasks.length > 0 ? taskDisplayId(task, allTasks) : String(task.id);
  return `#${id} — ${title}`;
}
