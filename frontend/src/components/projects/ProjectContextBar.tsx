"use client";

import type { Project } from "@/lib/projects/types";
import type { ProjectTaskStats } from "@/lib/tasks/projectStats";
import { formatRelativeDaysAgo } from "@/lib/tasks/projectActivity";
import {
  computeProjectHealthFromStats,
  projectHealthBadgeClass,
  projectHealthScoreClass,
} from "@/lib/tasks/projectHealth";
import {
  progressBarBlocks,
  progressBarColorClass,
} from "@/lib/tasks/taskDates";
import type { AttentionStats } from "@/lib/tasks/attentionStats";
import { attentionCardColorClass } from "@/lib/tasks/attentionStats";
import CollapsibleProjectLinks from "@/components/projects/CollapsibleProjectLinks";
import CollapsibleRecentUpdates from "@/components/projects/CollapsibleRecentUpdates";
import {
  PROJECT_PROGRESS_TOOLTIP,
  SUMMARY_FILTER_TOOLTIPS,
  type SummaryFilterKey,
} from "@/lib/tasks/summaryFilters";
import type { DashboardSectionId } from "@/lib/projects/dashboardSections";
import {
  DashboardSectionHideButton,
  HiddenSectionPlaceholder,
} from "@/components/projects/DashboardSectionControls";
import { useProjectSummaryCollapsed } from "@/lib/projects/projectSummaryPreferences";

type ProjectContextBarProps = {
  project: Project;
  stats: ProjectTaskStats;
  loading?: boolean;
  variant?: "internal" | "client";
  activeSummaryFilter?: SummaryFilterKey | null;
  onSummaryFilterClick?: (key: SummaryFilterKey) => void;
  canEditProjectLinks?: boolean;
  onManageProjectLinks?: () => void;
  lastClientActivityAt?: string | null;
  attentionStats?: AttentionStats;
  onAttentionClick?: () => void;
  activeAttentionFilter?: boolean;
  isSectionVisible?: (id: DashboardSectionId) => boolean;
  onHideSection?: (id: DashboardSectionId) => void;
  onShowSection?: (id: DashboardSectionId) => void;
};

const COMPACT_STAT_ITEMS: {
  key: SummaryFilterKey;
  statKey: "open" | "completed" | "overdue" | "dueThisWeek";
  label: string;
  shortLabel: string;
  valueClass: string;
  activeClass: string;
}[] = [
  {
    key: "open",
    statKey: "open",
    label: "Open Tasks",
    shortLabel: "Open",
    valueClass: "text-blue-900",
    activeClass: "bg-blue-100 ring-blue-300",
  },
  {
    key: "completed",
    statKey: "completed",
    label: "Completed",
    shortLabel: "Completed",
    valueClass: "text-green-900",
    activeClass: "bg-green-100 ring-green-300",
  },
  {
    key: "overdue",
    statKey: "overdue",
    label: "Overdue",
    shortLabel: "Overdue",
    valueClass: "text-red-900",
    activeClass: "bg-red-100 ring-red-300",
  },
  {
    key: "dueThisWeek",
    statKey: "dueThisWeek",
    label: "Due This Week",
    shortLabel: "Due",
    valueClass: "text-yellow-900",
    activeClass: "bg-yellow-100 ring-yellow-300",
  },
];

type KpiStatItem = {
  key: SummaryFilterKey;
  statKey: keyof ProjectTaskStats;
  label: string;
  shortLabel?: string;
  valueClass: string;
  activeClass: string;
};

const EXPANDED_EXTRA_STAT_ITEMS: KpiStatItem[] = [
  {
    key: "recentUpdates",
    statKey: "recentUpdates",
    label: "Recent Updates",
    valueClass: "text-orange-900",
    activeClass: "bg-orange-100 ring-orange-300",
  },
  {
    key: "clientActivity",
    statKey: "clientActivity",
    label: "Client Activity",
    valueClass: "text-violet-900",
    activeClass: "bg-violet-100 ring-violet-300",
  },
];

function daysSinceActivity(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const parsed = new Date(iso).getTime();
  if (Number.isNaN(parsed)) return null;
  return Math.floor((Date.now() - parsed) / (1000 * 60 * 60 * 24));
}

function SharingStatus({
  project,
  isInternal,
  compact = false,
}: {
  project: Project;
  isInternal: boolean;
  compact?: boolean;
}) {
  if (project.is_shared) {
    return (
      <span
        className={`font-medium text-green-700 ${compact ? "text-xs" : "mt-1 block text-sm"}`}
      >
        {isInternal ? "Shared with client" : "Shared project"}
      </span>
    );
  }

  if (isInternal) {
    return (
      <span
        className={`font-medium text-amber-700 ${compact ? "text-xs" : "mt-1 block text-sm"}`}
      >
        Not shared with client
      </span>
    );
  }

  return null;
}

function CompactKpiRow({
  stats,
  loading,
  activeSummaryFilter,
  onSummaryFilterClick,
  extraItems = [],
}: {
  stats: ProjectTaskStats;
  loading: boolean;
  activeSummaryFilter?: SummaryFilterKey | null;
  onSummaryFilterClick?: (key: SummaryFilterKey) => void;
  extraItems?: KpiStatItem[];
}) {
  const items: KpiStatItem[] = [...COMPACT_STAT_ITEMS, ...extraItems];

  return (
    <div className="flex flex-wrap items-center gap-x-1 gap-y-1 text-sm">
      {items.map((item, index) => {
        const raw = stats[item.statKey as keyof ProjectTaskStats];
        const value = loading ? "—" : String(raw);
        const isActive = activeSummaryFilter === item.key;
        const label = item.shortLabel ?? item.label;

        return (
          <span key={item.key} className="inline-flex items-center">
            {index > 0 ? (
              <span className="mx-1.5 text-muted/50" aria-hidden>
                |
              </span>
            ) : null}
            <button
              type="button"
              title={SUMMARY_FILTER_TOOLTIPS[item.key]}
              aria-label={`${item.label}: ${SUMMARY_FILTER_TOOLTIPS[item.key]}`}
              aria-pressed={isActive}
              disabled={loading || !onSummaryFilterClick}
              onClick={() => onSummaryFilterClick?.(item.key)}
              className={`inline-flex items-baseline gap-1 rounded px-1.5 py-0.5 transition disabled:cursor-default disabled:opacity-60 ${
                isActive ? `ring-1 ${item.activeClass}` : "hover:bg-slate-100"
              }`}
            >
              <span className="text-xs text-muted">{label}</span>
              <span
                className={`text-sm font-bold tabular-nums ${item.valueClass}`}
              >
                {value}
              </span>
            </button>
          </span>
        );
      })}
    </div>
  );
}

function ProjectHealthBadge({
  stats,
  loading,
  isShared,
  compact = false,
}: {
  stats: ProjectTaskStats;
  loading: boolean;
  isShared: boolean;
  compact?: boolean;
}) {
  const health = computeProjectHealthFromStats(stats, {
    isShared,
    daysSinceActivity: daysSinceActivity(stats.lastTaskActivityAt),
  });
  const badgeClass = projectHealthBadgeClass(health.status);
  const scoreClass = projectHealthScoreClass(health.status);

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${badgeClass}`}
        title={health.tooltip}
      >
        <span aria-hidden>{health.icon}</span>
        {loading ? "…" : `${health.score}`}
      </span>
    );
  }

  return (
    <div
      className={`rounded-lg border px-3 py-2 sm:min-w-[9rem] ${badgeClass}`}
      title={health.tooltip}
      aria-label={`Project health: ${health.label}, ${loading ? "loading" : `${health.score} out of 100`}`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide opacity-80">
        Health
      </p>
      {loading ? (
        <p className="mt-0.5 text-sm font-medium">…</p>
      ) : (
        <p className={`mt-0.5 text-sm font-bold tabular-nums ${scoreClass}`}>
          <span aria-hidden className="mr-0.5">
            {health.icon}
          </span>
          {health.score}/100
        </p>
      )}
    </div>
  );
}

export default function ProjectContextBar({
  project,
  stats,
  loading = false,
  variant = "internal",
  activeSummaryFilter = null,
  onSummaryFilterClick,
  canEditProjectLinks = false,
  onManageProjectLinks,
  lastClientActivityAt,
  attentionStats,
  onAttentionClick,
  activeAttentionFilter = false,
  isSectionVisible,
  onHideSection,
  onShowSection,
}: ProjectContextBarProps) {
  const { collapsed, toggle } = useProjectSummaryCollapsed();
  const showSection = (id: DashboardSectionId) =>
    isSectionVisible ? isSectionVisible(id) : true;
  const isInternal = variant === "internal";
  const progressColor = progressBarColorClass(stats.progressPercent);
  const lastClientLabel = formatRelativeDaysAgo(
    lastClientActivityAt ?? stats.lastTaskActivityAt
  );
  const attentionTotal = attentionStats?.total ?? 0;
  const attentionColors = attentionCardColorClass(attentionTotal);
  const expandedExtraStats = isInternal ? EXPANDED_EXTRA_STAT_ITEMS : [];
  const projectLinks = project.links ?? [];
  const showLinksSection =
    showSection("links") &&
    (projectLinks.length > 0 || canEditProjectLinks);

  return (
    <section
      className={`no-print rounded-lg border px-3 py-2 shadow-sm sm:px-4 ${
        isInternal
          ? "border-slate-200 bg-white"
          : "border-slate-200 bg-slate-50"
      }`}
      aria-label="Project dashboard"
    >
      {/* Compact header — always visible */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h2 className="text-base font-bold text-primary sm:text-lg">
              <span className="text-muted font-semibold">Project:</span>{" "}
              {project.name}
            </h2>
            {isInternal ? (
              <ProjectHealthBadge
                stats={stats}
                loading={loading}
                isShared={project.is_shared}
                compact
              />
            ) : null}
          </div>
          {!collapsed ? (
            <SharingStatus project={project} isInternal={isInternal} compact />
          ) : null}
        </div>
        <button
          type="button"
          onClick={toggle}
          className="shrink-0 rounded-md border border-border px-2.5 py-1 text-xs font-semibold text-primary transition hover:bg-slate-50"
          aria-expanded={!collapsed}
        >
          {collapsed ? "▼ Show Details" : "▲ Hide Details"}
        </button>
      </div>

      {/* Compact KPI row — always visible */}
      {showSection("stats") ? (
        <div className="mt-1.5">
          <CompactKpiRow
            stats={stats}
            loading={loading}
            activeSummaryFilter={activeSummaryFilter}
            onSummaryFilterClick={onSummaryFilterClick}
          />
        </div>
      ) : onShowSection ? (
        <HiddenSectionPlaceholder
          label="Summary"
          onShow={() => onShowSection("stats")}
        />
      ) : null}

      {showLinksSection ? (
        <div className="mt-2">
          {isInternal && onHideSection ? (
            <div className="mb-1 flex justify-end">
              <DashboardSectionHideButton
                label="Project Links"
                onHide={() => onHideSection("links")}
              />
            </div>
          ) : null}
          <CollapsibleProjectLinks
            links={projectLinks}
            canEdit={canEditProjectLinks}
            onManage={onManageProjectLinks}
            defaultCollapsed
          />
        </div>
      ) : onShowSection && projectLinks.length > 0 ? (
        <HiddenSectionPlaceholder
          label="Project Links"
          onShow={() => onShowSection("links")}
        />
      ) : null}

      <div className="mt-2">
        <CollapsibleRecentUpdates
          projectId={project.id}
          mode={isInternal ? "internal" : "client"}
          defaultCollapsed
        />
      </div>

      {/* Expanded details */}
      {!collapsed ? (
        <div className="mt-3 space-y-3 border-t border-border/70 pt-3">
          {isInternal && !loading ? (
            <dl className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted">
              {lastClientLabel ? (
                <div>
                  <dt className="sr-only">Last client activity</dt>
                  <dd>
                    Last client activity:{" "}
                    <span className="font-medium text-primary">
                      {lastClientLabel}
                    </span>
                  </dd>
                </div>
              ) : null}
            </dl>
          ) : null}

          {isInternal && attentionStats && onAttentionClick ? (
            showSection("attention") ? (
              <div>
                <div className="mb-1 flex items-center justify-end">
                  {onHideSection ? (
                    <DashboardSectionHideButton
                      label="Attention Required"
                      onHide={() => onHideSection("attention")}
                    />
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={onAttentionClick}
                  disabled={loading}
                  title={SUMMARY_FILTER_TOOLTIPS.attentionRequired}
                  aria-pressed={activeAttentionFilter}
                  className={`w-full rounded-lg border px-3 py-2 text-left transition ${attentionColors.card} ${
                    activeAttentionFilter
                      ? `shadow-md ring-2 ${attentionColors.ring}`
                      : "shadow-sm"
                  } disabled:cursor-default disabled:opacity-60`}
                >
                  <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                    <span aria-hidden>⚠</span> Attention Required
                  </span>
                  <span
                    className={`mt-0.5 block text-xl font-bold tabular-nums ${attentionColors.value}`}
                  >
                    {loading ? "—" : attentionTotal}
                  </span>
                  {!loading ? (
                    <span className="mt-0.5 block text-[10px] text-muted">
                      {attentionStats.overdue} overdue ·{" "}
                      {attentionStats.dueWithin24Hours} due within 24h ·{" "}
                      {attentionStats.unansweredComments} waiting for response
                    </span>
                  ) : null}
                </button>
              </div>
            ) : onShowSection ? (
              <HiddenSectionPlaceholder
                label="Attention Required"
                onShow={() => onShowSection("attention")}
              />
            ) : null
          ) : null}

          {showSection("stats") && expandedExtraStats.length > 0 ? (
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
                Additional metrics
              </p>
              <CompactKpiRow
                stats={stats}
                loading={loading}
                activeSummaryFilter={activeSummaryFilter}
                onSummaryFilterClick={onSummaryFilterClick}
                extraItems={expandedExtraStats}
              />
            </div>
          ) : null}

          {showSection("progress") ? (
            <div title={PROJECT_PROGRESS_TOOLTIP}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                  Project Progress
                </p>
                {isInternal && onHideSection ? (
                  <DashboardSectionHideButton
                    label="Project Progress"
                    onHide={() => onHideSection("progress")}
                  />
                ) : null}
              </div>
              {loading ? (
                <p className="mt-1 text-xs text-muted">Loading…</p>
              ) : stats.total === 0 ? (
                <p className="mt-1 text-xs text-muted">No tasks yet</p>
              ) : (
                <div className="mt-1.5 space-y-1.5">
                  <div
                    className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[10px] leading-none text-primary"
                    role="progressbar"
                    aria-valuenow={stats.progressPercent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Project progress: ${stats.progressPercent}%`}
                  >
                    <span aria-hidden>
                      {progressBarBlocks(stats.progressPercent)}
                    </span>
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
                    {stats.total + stats.subtasksOpen + stats.subtasksCompleted}{" "}
                    items completed
                  </p>
                </div>
              )}
            </div>
          ) : onShowSection ? (
            <HiddenSectionPlaceholder
              label="Project Progress"
              onShow={() => onShowSection("progress")}
            />
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
