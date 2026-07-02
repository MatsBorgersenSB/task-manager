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
};

export default function ProjectWorkspaceBar({
  project,
  stats,
  loading = false,
  viewToggle,
  showHomeLink = false,
}: ProjectWorkspaceBarProps) {
  const health = computeProjectHealthFromStats(stats, {
    isShared: project.is_shared,
    daysSinceActivity: null,
  });
  const badgeClass = projectHealthBadgeClass(health.status);

  return (
    <div className="no-print sticky top-14 z-30 -mx-1 mb-1 border-b border-border/60 bg-white/95 px-4 py-2.5 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/90 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          {showHomeLink ? (
            <Link
              href="/today"
              className="shrink-0 text-sm font-medium text-muted transition hover:text-primary"
            >
              ← Today
            </Link>
          ) : null}
          <h2 className="truncate text-base font-semibold text-primary">
            {project.name}
          </h2>
          <ProjectStatusBadge status={project.project_status} />
          <span
            className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${badgeClass}`}
            title={health.tooltip}
          >
            <span aria-hidden>{health.icon}</span>
            {loading ? "…" : `Health ${health.score}`}
          </span>
          <span
            className={`text-xs font-medium ${
              project.is_shared ? "text-emerald-700" : "text-amber-700"
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
