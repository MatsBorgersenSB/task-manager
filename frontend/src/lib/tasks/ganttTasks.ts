import { formatAreaCodeOnly } from "@/lib/tasks/areas";
import { ganttSubtaskNamePrefix } from "@/lib/tasks/hierarchyDisplay";
import { getTaskDueStatus, type TaskDueStatus } from "@/lib/tasks/taskDates";
import {
  getSubtasksForParent,
  isSubtaskComplete,
} from "@/lib/tasks/subtasks";
import type { Task } from "@/lib/tasks/types";
import { normalizeDateInput } from "@/lib/tasks/utils";
import type { Task as GanttTask } from "gantt-task-react";

export type TaskGanttColors = {
  backgroundColor: string;
  backgroundSelectedColor: string;
  progressColor: string;
  progressSelectedColor: string;
};

const GANTT_COLORS: Record<
  Exclude<TaskDueStatus, "none">,
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
  if (status === "none") return GANTT_COLORS.normal;
  return GANTT_COLORS[status];
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

export function ganttStartDate(task: Task): Date {
  return (
    parseGanttDate(task["Intervention Date"] ?? task.intervention_date) ??
    parseGanttDate(task["Date Due"]) ??
    parseGanttDate(task._createdAt) ??
    startOfToday()
  );
}

export function ganttEndDate(task: Task, start: Date): Date {
  const end =
    parseGanttDate(task["Date Completed"]) ??
    parseGanttDate(task["Date Due"]) ??
    addDays(start, 1);

  if (end.getTime() < start.getTime()) {
    return addDays(start, 1);
  }

  return end;
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
    type?: "task" | "project";
  } = {}
): { row: GanttTask; start: Date; end: Date } {
  const start = ganttStartDate(task);
  const end = ganttEndDate(task, start);
  const issue = (task.Issue ?? "").trim() || `Task #${task.id}`;
  const complete = getTaskDueStatus(task) === "completed";

  return {
    start,
    end,
    row: {
      id: task._uuid,
      type: options.type ?? "task",
      name: `${options.namePrefix ?? ""}${issue}`,
      start,
      end,
      progress:
        options.type === "project"
          ? 0
          : complete
            ? 100
            : 0,
      project: options.projectId,
      hideChildren: options.type === "project" ? false : undefined,
      styles: options.type === "project" ? GROUP_PROJECT_STYLES : getTaskColor(task),
    },
  };
}

export type GanttTaskBuildResult = {
  ganttTasks: GanttTask[];
  taskById: Map<string, Task>;
};

export function buildGanttTasks(tasks: Task[]): GanttTaskBuildResult {
  const taskById = new Map<string, Task>();
  if (tasks.length === 0) {
    return { ganttTasks: [], taskById };
  }

  const taskIds = new Set(tasks.map((task) => task._uuid));
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
    const subtasks = getSubtasksForParent(tasks, main._uuid).sort(
      compareTasksForGantt
    );

    if (subtasks.length === 0) {
      const { row } = toGanttTaskRow(main, {
        namePrefix: areaPrefix(main),
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
    ganttTasks.push({
      id: `group-${main._uuid}`,
      type: "project",
      name: `${areaPrefix(main)}${mainIssue}`,
      start: groupStart ?? startOfToday(),
      end: groupEnd ?? addDays(startOfToday(), 1),
      progress: subtaskGroupProgress(subtasks),
      hideChildren: false,
      styles: GROUP_PROJECT_STYLES,
    });

    for (const subtask of subtasks) {
      const { row } = toGanttTaskRow(subtask, {
        projectId: `group-${main._uuid}`,
        namePrefix: ganttSubtaskNamePrefix(subtask, subtasks),
      });
      ganttTasks.push(row);
    }
  }

  for (const subtask of orphanSubtasks) {
    taskById.set(subtask._uuid, subtask);
    const { row } = toGanttTaskRow(subtask, {
      namePrefix: areaPrefix(subtask),
    });
    ganttTasks.push(row);
  }

  return { ganttTasks, taskById };
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
