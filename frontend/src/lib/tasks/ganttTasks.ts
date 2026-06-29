import { formatAreaCodeOnly } from "@/lib/tasks/areas";
import { getTaskDueStatus, type TaskDueStatus } from "@/lib/tasks/taskDates";
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

const AREA_PROJECT_STYLES: TaskGanttColors = {
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

function areaKey(task: Task): string {
  return (task.areaCode ?? "").trim() || "__none__";
}

function areaLabel(task: Task): string {
  const code = formatAreaCodeOnly(task.areaCode);
  return code || "No Area";
}

function compareTasksForGantt(a: Task, b: Task): number {
  const areaCompare = areaKey(a).localeCompare(areaKey(b));
  if (areaCompare !== 0) return areaCompare;

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

export type GanttTaskBuildResult = {
  ganttTasks: GanttTask[];
  taskById: Map<string, Task>;
};

export function buildGanttTasks(tasks: Task[]): GanttTaskBuildResult {
  const taskById = new Map<string, Task>();
  if (tasks.length === 0) {
    return { ganttTasks: [], taskById };
  }

  const sorted = [...tasks].sort(compareTasksForGantt);
  const groups = new Map<string, Task[]>();

  for (const task of sorted) {
    const key = areaKey(task);
    const bucket = groups.get(key);
    if (bucket) bucket.push(task);
    else groups.set(key, [task]);
  }

  const ganttTasks: GanttTask[] = [];

  for (const [, areaTasks] of groups) {
    const sample = areaTasks[0]!;
    const areaId = `area-${areaKey(sample)}`;
    const childRows: GanttTask[] = [];
    let areaStart: Date | null = null;
    let areaEnd: Date | null = null;

    for (const task of areaTasks) {
      const start = ganttStartDate(task);
      const end = ganttEndDate(task, start);
      taskById.set(task._uuid, task);

      if (!areaStart || start < areaStart) areaStart = start;
      if (!areaEnd || end > areaEnd) areaEnd = end;

      const issue = (task.Issue ?? "").trim() || `Task #${task.id}`;
      const complete = getTaskDueStatus(task) === "completed";

      childRows.push({
        id: task._uuid,
        type: "task",
        name: issue,
        start,
        end,
        progress: complete ? 100 : 0,
        project: areaId,
        styles: getTaskColor(task),
      });
    }

    ganttTasks.push({
      id: areaId,
      type: "project",
      name: areaLabel(sample),
      start: areaStart ?? startOfToday(),
      end: areaEnd ?? addDays(startOfToday(), 1),
      progress: 0,
      hideChildren: false,
      styles: AREA_PROJECT_STYLES,
    });
    ganttTasks.push(...childRows);
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
