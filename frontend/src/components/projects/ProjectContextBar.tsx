"use client";

import type { Project } from "@/lib/projects/types";
import type { ProjectTaskStats } from "@/lib/tasks/projectStats";
import {
  progressBarBlocks,
  progressBarColorClass,
} from "@/lib/tasks/taskDates";
import {
  PROJECT_PROGRESS_TOOLTIP,
  SUMMARY_FILTER_TOOLTIPS,
  type SummaryFilterKey,
} from "@/lib/tasks/summaryFilters";

type ProjectContextBarProps = {
  project: Project;
  stats: ProjectTaskStats;
  loading?: boolean;
  variant?: "internal" | "client";
  activeSummaryFilter?: SummaryFilterKey | null;
  onSummaryFilterClick?: (key: SummaryFilterKey) => void;
};

const STAT_ITEMS: {
  key: SummaryFilterKey;
  statKey: Exclude<keyof ProjectTaskStats, "total" | "progressPercent">;
  label: string;
  cardClass: string;
  activeRing: string;
  valueClass: string;
}[] = [
  {
    key: "open",
    statKey: "open",
    label: "Open Tasks",
    cardClass: "border-blue-200 bg-blue-50 hover:bg-blue-100/80",
    activeRing: "ring-blue-400",
    valueClass: "text-blue-900",
  },
  {
    key: "completed",
    statKey: "completed",
    label: "Completed",
    cardClass: "border-green-200 bg-green-50 hover:bg-green-100/80",
    activeRing: "ring-green-400",
    valueClass: "text-green-900",
  },
  {
    key: "overdue",
    statKey: "overdue",
    label: "Overdue",
    cardClass: "border-red-200 bg-red-50 hover:bg-red-100/80",
    activeRing: "ring-red-400",
    valueClass: "text-red-900",
  },
  {
    key: "dueThisWeek",
    statKey: "dueThisWeek",
    label: "Due This Week",
    cardClass: "border-yellow-200 bg-yellow-50 hover:bg-yellow-100/80",
    activeRing: "ring-yellow-400",
    valueClass: "text-yellow-900",
  },
  {
    key: "recentUpdates",
    statKey: "recentUpdates",
    label: "Recent Updates",
    cardClass: "border-orange-200 bg-orange-50 hover:bg-orange-100/80",
    activeRing: "ring-orange-400",
    valueClass: "text-orange-900",
  },
];

function SharingStatus({
  project,
  isInternal,
}: {
  project: Project;
  isInternal: boolean;
}) {
  if (project.is_shared) {
    return (
      <p className="mt-1 text-sm font-medium text-green-700">
        {isInternal ? "✅ Shared with Client" : "Shared Project"}
      </p>
    );
  }

  if (isInternal) {
    return (
      <p className="mt-1 text-sm font-medium text-amber-700">
        ⚠ Not shared with client yet
      </p>
    );
  }

  return null;
}

export default function ProjectContextBar({
  project,
  stats,
  loading = false,
  variant = "internal",
  activeSummaryFilter = null,
  onSummaryFilterClick,
}: ProjectContextBarProps) {
  const isInternal = variant === "internal";
  const progressColor = progressBarColorClass(stats.progressPercent);

  return (
    <section
      className={`no-print rounded-xl border px-4 py-4 shadow-sm sm:px-5 ${
        isInternal
          ? "border-slate-200 bg-white"
          : "border-slate-200 bg-slate-50"
      }`}
      aria-label="Project dashboard"
    >
      <header>
        <h2 className="text-xl font-bold text-primary">{project.name}</h2>
        <SharingStatus project={project} isInternal={isInternal} />
      </header>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {STAT_ITEMS.map(
          ({ key, statKey, label, cardClass, activeRing, valueClass }) => {
            const value = loading ? "—" : stats[statKey];
            const isActive = activeSummaryFilter === key;
            const tooltip = SUMMARY_FILTER_TOOLTIPS[key];

            return (
              <button
                key={key}
                type="button"
                title={tooltip}
                aria-label={`${label}: ${tooltip}`}
                aria-pressed={isActive}
                disabled={loading || !onSummaryFilterClick}
                onClick={() => onSummaryFilterClick?.(key)}
                className={`rounded-lg border px-3 py-3 text-left transition ${cardClass} ${
                  isActive
                    ? `shadow-md ring-2 ${activeRing}`
                    : "shadow-sm"
                } disabled:cursor-default disabled:opacity-60`}
              >
                <span className="block text-xs font-semibold uppercase tracking-wide text-muted">
                  {label}
                </span>
                <span
                  className={`mt-1 block text-2xl font-bold tabular-nums ${valueClass}`}
                >
                  {value}
                </span>
              </button>
            );
          }
        )}
      </div>

      <div className="mt-5 border-t border-border pt-4" title={PROJECT_PROGRESS_TOOLTIP}>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          Project Progress
        </p>
        {loading ? (
          <p className="mt-2 text-sm text-muted">Loading…</p>
        ) : stats.total === 0 ? (
          <p className="mt-2 text-sm text-muted">No tasks yet</p>
        ) : (
          <div className="mt-2 space-y-2">
            <div
              className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs leading-none tracking-tight text-primary sm:text-sm"
              role="progressbar"
              aria-valuenow={stats.progressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Project progress: ${stats.progressPercent}%`}
            >
              <span aria-hidden>{progressBarBlocks(stats.progressPercent)}</span>
              <span className="font-sans text-sm font-bold tabular-nums">
                {stats.progressPercent}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100 ring-1 ring-black/5">
              <div
                className={`h-full rounded-full transition-[width] duration-300 ${progressColor}`}
                style={{ width: `${stats.progressPercent}%` }}
              />
            </div>
            <p className="text-sm text-muted">
              {stats.completed} of {stats.total} tasks completed
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
