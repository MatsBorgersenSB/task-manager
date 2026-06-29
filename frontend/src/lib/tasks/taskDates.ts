import type { Task } from "@/lib/tasks/types";

export function taskDateValue(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isTaskComplete(
  task: Pick<Task, "status" | "Date Completed">
): boolean {
  if ((task.status ?? "").trim() === "Complete") return true;
  return Boolean(task["Date Completed"]?.trim());
}

/** Task due-date intelligence: completed, overdue, due soon, normal, or none. */
export type TaskDueStatus =
  | "completed"
  | "overdue"
  | "soon"
  | "normal"
  | "none";

/** @deprecated Use TaskDueStatus */
export type DueStatus = Exclude<TaskDueStatus, "completed">;

/** Labels for table and calendar legends. */
export const DUE_STATUS_LEGEND = [
  { icon: "🔴", label: "Overdue" },
  { icon: "🟡", label: "Due Soon" },
  { icon: "🟢", label: "Completed" },
  { icon: "🔵", label: "Planned" },
] as const;

function parseLocalDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map((part) =>
    Number.parseInt(part, 10)
  );
  return new Date(year, month - 1, day);
}

function diffDaysFromToday(dueDate: string): number | null {
  const normalized = taskDateValue(dueDate);
  if (!normalized) return null;

  const parts = normalized.split("-").map((part) => Number.parseInt(part, 10));
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
    return null;
  }

  const today = new Date();
  const due = new Date(parts[0], parts[1] - 1, parts[2]);
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
}

/** Due-date status for an open task (ignores completion). */
export function getDueDateStatus(
  dueDate: string | null | undefined
): Exclude<TaskDueStatus, "completed"> {
  const diffDays = dueDate ? diffDaysFromToday(dueDate) : null;
  if (diffDays == null) return "none";
  if (diffDays < 0) return "overdue";
  if (diffDays <= 3) return "soon";
  return "normal";
}

/** Full task due intelligence including completed state. */
export function getTaskDueStatus(
  task: Pick<Task, "status" | "Date Due" | "Date Completed">
): TaskDueStatus {
  if (isTaskComplete(task)) return "completed";
  return getDueDateStatus(task["Date Due"]);
}

/** @deprecated Use getTaskDueStatus(task) or getDueDateStatus(dueDate). */
export function getDueStatus(
  dueDate: string | null | undefined
): Exclude<TaskDueStatus, "completed"> {
  return getDueDateStatus(dueDate);
}

/** True when due date is today through `days` days ahead (inclusive). */
export function isDueWithinNextDays(
  dueDate: string | null | undefined,
  days = 7,
  reference = new Date()
): boolean {
  const normalized = taskDateValue(dueDate);
  if (!normalized) return false;

  const due = parseLocalDate(normalized);
  const today = new Date(reference);
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);

  const diffDays = (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= days;
}

/** @deprecated Use isDueWithinNextDays(dueDate, 7). */
export function isDueThisWeek(
  dueDate: string | null | undefined,
  reference = new Date()
): boolean {
  return isDueWithinNextDays(dueDate, 7, reference);
}

const DUE_STATUS_BADGE_BASE =
  "inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium whitespace-nowrap";

/** Tailwind classes for due-date status in table cells. */
export function dueStatusClassName(status: TaskDueStatus): string {
  switch (status) {
    case "completed":
      return `${DUE_STATUS_BADGE_BASE} border border-green-200 bg-green-100 text-green-950`;
    case "overdue":
      return `${DUE_STATUS_BADGE_BASE} border border-red-200 bg-red-100 text-red-950`;
    case "soon":
      return `${DUE_STATUS_BADGE_BASE} border border-amber-200 bg-amber-100 text-amber-950`;
    case "normal":
      return `${DUE_STATUS_BADGE_BASE} border border-blue-200 bg-blue-100 text-blue-950`;
    default:
      return "";
  }
}

/** Emoji prefix for due-date status in table and calendar. */
export function dueStatusIcon(status: TaskDueStatus): string {
  if (status === "completed") return "🟢 ";
  if (status === "overdue") return "🔴 ";
  if (status === "soon") return "🟡 ";
  if (status === "normal") return "🔵 ";
  return "";
}

/** CSS class names for react-big-calendar events (see globals.css). */
export function dueStatusCalendarClass(status: TaskDueStatus): string {
  switch (status) {
    case "completed":
      return "due-completed";
    case "overdue":
      return "due-overdue";
    case "soon":
      return "due-soon";
    case "normal":
      return "due-planned";
    default:
      return "";
  }
}

/** Progress bar fill color by completion percentage. */
export function progressBarColorClass(percent: number): string {
  if (percent <= 25) return "bg-red-500";
  if (percent <= 75) return "bg-yellow-500";
  return "bg-green-500";
}

export const PROGRESS_BAR_SEGMENTS = 28;

export function progressBarBlocks(percent: number): string {
  const filled = Math.round((percent / 100) * PROGRESS_BAR_SEGMENTS);
  const clamped = Math.min(PROGRESS_BAR_SEGMENTS, Math.max(0, filled));
  return `${"█".repeat(clamped)}${"░".repeat(PROGRESS_BAR_SEGMENTS - clamped)}`;
}

/** Optional table row tint based on due status or recent activity. */
export function taskRowHighlightClass(
  task: Pick<Task, "status" | "Date Due" | "Date Completed">,
  isRecentlyUpdated: boolean
): string {
  if (isRecentlyUpdated) return "bg-sky-50/90 hover:bg-sky-100";
  const status = getTaskDueStatus(task);
  if (status === "overdue") return "bg-red-50/80 hover:bg-red-100";
  if (status === "soon") return "bg-amber-50/80 hover:bg-amber-100";
  return "";
}
