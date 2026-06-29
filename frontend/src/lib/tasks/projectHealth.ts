import type { ProjectTaskStats } from "@/lib/tasks/projectStats";

export type ProjectHealthStatus =
  | "healthy"
  | "at_risk"
  | "needs_attention"
  | "critical";

export type ProjectHealth = {
  score: number;
  status: ProjectHealthStatus;
  label: string;
  icon: string;
  tooltip: string;
};

export const PROJECT_HEALTH_TOOLTIP =
  "Score out of 100 from completion (50%), on-schedule open tasks (35%), and recent activity in the last 60 minutes (15%). Main tasks only.";

function clampScore(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

function healthFromScore(score: number): Pick<ProjectHealth, "status" | "label" | "icon"> {
  if (score >= 80) {
    return { status: "healthy", label: "Healthy", icon: "🟢" };
  }
  if (score >= 60) {
    return { status: "at_risk", label: "At Risk", icon: "🟡" };
  }
  if (score >= 40) {
    return { status: "needs_attention", label: "Needs Attention", icon: "🟠" };
  }
  return { status: "critical", label: "Critical", icon: "🔴" };
}

/** Derive a 0–100 project health score from dashboard stats. */
export function computeProjectHealth(stats: ProjectTaskStats): ProjectHealth {
  if (stats.total === 0) {
    return {
      score: 100,
      ...healthFromScore(100),
      tooltip: PROJECT_HEALTH_TOOLTIP,
    };
  }

  const completionScore = stats.progressPercent;
  const onScheduleScore =
    stats.open === 0
      ? 100
      : Math.round((1 - stats.overdue / stats.open) * 100);
  const momentumScore = Math.min(100, stats.recentUpdates * 25);

  const score = clampScore(
    completionScore * 0.5 +
      onScheduleScore * 0.35 +
      momentumScore * 0.15
  );

  return {
    score,
    ...healthFromScore(score),
    tooltip: PROJECT_HEALTH_TOOLTIP,
  };
}

export function projectHealthBadgeClass(status: ProjectHealthStatus): string {
  switch (status) {
    case "healthy":
      return "border-green-200 bg-green-50 text-green-900";
    case "at_risk":
      return "border-amber-200 bg-amber-50 text-amber-950";
    case "needs_attention":
      return "border-orange-200 bg-orange-50 text-orange-950";
    case "critical":
      return "border-red-200 bg-red-50 text-red-950";
  }
}

export function projectHealthScoreClass(status: ProjectHealthStatus): string {
  switch (status) {
    case "healthy":
      return "text-green-800";
    case "at_risk":
      return "text-amber-800";
    case "needs_attention":
      return "text-orange-800";
    case "critical":
      return "text-red-800";
  }
}
