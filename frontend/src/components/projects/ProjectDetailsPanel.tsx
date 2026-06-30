"use client";

import type { Project } from "@/lib/projects/types";
import type { ProjectTaskStats } from "@/lib/tasks/projectStats";
import {
  progressBarBlocks,
  progressBarColorClass,
} from "@/lib/tasks/taskDates";
import CollapsibleProjectLinks from "@/components/projects/CollapsibleProjectLinks";
import ProjectActivityFeed from "@/components/projects/ProjectActivityFeed";
import CollapsibleDashboardSection from "@/components/projects/CollapsibleDashboardSection";
import { PROJECT_PROGRESS_TOOLTIP } from "@/lib/tasks/summaryFilters";
import type { TaskViewMode } from "@/lib/tasks/types";

type ProjectDetailsPanelProps = {
  project: Project;
  stats: ProjectTaskStats;
  loading?: boolean;
  mode: TaskViewMode;
  canEditProjectLinks?: boolean;
  onManageProjectLinks?: () => void;
  workflowBanner?: React.ReactNode;
};

function ProjectProgressBlock({
  stats,
  loading,
}: {
  stats: ProjectTaskStats;
  loading: boolean;
}) {
  const progressColor = progressBarColorClass(stats.progressPercent);

  return (
    <div title={PROJECT_PROGRESS_TOOLTIP}>
      {loading ? (
        <p className="text-xs text-muted">Loading…</p>
      ) : stats.total === 0 ? (
        <p className="text-xs text-muted">No tasks yet</p>
      ) : (
        <div className="space-y-1.5">
          <div
            className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[10px] leading-none text-primary"
            role="progressbar"
            aria-valuenow={stats.progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Project progress: ${stats.progressPercent}%`}
          >
            <span aria-hidden>{progressBarBlocks(stats.progressPercent)}</span>
            <span className="font-sans text-xs font-bold tabular-nums">
              {stats.progressPercent}%
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 ring-1 ring-black/5">
            <div
              className={`h-full rounded-full transition-[width] duration-300 ${progressColor}`}
              style={{ width: `${stats.progressPercent}%` }}
            />
          </div>
          <p className="text-xs text-muted">
            {stats.completed + stats.subtasksCompleted} of{" "}
            {stats.total + stats.subtasksOpen + stats.subtasksCompleted} items
            completed
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Below-table supporting information — collapsed by default, never competes with tasks.
 */
export default function ProjectDetailsPanel({
  project,
  stats,
  loading = false,
  mode,
  canEditProjectLinks = false,
  onManageProjectLinks,
  workflowBanner,
}: ProjectDetailsPanelProps) {
  const projectLinks = project.links ?? [];
  const showLinks = projectLinks.length > 0 || canEditProjectLinks;

  return (
    <div className="no-print mt-3 space-y-2" aria-label="Project details">
      {workflowBanner ? (
        <CollapsibleDashboardSection sectionId="sharingWorkflow">
          {workflowBanner}
        </CollapsibleDashboardSection>
      ) : null}

      <CollapsibleDashboardSection sectionId="projectProgress">
        <ProjectProgressBlock stats={stats} loading={loading} />
      </CollapsibleDashboardSection>

      {showLinks ? (
        <CollapsibleDashboardSection
          sectionId="projectLinks"
          headerActions={
            canEditProjectLinks && onManageProjectLinks ? (
              <button
                type="button"
                onClick={onManageProjectLinks}
                className="rounded-md border border-border px-2 py-0.5 text-[10px] font-semibold text-primary hover:bg-slate-50"
              >
                Manage
              </button>
            ) : onManageProjectLinks && projectLinks.length > 0 ? (
              <button
                type="button"
                onClick={onManageProjectLinks}
                className="rounded-md border border-border px-2 py-0.5 text-[10px] font-semibold text-primary hover:bg-slate-50"
              >
                View all
              </button>
            ) : undefined
          }
        >
          <CollapsibleProjectLinks
            links={projectLinks}
            canEdit={canEditProjectLinks}
            onManage={onManageProjectLinks}
            embedded
          />
        </CollapsibleDashboardSection>
      ) : null}

      <CollapsibleDashboardSection sectionId="recentUpdates">
        <ProjectActivityFeed projectId={project.id} mode={mode} />
      </CollapsibleDashboardSection>
    </div>
  );
}
