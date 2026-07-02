"use client";

import type { ProjectTaskStats } from "@/lib/tasks/projectStats";
import {
  SUMMARY_FILTER_TOOLTIPS,
  type SummaryFilterKey,
} from "@/lib/tasks/summaryFilters";
import { ui } from "@/lib/ui/classes";

const KPI_ITEMS: {
  key: SummaryFilterKey;
  statKey: keyof ProjectTaskStats | "waiting";
  label: string;
  valueClass: string;
}[] = [
  {
    key: "open",
    statKey: "open",
    label: "Open",
    valueClass: "text-blue-700",
  },
  {
    key: "completed",
    statKey: "completed",
    label: "Completed",
    valueClass: "text-emerald-700",
  },
  {
    key: "overdue",
    statKey: "overdue",
    label: "Overdue",
    valueClass: "text-red-600",
  },
  {
    key: "dueThisWeek",
    statKey: "dueThisWeek",
    label: "Due this week",
    valueClass: "text-amber-700",
  },
  {
    key: "waiting",
    statKey: "waiting",
    label: "Waiting",
    valueClass: "text-violet-700",
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
    <section
      className={`no-print ${ui.zone}`}
      aria-label="Statistics"
    >
      <div className="border-b border-border/50 px-4 py-2.5 sm:px-5">
        <p className={ui.zoneLabel}>Statistics</p>
      </div>
      <div className="flex flex-wrap gap-2 px-3 py-3 sm:px-4">
        {KPI_ITEMS.map((item) => {
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
            <button
              key={item.key}
              type="button"
              title={SUMMARY_FILTER_TOOLTIPS[item.key]}
              aria-label={`${item.label}: ${SUMMARY_FILTER_TOOLTIPS[item.key]}`}
              aria-pressed={isActive}
              disabled={loading || !onFilterClick}
              onClick={() => onFilterClick?.(item.key)}
              className={`${ui.kpiCard} ${
                isActive ? ui.kpiCardActive : ""
              } disabled:cursor-default disabled:opacity-60`}
            >
              <span className={ui.kpiLabel}>{item.label}</span>
              <span className={`${ui.kpiValue} ${item.valueClass}`}>
                {value}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
