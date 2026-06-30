"use client";

import type { Project } from "@/lib/projects/types";
import type { ProjectTaskStats } from "@/lib/tasks/projectStats";
import { formatRelativeDaysAgo } from "@/lib/tasks/projectActivity";
import {
  progressBarBlocks,
  progressBarColorClass,
} from "@/lib/tasks/taskDates";
import type { AttentionStats } from "@/lib/tasks/attentionStats";
import { attentionCardColorClass } from "@/lib/tasks/attentionStats";
import CollapsibleProjectLinks from "@/components/projects/CollapsibleProjectLinks";
import CollapsibleRecentUpdates from "@/components/projects/CollapsibleRecentUpdates";
import CollapsibleDashboardSection from "@/components/projects/CollapsibleDashboardSection";
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
import { useSectionCollapse } from "@/lib/projects/dashboardSectionCollapse";

type ProjectContextBarProps = {
  project: Project;
  stats: ProjectTaskStats;
  loading?: boolean;
  variant?: "internal" | "client";
  layoutSlot: "above-table" | "below-table";
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

function SharingStatus({
  project,
  isInternal,
}: {
  project: Project;
  isInternal: boolean;
}) {
  if (project.is_shared) {
    return (
      <span className="text-xs font-medium text-green-700">
        {isInternal ? "Shared with client" : "Shared project"}
      </span>
    );
  }

  if (isInternal) {
    return (
      <span className="text-xs font-medium text-amber-700">
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

function AttentionCenterCard({
  attentionStats,
  loading,
  activeAttentionFilter,
  onAttentionClick,
}: {
  attentionStats: AttentionStats;
  loading: boolean;
  activeAttentionFilter: boolean;
  onAttentionClick: () => void;
}) {
  const attentionTotal = attentionStats.total;
  const attentionColors = attentionCardColorClass(attentionTotal);

  return (
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
  );
}

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

export default function ProjectContextBar({
  project,
  stats,
  loading = false,
  variant = "internal",
  layoutSlot,
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
  const { expanded: summaryExpanded } = useSectionCollapse("projectSummary");
  const showSection = (id: DashboardSectionId) =>
    isSectionVisible ? isSectionVisible(id) : true;
  const isInternal = variant === "internal";
  const lastClientLabel = formatRelativeDaysAgo(
    lastClientActivityAt ?? stats.lastTaskActivityAt
  );
  const expandedExtraStats = isInternal ? EXPANDED_EXTRA_STAT_ITEMS : [];
  const projectLinks = project.links ?? [];
  const showLinksSection =
    showSection("links") &&
    (projectLinks.length > 0 || canEditProjectLinks);

  if (layoutSlot === "above-table") {
    return (
      <div className="no-print space-y-2" aria-label="Project dashboard above table">
        {isInternal && attentionStats && onAttentionClick ? (
          showSection("attention") ? (
            <CollapsibleDashboardSection
              sectionId="attentionCenter"
              headerActions={
                onHideSection ? (
                  <DashboardSectionHideButton
                    label="Attention Center"
                    onHide={() => onHideSection("attention")}
                  />
                ) : undefined
              }
            >
              <AttentionCenterCard
                attentionStats={attentionStats}
                loading={loading}
                activeAttentionFilter={activeAttentionFilter}
                onAttentionClick={onAttentionClick}
              />
            </CollapsibleDashboardSection>
          ) : onShowSection ? (
            <HiddenSectionPlaceholder
              label="Attention Center"
              onShow={() => onShowSection("attention")}
            />
          ) : null
        ) : null}

        {showSection("stats") ? (
          <div className="rounded-lg border border-border/80 bg-white px-3 py-1.5 shadow-sm">
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

        <CollapsibleDashboardSection sectionId="projectSummary">
          <div className="space-y-2">
            <SharingStatus project={project} isInternal={isInternal} />
            {isInternal && !loading && lastClientLabel ? (
              <p className="text-xs text-muted">
                Last client activity:{" "}
                <span className="font-medium text-primary">{lastClientLabel}</span>
              </p>
            ) : null}
            {summaryExpanded && expandedExtraStats.length > 0 ? (
              <CompactKpiRow
                stats={stats}
                loading={loading}
                activeSummaryFilter={activeSummaryFilter}
                onSummaryFilterClick={onSummaryFilterClick}
                extraItems={expandedExtraStats}
              />
            ) : null}
          </div>
        </CollapsibleDashboardSection>
      </div>
    );
  }

  return (
    <div className="no-print mt-4 space-y-2" aria-label="Project dashboard below table">
      {showSection("progress") ? (
        <CollapsibleDashboardSection
          sectionId="projectProgress"
          headerActions={
            isInternal && onHideSection ? (
              <DashboardSectionHideButton
                label="Project Progress"
                onHide={() => onHideSection("progress")}
              />
            ) : undefined
          }
        >
          <ProjectProgressBlock stats={stats} loading={loading} />
        </CollapsibleDashboardSection>
      ) : onShowSection ? (
        <HiddenSectionPlaceholder
          label="Project Progress"
          onShow={() => onShowSection("progress")}
        />
      ) : null}

      {showLinksSection ? (
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
      ) : onShowSection && projectLinks.length > 0 ? (
        <HiddenSectionPlaceholder
          label="Project Links"
          onShow={() => onShowSection("links")}
        />
      ) : null}

      <CollapsibleDashboardSection sectionId="recentUpdates">
        <CollapsibleRecentUpdates
          projectId={project.id}
          mode={isInternal ? "internal" : "client"}
          embedded
        />
      </CollapsibleDashboardSection>
    </div>
  );
}
