import { formatAreaCodeOnly } from "@/lib/tasks/areas";
import {
  formatGanttDependencySuffix,
  getEffectivePredecessors,
} from "@/lib/tasks/dependencies";
import { ganttSubtaskNamePrefix } from "@/lib/tasks/hierarchyDisplay";
import { getTaskDueStatus, type TaskDueStatus } from "@/lib/tasks/taskDates";
import {
  getDescendantTasks,
  isSubtaskComplete,
} from "@/lib/tasks/subtasks";
import type { Task } from "@/lib/tasks/types";
import { normalizeDateInput } from "@/lib/tasks/utils";
import type { TaskDependency } from "@/lib/templates/types";
import type { Task as GanttTask } from "gantt-task-react";

export type TaskGanttColors = {
  backgroundColor: string;
  backgroundSelectedColor: string;
  progressColor: string;
  progressSelectedColor: string;
};

const GANTT_COLORS: Record<
  Exclude<TaskDueStatus, "none"> | "critical",
  TaskGanttColors
> = {
  completed: {
    backgroundColor: "#16a34a",
    backgroundSelectedColor: "#15803d",
    progressColor: "#15803d",
    progressSelectedColor: "#166534",
  },
  overdue: {
    backgroundColor: "#dc2626",
    backgroundSelectedColor: "#b91c1c",
    progressColor: "#b91c1c",
    progressSelectedColor: "#991b1b",
  },
  soon: {
    backgroundColor: "#facc15",
    backgroundSelectedColor: "#ca8a04",
    progressColor: "#eab308",
    progressSelectedColor: "#a16207",
  },
  normal: {
    backgroundColor: "#2563eb",
    backgroundSelectedColor: "#1d4ed8",
    progressColor: "#1d4ed8",
    progressSelectedColor: "#1e40af",
  },
  critical: {
    backgroundColor: "#7c3aed",
    backgroundSelectedColor: "#6d28d9",
    progressColor: "#6d28d9",
    progressSelectedColor: "#5b21b6",
  },
};

const MILESTONE_STYLES: TaskGanttColors = {
  backgroundColor: "#d97706",
  backgroundSelectedColor: "#b45309",
  progressColor: "#b45309",
  progressSelectedColor: "#92400e",
};

const GROUP_PROJECT_STYLES: TaskGanttColors = {
  backgroundColor: "#64748b",
  backgroundSelectedColor: "#475569",
  progressColor: "#475569",
  progressSelectedColor: "#334155",
};

/** Gantt bar colors aligned with dashboard and calendar due-date rules. */
export function getTaskColor(task: Task): TaskGanttColors {
  const status = getTaskDueStatus(task);
  if (status === "completed") return GANTT_COLORS.completed;
  if (status === "overdue") return GANTT_COLORS.overdue;
  if (isCriticalTask(task)) return GANTT_COLORS.critical;
  if (status === "soon") return GANTT_COLORS.soon;
  if (status === "normal") return GANTT_COLORS.normal;
  return GANTT_COLORS.normal;
}

function isCriticalTask(task: Task): boolean {
  return (
    Boolean(task.is_critical) ||
    (task.Priority ?? "").trim().toLowerCase() === "critical"
  );
}

function parseGanttDate(value: string | null | undefined): Date | null {
  const normalized = normalizeDateInput(value);
  if (!normalized) return null;

  const parts = normalized.split("-").map((part) => Number.parseInt(part, 10));
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
    return null;
  }

  const [year, month, day] = parts;
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function startOfToday(): Date {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return today;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function areaPrefix(task: Task): string {
  const code = formatAreaCodeOnly(task.areaCode);
  return code ? `${code} · ` : "";
}

function compareTasksForGantt(a: Task, b: Task): number {
  const areaA = (a.areaCode ?? "").trim() || "zzz";
  const areaB = (b.areaCode ?? "").trim() || "zzz";
  if (areaA !== areaB) return areaA.localeCompare(areaB);

  const dueA = normalizeDateInput(a["Date Due"]) || "9999-12-31";
  const dueB = normalizeDateInput(b["Date Due"]) || "9999-12-31";
  if (dueA !== dueB) return dueA.localeCompare(dueB);

  return a.id - b.id;
}

/** Schedule start (Gantt From) — prefers From Date, then To Date. */
export function ganttStartDate(task: Task): Date {
  return (
    parseGanttDate(task["Intervention Date"] ?? task.intervention_date) ??
    parseGanttDate(task["Date Due"]) ??
    parseGanttDate(task._createdAt) ??
    startOfToday()
  );
}

/** Schedule end (Gantt To) — prefers To Date; never uses Date Completed. */
export function ganttEndDate(task: Task, start: Date): Date {
  const end = parseGanttDate(task["Date Due"]) ?? addDays(start, 1);

  if (end.getTime() <= start.getTime()) {
    return addDays(start, 1);
  }

  return end;
}

/** Format a Date as YYYY-MM-DD in local time for task date fields. */
export function formatGanttDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function subtaskGroupProgress(subtasks: Task[]): number {
  if (subtasks.length === 0) return 0;
  const completed = subtasks.filter(isSubtaskComplete).length;
  return Math.round((completed / subtasks.length) * 100);
}

function toGanttTaskRow(
  task: Task,
  options: {
    projectId?: string;
    namePrefix?: string;
    nameSuffix?: string;
    dependencies?: string[];
    type?: "task" | "project";
  } = {}
): { row: GanttTask; start: Date; end: Date } {
  const start = ganttStartDate(task);
  const end = ganttEndDate(task, start);
  const issue = (task.Issue ?? "").trim() || `Task #${task.id}`;
  const complete = getTaskDueStatus(task) === "completed";
  const milestonePrefix = task.is_milestone ? "◆ " : "";
  const isMilestone = Boolean(task.is_milestone);
  const barEnd = isMilestone ? start : end;
  const rowType =
    options.type === "project" ? "project" : isMilestone ? "milestone" : "task";

  let styles: TaskGanttColors;
  if (options.type === "project") {
    styles = GROUP_PROJECT_STYLES;
  } else if (isMilestone) {
    styles = MILESTONE_STYLES;
  } else {
    styles = getTaskColor(task);
  }

  return {
    start,
    end: barEnd,
    row: {
      id: task._uuid,
      type: rowType,
      name: `${options.namePrefix ?? ""}${milestonePrefix}${issue}${options.nameSuffix ?? ""}`,
      start,
      end: barEnd,
      progress:
        options.type === "project"
          ? 0
          : complete
            ? 100
            : 0,
      project: options.projectId,
      dependencies:
        options.dependencies && options.dependencies.length > 0
          ? options.dependencies
          : undefined,
      hideChildren: options.type === "project" ? false : undefined,
      styles,
    },
  };
}

export type GanttTaskBuildResult = {
  ganttTasks: GanttTask[];
  taskById: Map<string, Task>;
};

export function buildGanttTasks(
  tasks: Task[],
  dependencies: TaskDependency[] = []
): GanttTaskBuildResult {
  const taskById = new Map<string, Task>();
  if (tasks.length === 0) {
    return { ganttTasks: [], taskById };
  }

  const taskIds = new Set(tasks.map((task) => task._uuid));
  const mainWithSubtasksIds = new Set<string>();
  for (const task of tasks) {
    if (!task.parent_task_id && getDescendantTasks(tasks, task._uuid).length > 0) {
      mainWithSubtasksIds.add(task._uuid);
    }
  }

  const resolveGanttBarId = (taskUuid: string): string =>
    mainWithSubtasksIds.has(taskUuid) ? `group-${taskUuid}` : taskUuid;

  const resolveGanttDependencies = (task: Task): string[] => {
    const effective = getEffectivePredecessors(task, tasks, dependencies);
    return effective
      .map((entry) => entry.predecessor._uuid)
      .filter((predUuid) => taskIds.has(predUuid))
      .map(resolveGanttBarId);
  };

  const mainTasks = tasks
    .filter((task) => !task.parent_task_id)
    .sort(compareTasksForGantt);
  const orphanSubtasks = tasks
    .filter(
      (task) =>
        task.parent_task_id && !taskIds.has(task.parent_task_id)
    )
    .sort(compareTasksForGantt);

  const ganttTasks: GanttTask[] = [];

  for (const main of mainTasks) {
    taskById.set(main._uuid, main);
    taskById.set(`group-${main._uuid}`, main);
    const subtasks = getDescendantTasks(tasks, main._uuid);

    if (subtasks.length === 0) {
      const { row } = toGanttTaskRow(main, {
        namePrefix: areaPrefix(main),
        nameSuffix: formatGanttDependencySuffix(main, tasks, dependencies),
        dependencies: resolveGanttDependencies(main),
      });
      ganttTasks.push(row);
      continue;
    }

    let groupStart: Date | null = null;
    let groupEnd: Date | null = null;

    for (const subtask of subtasks) {
      taskById.set(subtask._uuid, subtask);
      const start = ganttStartDate(subtask);
      const end = ganttEndDate(subtask, start);
      if (!groupStart || start < groupStart) groupStart = start;
      if (!groupEnd || end > groupEnd) groupEnd = end;

      const startMain = ganttStartDate(main);
      const endMain = ganttEndDate(main, startMain);
      if (!groupStart || startMain < groupStart) groupStart = startMain;
      if (!groupEnd || endMain > groupEnd) groupEnd = endMain;
    }

    const mainIssue = (main.Issue ?? "").trim() || `Task #${main.id}`;
    const mainDeps = resolveGanttDependencies(main);
    const mainSuffix = formatGanttDependencySuffix(main, tasks, dependencies);
    ganttTasks.push({
      id: `group-${main._uuid}`,
      type: "project",
      name: `${areaPrefix(main)}${mainIssue}${mainSuffix}`,
      start: groupStart ?? startOfToday(),
      end: groupEnd ?? addDays(startOfToday(), 1),
      progress: subtaskGroupProgress(subtasks),
      dependencies: mainDeps.length > 0 ? mainDeps : undefined,
      hideChildren: false,
      styles: GROUP_PROJECT_STYLES,
    });

    for (const subtask of subtasks) {
      const subDeps = resolveGanttDependencies(subtask);
      const { row } = toGanttTaskRow(subtask, {
        projectId: `group-${main._uuid}`,
        namePrefix: ganttSubtaskNamePrefix(subtask, subtasks, tasks),
        nameSuffix: formatGanttDependencySuffix(subtask, tasks, dependencies),
        dependencies: subDeps,
      });
      ganttTasks.push(row);
    }
  }

  for (const subtask of orphanSubtasks) {
    taskById.set(subtask._uuid, subtask);
    const { row } = toGanttTaskRow(subtask, {
      namePrefix: areaPrefix(subtask),
      nameSuffix: formatGanttDependencySuffix(subtask, tasks, dependencies),
      dependencies: resolveGanttDependencies(subtask),
    });
    ganttTasks.push(row);
  }

  return { ganttTasks, taskById };
}

export const GANTT_NAME_COLUMN_WIDTH = "230px";
export const GANTT_DATE_COLUMN_WIDTH = "88px";
export const GANTT_DAYS_COLUMN_WIDTH = "52px";

export type GanttScheduleEditInput =
  | { type: "start"; startDate: string }
  | { type: "end"; endDate: string }
  | { type: "days"; days: number };

export function ganttTaskDurationDays(
  start: Date,
  end: Date,
  isMilestone = false
): number {
  if (isMilestone) return 0;
  const startMidnight = Date.UTC(
    start.getFullYear(),
    start.getMonth(),
    start.getDate()
  );
  const endMidnight = Date.UTC(
    end.getFullYear(),
    end.getMonth(),
    end.getDate()
  );
  const diffDays = Math.round((endMidnight - startMidnight) / 86_400_000);
  return Math.max(1, diffDays);
}

/**
 * Resolves a new { startDate, endDate } pair (YYYY-MM-DD) when a user edits
 * From date, To date, or Days directly in the Gantt table.
 */
export function resolveGanttScheduleEdit(
  currentStart: Date,
  currentEnd: Date,
  change: GanttScheduleEditInput
): { startDate: string; endDate: string } | null {
  const currentStartIso = formatGanttDateInput(currentStart);
  const currentEndIso = formatGanttDateInput(currentEnd);
  const currentDuration = ganttTaskDurationDays(currentStart, currentEnd);

  if (change.type === "days") {
    const days = Math.round(change.days);
    if (!Number.isFinite(days) || days < 1) return null;
    const nextEnd = addDays(currentStart, days);
    return {
      startDate: currentStartIso,
      endDate: formatGanttDateInput(nextEnd),
    };
  }

  if (change.type === "start") {
    const parsedStart = parseGanttDate(change.startDate);
    if (!parsedStart) return null;
    const nextStartIso = formatGanttDateInput(parsedStart);
    if (nextStartIso < currentEndIso) {
      return {
        startDate: nextStartIso,
        endDate: currentEndIso,
      };
    }
    const preservedEnd = addDays(parsedStart, Math.max(1, currentDuration));
    return {
      startDate: nextStartIso,
      endDate: formatGanttDateInput(preservedEnd),
    };
  }

  const parsedEnd = parseGanttDate(change.endDate);
  if (!parsedEnd) return null;
  const nextEndIso = formatGanttDateInput(parsedEnd);
  if (nextEndIso > currentStartIso) {
    return {
      startDate: currentStartIso,
      endDate: nextEndIso,
    };
  }
  const adjustedStart = addDays(parsedEnd, -1);
  return {
    startDate: formatGanttDateInput(adjustedStart),
    endDate: nextEndIso,
  };
}

export function formatGanttTableDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "2-digit",
  });
}

export function formatGanttTooltipDate(value: string | null | undefined): string {
  const normalized = normalizeDateInput(value);
  if (!normalized) return "—";
  const parsed = parseGanttDate(normalized);
  if (!parsed) return normalized;
  return parsed.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
