import { isTaskComplete } from "@/lib/tasks/taskDates";
import type { Task } from "@/lib/tasks/types";
import { parseSbOwners } from "@/lib/tasks/utils";
import type { ProjectTemplateTask } from "@/lib/templates/types";

export type OwnerWorkloadRow = {
  owner: string;
  openTasks: number;
  completedTasks: number;
  interventionHours: number;
};

export type AreaReadinessRow = {
  area: string;
  completed: number;
  total: number;
  percent: number;
};

/**
 * Aggregates open/completed task counts and planned intervention_hours per
 * SB Owner (falling back to Responsible when SB Owner is absent in client mode).
 */
export function computeOwnerWorkload(tasks: Task[]): OwnerWorkloadRow[] {
  const map = new Map<
    string,
    { openTasks: number; completedTasks: number; interventionHours: number }
  >();

  for (const task of tasks) {
    const sbOwners = parseSbOwners(task["SB Owner"]);
    const owners =
      sbOwners.length > 0
        ? sbOwners
        : task.Responsible?.trim()
          ? [task.Responsible.trim()]
          : ["Unassigned"];

    const done = isTaskComplete(task);
    const hours =
      !done &&
      typeof task.intervention_hours === "number" &&
      Number.isFinite(task.intervention_hours) &&
      task.intervention_hours > 0
        ? task.intervention_hours
        : 0;

    for (const owner of owners) {
      const entry = map.get(owner) ?? {
        openTasks: 0,
        completedTasks: 0,
        interventionHours: 0,
      };
      if (done) {
        entry.completedTasks += 1;
      } else {
        entry.openTasks += 1;
        entry.interventionHours += hours;
      }
      map.set(owner, entry);
    }
  }

  return [...map.entries()]
    .map(([owner, stats]) => ({
      owner,
      ...stats,
      interventionHours: Math.round(stats.interventionHours * 10) / 10,
    }))
    .sort(
      (a, b) =>
        b.interventionHours - a.interventionHours ||
        b.openTasks - a.openTasks ||
        a.owner.localeCompare(b.owner)
    );
}

/**
 * Computes completion readiness across all work items (both main tasks and subtasks)
 * grouped by Area.
 */
export function computeAreaReadiness(tasks: Task[]): AreaReadinessRow[] {
  const map = new Map<string, { completed: number; total: number }>();

  for (const task of tasks) {
    const area =
      (task.areaName ?? task.areaCode ?? "General").trim() || "General";
    const entry = map.get(area) ?? { completed: 0, total: 0 };
    entry.total += 1;
    if (isTaskComplete(task)) {
      entry.completed += 1;
    }
    map.set(area, entry);
  }

  return [...map.entries()]
    .map(([area, { completed, total }]) => ({
      area,
      completed,
      total,
      percent: total > 0 ? Math.round((completed / total) * 100) : 0,
    }))
    .sort((a, b) => a.area.localeCompare(b.area));
}

/**
 * Compares active project tasks against a template's task definitions and returns
 * template tasks whose titles do not yet exist in the project.
 */
export function computeTemplateDrift(
  projectTasks: Task[],
  templateTasks: ProjectTemplateTask[]
): ProjectTemplateTask[] {
  const existingTitles = new Set(
    projectTasks
      .map((t) => (t.Issue ?? "").trim().toLowerCase())
      .filter(Boolean)
  );

  return templateTasks.filter((tt) => {
    const normalized = (tt.title ?? "").trim().toLowerCase();
    return normalized.length > 0 && !existingTitles.has(normalized);
  });
}
