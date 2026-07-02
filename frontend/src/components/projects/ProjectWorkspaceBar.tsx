"use client";

import Link from "next/link";
import type { Project } from "@/lib/projects/types";
import type { ProjectTaskStats } from "@/lib/tasks/projectStats";
import ProjectStatusBadge from "@/components/projects/ProjectStatusBadge";
import {
  computeProjectHealthFromStats,
  projectHealthBadgeClass,
} from "@/lib/tasks/projectHealth";
import { ui } from "@/lib/ui/classes";

type ProjectWorkspaceBarProps = {
  project: Project;
  stats: ProjectTaskStats;
  loading?: boolean;
  viewToggle?: React.ReactNode;
  showHomeLink?: boolean;
  embedded?: boolean;
};

export default function ProjectWorkspaceBar({
  project,
  stats,
  loading = false,
  viewToggle,
  showHomeLink = false,
  embedded = false,
}: ProjectWorkspaceBarProps) {
  const health = computeProjectHealthFromStats(stats, {
    isShared: project.is_shared,
    daysSinceActivity: null,
  });
  const badgeClass = projectHealthBadgeClass(health.status);

  return (
    <div
      className={
        embedded
          ? "no-print border-t border-border/50"
          : "no-print rounded-lg border border-border/70 bg-surface shadow-sm"
      }
    >
      <div className={`${ui.compactBar} justify-between`}>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {showHomeLink ? (
            <Link
              href="/today"
              className="shrink-0 text-xs font-medium text-muted transition hover:text-primary"
            >
              ← Today
            </Link>
          ) : null}
          <h2 className="truncate text-sm font-semibold text-primary">
            {project.name}
          </h2>
          <ProjectStatusBadge status={project.project_status} />
          <span
            className={`inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-[10px] font-medium ${badgeClass}`}
            title={health.tooltip}
          >
            <span aria-hidden>{health.icon}</span>
            {loading ? "…" : `Health ${health.score}`}
          </span>
          <span
            className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${
              project.is_shared
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-amber-200 bg-amber-50 text-amber-800"
            }`}
          >
            {project.is_shared ? "Shared with client" : "Internal only"}
          </span>
        </div>
        {viewToggle ? (
          <div className="flex shrink-0 items-center">{viewToggle}</div>
        ) : null}
      </div>
    </div>
  );
}
