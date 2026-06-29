import type { ProjectTaskStats } from "@/lib/tasks/projectStats";

export type ProjectHealthStatus =
  | "excellent"
  | "healthy"
  | "attention"
  | "at_risk";

export type ProjectHealthInput = ProjectTaskStats & {
  isShared: boolean;
  /** Days since any project/task activity; null when unknown. */
  daysSinceActivity: number | null;
};

export type ProjectHealth = {
  score: number;
  status: ProjectHealthStatus;
  label: string;
  icon: string;
  tooltip: string;
};

export const PROJECT_HEALTH_TOOLTIP =
  "Starts at 100. Overdue tasks −10 each, due soon −2 each, no activity in 14 days −10, not shared −5. Completed tasks +1 each (max 100).";

function clampScore(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

function healthFromScore(score: number): Pick<ProjectHealth, "status" | "label" | "icon"> {
  if (score >= 90) {
    return { status: "excellent", label: "Excellent", icon: "🟢" };
  }
  if (score >= 75) {
    return { status: "healthy", label: "Healthy", icon: "🟢" };
  }
  if (score >= 50) {
    return { status: "attention", label: "Attention Needed", icon: "🟡" };
  }
  return { status: "at_risk", label: "At Risk", icon: "🔴" };
}

/** Derive a 0–100 project health score from dashboard stats and sharing state. */
export function computeProjectHealth(input: ProjectHealthInput): ProjectHealth {
  if (input.total === 0) {
    let score = 100;
    if (!input.isShared) score -= 5;
    score = clampScore(score);
    return {
      score,
      ...healthFromScore(score),
      tooltip: PROJECT_HEALTH_TOOLTIP,
    };
  }

  let score = 100;
  score -= input.overdue * 10;
  score -= input.dueSoon * 2;

  if (input.daysSinceActivity != null && input.daysSinceActivity >= 14) {
    score -= 10;
  }

  if (!input.isShared) {
    score -= 5;
  }

  score += input.completed;
  score = clampScore(score);

  return {
    score,
    ...healthFromScore(score),
    tooltip: PROJECT_HEALTH_TOOLTIP,
  };
}

/** @deprecated Pass full ProjectHealthInput including isShared and daysSinceActivity. */
export function computeProjectHealthFromStats(
  stats: ProjectTaskStats,
  options?: { isShared?: boolean; daysSinceActivity?: number | null }
): ProjectHealth {
  return computeProjectHealth({
    ...stats,
    isShared: options?.isShared ?? true,
    daysSinceActivity: options?.daysSinceActivity ?? null,
  });
}

export function projectHealthBadgeClass(status: ProjectHealthStatus): string {
  switch (status) {
    case "excellent":
    case "healthy":
      return "border-green-200 bg-green-50 text-green-900";
    case "attention":
      return "border-amber-200 bg-amber-50 text-amber-950";
    case "at_risk":
      return "border-red-200 bg-red-50 text-red-950";
  }
}

export function projectHealthScoreClass(status: ProjectHealthStatus): string {
  switch (status) {
    case "excellent":
    case "healthy":
      return "text-green-800";
    case "attention":
      return "text-amber-800";
    case "at_risk":
      return "text-red-800";
  }
}
