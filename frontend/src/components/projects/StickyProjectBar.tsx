"use client";

import type { ProjectTaskStats } from "@/lib/tasks/projectStats";
import {
  computeProjectHealthFromStats,
  projectHealthBadgeClass,
} from "@/lib/tasks/projectHealth";
import type { Project } from "@/lib/projects/types";

type StickyProjectBarProps = {
  project: Project;
  stats: ProjectTaskStats;
  loading?: boolean;
  viewToggle?: React.ReactNode;
};

export default function StickyProjectBar({
  project,
  stats,
  loading = false,
  viewToggle,
}: StickyProjectBarProps) {
  const health = computeProjectHealthFromStats(stats, {
    isShared: project.is_shared,
    daysSinceActivity: null,
  });
  const badgeClass = projectHealthBadgeClass(health.status);

  return (
    <div className="no-print sticky top-14 z-30 -mx-1 mb-2 border-b border-border bg-white/95 px-3 py-1.5 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/90">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <h2 className="truncate text-sm font-bold text-primary">
            {project.name}
          </h2>
          <span
            className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium ${badgeClass}`}
            title={health.tooltip}
          >
            <span aria-hidden>{health.icon}</span>
            {loading ? "…" : `${health.score}`}
          </span>
          {project.is_shared ? (
            <span className="text-[10px] font-medium text-green-700">Shared</span>
          ) : (
            <span className="text-[10px] font-medium text-amber-700">Not shared</span>
          )}
        </div>
        {viewToggle ? (
          <div className="flex shrink-0 items-center gap-2">{viewToggle}</div>
        ) : null}
      </div>
    </div>
  );
}
