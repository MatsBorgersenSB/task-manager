"use client";

import type { ProjectTaskStats } from "@/lib/tasks/projectStats";
import {
  SUMMARY_FILTER_TOOLTIPS,
  type SummaryFilterKey,
} from "@/lib/tasks/summaryFilters";

const KPI_ITEMS: {
  key: SummaryFilterKey;
  statKey: keyof ProjectTaskStats | "waiting";
  label: string;
  valueClass: string;
  activeClass: string;
}[] = [
  {
    key: "open",
    statKey: "open",
    label: "Open",
    valueClass: "text-blue-900",
    activeClass: "bg-blue-100 ring-blue-300",
  },
  {
    key: "completed",
    statKey: "completed",
    label: "Completed",
    valueClass: "text-green-900",
    activeClass: "bg-green-100 ring-green-300",
  },
  {
    key: "overdue",
    statKey: "overdue",
    label: "Overdue",
    valueClass: "text-red-900",
    activeClass: "bg-red-100 ring-red-300",
  },
  {
    key: "dueThisWeek",
    statKey: "dueThisWeek",
    label: "Due",
    valueClass: "text-yellow-900",
    activeClass: "bg-yellow-100 ring-yellow-300",
  },
  {
    key: "waiting",
    statKey: "waiting",
    label: "Waiting",
    valueClass: "text-violet-900",
    activeClass: "bg-violet-100 ring-violet-300",
  },
];

type ProjectKpiBarProps = {
  stats: ProjectTaskStats;
  waitingCount: number;
  loading?: boolean;
  activeFilter?: SummaryFilterKey | null;
  onFilterClick?: (key: SummaryFilterKey) => void;
};

export default function ProjectKpiBar({
  stats,
  waitingCount,
  loading = false,
  activeFilter = null,
  onFilterClick,
}: ProjectKpiBarProps) {
  return (
    <div
      className="no-print flex flex-wrap items-center gap-x-1 gap-y-1 rounded-lg border border-border/80 bg-white px-3 py-1.5 text-sm shadow-sm"
      aria-label="Task summary filters"
    >
      {KPI_ITEMS.map((item, index) => {
        const value =
          loading
            ? "—"
            : String(
                item.statKey === "waiting"
                  ? waitingCount
                  : stats[item.statKey as keyof ProjectTaskStats]
              );
        const isActive = activeFilter === item.key;

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
              disabled={loading || !onFilterClick}
              onClick={() => onFilterClick?.(item.key)}
              className={`inline-flex items-baseline gap-1 rounded px-1.5 py-0.5 transition disabled:cursor-default disabled:opacity-60 ${
                isActive ? `ring-1 ${item.activeClass}` : "hover:bg-slate-100"
              }`}
            >
              <span className="text-xs text-muted">{item.label}</span>
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
