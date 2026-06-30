import type { Project } from "@/lib/projects/types";
import { computeProjectHealth } from "@/lib/tasks/projectHealth";
import { computeProjectTaskStats } from "@/lib/tasks/projectStats";
import type { Task } from "@/lib/tasks/types";
import {
  getTaskDueStatus,
  isDueWithinNextDays,
  isTaskComplete,
  taskDateValue,
  todayIso,
} from "@/lib/tasks/taskDates";

export const ATTENTION_WEIGHTS = {
  overdue: 3,
  dueWithin24Hours: 2,
  unansweredComments: 3,
  projectHealthBelow70: 2,
  blockedTasks: 3,
} as const;

export const PROJECT_HEALTH_RISK_THRESHOLD = 70;
export const PROJECT_OVERDUE_RISK_THRESHOLD = 3;
export const PROJECT_WAITING_RISK_THRESHOLD = 2;

export type WeightedAttentionBreakdown = {
  overdue: number;
  dueWithin24Hours: number;
  unansweredComments: number;
  blockedTasks: number;
  projectsAtRisk: number;
  /** Sum of actionable item counts (for card display). */
  totalCount: number;
  /** Weighted score for prioritization. */
  weightedScore: number;
};

export function isTaskBlocked(task: Task): boolean {
  if (isTaskComplete(task)) return false;
  const priority = (task.Priority ?? "").trim().toLowerCase();
  const sbPriority = (task["SB Priority"] ?? "").trim().toLowerCase();
  const risk = (task.Risk ?? "").trim().toUpperCase();
  return (
    priority === "critical" ||
    sbPriority === "urgent" ||
    risk === "HH" ||
    risk === "H"
  );
}

export function isDueToday(
  dueDate: string | null | undefined,
  reference = new Date()
): boolean {
  const normalized = taskDateValue(dueDate);
  if (!normalized) return false;
  return normalized === todayIso();
}

export function countOverdueTasks(tasks: Task[]): number {
  return tasks.filter(
    (task) => !task.parent_task_id && !isTaskComplete(task) && getTaskDueStatus(task) === "overdue"
  ).length;
}

export function countDueWithin24Hours(tasks: Task[]): number {
  return tasks.filter(
    (task) =>
      !task.parent_task_id &&
      !isTaskComplete(task) &&
      isDueWithinNextDays(task["Date Due"], 1)
  ).length;
}

export function countBlockedTasks(tasks: Task[]): number {
  return tasks.filter((task) => !task.parent_task_id && isTaskBlocked(task)).length;
}

export function countWaitingTasks(
  tasks: Task[],
  waitingTaskIds: Set<string>
): number {
  return tasks.filter(
    (task) =>
      !task.parent_task_id &&
      !isTaskComplete(task) &&
      waitingTaskIds.has(task._uuid)
  ).length;
}

export function computeWeightedAttention(input: {
  tasks: Task[];
  waitingTaskIds: Set<string>;
  projectsAtRisk: number;
}): WeightedAttentionBreakdown {
  const mainTasks = input.tasks.filter((task) => !task.parent_task_id);
  const overdue = countOverdueTasks(mainTasks);
  const dueWithin24Hours = countDueWithin24Hours(mainTasks);
  const unansweredComments = countWaitingTasks(mainTasks, input.waitingTaskIds);
  const blockedTasks = countBlockedTasks(mainTasks);
  const projectsAtRisk = input.projectsAtRisk;

  const weightedScore =
    overdue * ATTENTION_WEIGHTS.overdue +
    dueWithin24Hours * ATTENTION_WEIGHTS.dueWithin24Hours +
    unansweredComments * ATTENTION_WEIGHTS.unansweredComments +
    projectsAtRisk * ATTENTION_WEIGHTS.projectHealthBelow70 +
    blockedTasks * ATTENTION_WEIGHTS.blockedTasks;

  const totalCount =
    overdue + dueWithin24Hours + unansweredComments + blockedTasks;

  return {
    overdue,
    dueWithin24Hours,
    unansweredComments,
    blockedTasks,
    projectsAtRisk,
    totalCount,
    weightedScore,
  };
}

export function attentionCountColorClass(total: number): {
  card: string;
  value: string;
  ring: string;
} {
  if (total === 0) {
    return {
      card: "border-green-200 bg-green-50 hover:bg-green-100/80",
      value: "text-green-900",
      ring: "ring-green-400",
    };
  }
  if (total <= 4) {
    return {
      card: "border-amber-200 bg-amber-50 hover:bg-amber-100/80",
      value: "text-amber-900",
      ring: "ring-amber-400",
    };
  }
  return {
    card: "border-red-200 bg-red-50 hover:bg-red-100/80",
    value: "text-red-900",
    ring: "ring-red-400",
  };
}

export type ProjectRiskSummary = {
  projectId: string;
  projectName: string;
  healthScore: number;
  overdueCount: number;
  waitingCount: number;
  reasons: string[];
};

export function computeProjectsAtRisk(input: {
  projects: Project[];
  tasksByProject: Map<string, Task[]>;
  waitingTaskIds: Set<string>;
}): ProjectRiskSummary[] {
  const atRisk: ProjectRiskSummary[] = [];

  for (const project of input.projects) {
    const tasks = input.tasksByProject.get(project.id) ?? [];
    const mainTasks = tasks.filter((task) => !task.parent_task_id);
    const stats = computeProjectTaskStats(tasks);
    const health = computeProjectHealth({
      ...stats,
      isShared: project.is_shared,
      daysSinceActivity: null,
    });
    const overdueCount = countOverdueTasks(mainTasks);
    const waitingCount = countWaitingTasks(mainTasks, input.waitingTaskIds);

    const reasons: string[] = [];
    if (health.score < PROJECT_HEALTH_RISK_THRESHOLD) {
      reasons.push(`Health ${health.score}/100`);
    }
    if (overdueCount >= PROJECT_OVERDUE_RISK_THRESHOLD) {
      reasons.push(`${overdueCount} overdue`);
    }
    if (waitingCount >= PROJECT_WAITING_RISK_THRESHOLD) {
      reasons.push(`${waitingCount} waiting`);
    }

    if (reasons.length === 0) continue;

    atRisk.push({
      projectId: project.id,
      projectName: project.name,
      healthScore: health.score,
      overdueCount,
      waitingCount,
      reasons,
    });
  }

  return atRisk.sort((a, b) => a.healthScore - b.healthScore);
}
