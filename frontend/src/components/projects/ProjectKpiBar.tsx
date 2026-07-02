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
  { key: "open", statKey: "open", label: "Open", valueClass: "text-blue-700" },
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
  embedded?: boolean;
};

export default function ProjectKpiBar({
  stats,
  waitingCount,
  loading = false,
  activeFilter = null,
  onFilterClick,
  embedded = false,
}: ProjectKpiBarProps) {
  return (
    <section
      className={
        embedded
          ? "no-print border-t border-border/40"
          : "no-print rounded-lg border border-border/70 bg-surface shadow-sm"
      }
      aria-label="Statistics"
    >
      <div className={`${ui.compactBar} w-full`}>
        <span className={`${ui.zoneLabel} shrink-0`}>Statistics</span>
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-evenly gap-x-2 gap-y-0.5">
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
                className={`${ui.kpiInline} ${
                  isActive ? ui.kpiInlineActive : ""
                }`}
              >
                <span className="text-xs text-muted">{item.label}</span>
                <span
                  className={`text-sm font-semibold tabular-nums ${item.valueClass}`}
                >
                  {value}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
