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
  /** Compact dashboard widget rendered inline, immediately after project info. */
  dashboard?: React.ReactNode;
  showHomeLink?: boolean;
  embedded?: boolean;
  /** Render inline inside ProjectToolbar without duplicate project title or wrapper border. */
  inlineContext?: boolean;
};

export default function ProjectWorkspaceBar({
  project,
  stats,
  loading = false,
  viewToggle,
  dashboard,
  showHomeLink = false,
  embedded = false,
  inlineContext = false,
}: ProjectWorkspaceBarProps) {
  const health = computeProjectHealthFromStats(stats, {
    isShared: project.is_shared,
    daysSinceActivity: null,
  });
  const badgeClass = projectHealthBadgeClass(health.status);

  const innerBadgesAndControls = (
    <>
      {showHomeLink && !inlineContext ? (
        <Link
          href="/today"
          className="shrink-0 text-xs font-medium text-muted transition hover:text-primary"
        >
          ← Today
        </Link>
      ) : null}
      {!inlineContext ? (
        <h2 className="max-w-[12rem] truncate text-sm font-semibold text-primary sm:max-w-xs">
          {project.name}
        </h2>
      ) : null}
      <ProjectStatusBadge status={project.project_status} />
      <span
        className={`inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-[10px] font-medium ${badgeClass}`}
        title={health.tooltip}
      >
        <span aria-hidden>{health.icon}</span>
        {loading ? "…" : `Health ${health.score}`}
      </span>
      <span
        className={`hidden rounded border px-1.5 py-0.5 text-[10px] font-medium xl:inline-flex ${
          project.is_shared
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border-amber-200 bg-amber-50 text-amber-800"
        }`}
      >
        {project.is_shared ? "Shared with client" : "Internal only"}
      </span>
      {viewToggle ? (
        <>
          <span
            className="hidden h-3.5 w-px shrink-0 bg-border/60 sm:block"
            aria-hidden
          />
          <div className="flex shrink-0 items-center">{viewToggle}</div>
        </>
      ) : null}
      {dashboard ? (
        <>
          <span
            className="hidden h-3.5 w-px shrink-0 bg-border/60 sm:block"
            aria-hidden
          />
          <div className="flex min-w-0 items-center">{dashboard}</div>
        </>
      ) : null}
    </>
  );

  if (inlineContext) {
    return (
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        {innerBadgesAndControls}
      </div>
    );
  }

  return (
    <div
      className={
        embedded
          ? "no-print border-t border-border/40"
          : "no-print rounded-lg border border-border/70 bg-surface shadow-sm"
      }
    >
      <div className={ui.compactBar}>{innerBadgesAndControls}</div>
    </div>
  );
}
