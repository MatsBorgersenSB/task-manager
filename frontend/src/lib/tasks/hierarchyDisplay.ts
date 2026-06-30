import type { Task } from "@/lib/tasks/types";
import { subtaskTreePrefix } from "@/lib/tasks/subtasks";

/** Strip leading #123 — for display in sentences. */
export function hierarchyShortName(label: string): string {
  return label.replace(/^#\d+\s*—\s*/, "").trim() || label;
}

export function isMainTask(task: Task): boolean {
  return !task.parent_task_id;
}

export function taskDisplayTitle(task: Task): string {
  return (task.Issue ?? "").trim() || `Task #${task.id}`;
}

export function subtaskIndentClass(isMain: boolean): string {
  return isMain ? "" : "border-l-2 border-slate-200/80 pl-3 ml-1";
}

export function subtaskTreeMarker(
  task: Task,
  visibleTasks: Task[]
): string | null {
  if (isMainTask(task)) return null;
  return subtaskTreePrefix(task, visibleTasks);
}

export function milestoneBadgeClass(): string {
  return "ml-1.5 inline-flex shrink-0 items-center rounded border border-amber-300/80 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800";
}

export function calendarEventTitle(
  task: Task,
  baseTitle: string,
  dueIcon: string
): string {
  const milestone = task.is_milestone ? "◆ " : "";
  if (isMainTask(task)) {
    return `${dueIcon}${milestone}${baseTitle}`;
  }
  return `${dueIcon}${milestone}↳ ${baseTitle}`;
}

export function ganttSubtaskNamePrefix(
  task: Task,
  visibleSubtasks: Task[]
): string {
  if (isMainTask(task)) return "";
  const prefix = subtaskTreePrefix(task, visibleSubtasks);
  return `  ${prefix}`;
}

export function mainTaskTitleClass(): string {
  return "font-bold text-primary";
}

export function subtaskTitleClass(): string {
  return "font-medium text-primary/85";
}
