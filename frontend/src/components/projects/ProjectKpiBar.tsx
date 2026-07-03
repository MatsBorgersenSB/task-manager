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
  labelClass: string;
  valueClass: string;
  activeClass: string;
}[] = [
  {
    key: "open",
    statKey: "open",
    label: "Open",
    labelClass: "text-blue-700",
    valueClass: "text-blue-800",
    activeClass: "bg-blue-50/90",
  },
  {
    key: "completed",
    statKey: "completed",
    label: "Completed",
    labelClass: "text-emerald-700",
    valueClass: "text-emerald-800",
    activeClass: "bg-emerald-50/90",
  },
  {
    key: "overdue",
    statKey: "overdue",
    label: "Overdue",
    labelClass: "text-red-700",
    valueClass: "text-red-800",
    activeClass: "bg-red-50/90",
  },
  {
    key: "dueThisWeek",
    statKey: "dueThisWeek",
    label: "Due This Week",
    labelClass: "text-amber-700",
    valueClass: "text-amber-800",
    activeClass: "bg-amber-50/90",
  },
  {
    key: "waiting",
    statKey: "waiting",
    label: "Waiting",
    labelClass: "text-violet-700",
    valueClass: "text-violet-800",
    activeClass: "bg-violet-50/90",
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
      <div className="flex justify-center px-2 py-1.5 sm:px-3">
        <div
          role="group"
          aria-label="Project statistics"
          className="inline-flex max-w-full flex-wrap items-stretch overflow-hidden rounded-lg border border-border/80 bg-white shadow-sm"
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
            const interactive = Boolean(onFilterClick) && !loading;

            return (
              <button
                key={item.key}
                type="button"
                title={SUMMARY_FILTER_TOOLTIPS[item.key]}
                aria-label={`${item.label}: ${SUMMARY_FILTER_TOOLTIPS[item.key]}`}
                aria-pressed={isActive}
                disabled={!interactive}
                onClick={() => onFilterClick?.(item.key)}
                className={`inline-flex items-baseline gap-1.5 px-2.5 py-1 text-left transition ${
                  index > 0 ? "border-l border-border/60" : ""
                } ${
                  interactive
                    ? "cursor-pointer hover:bg-slate-50/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/30"
                    : "cursor-default"
                } ${isActive ? item.activeClass : ""}`}
              >
                <span className={`text-[11px] font-medium ${item.labelClass}`}>
                  {item.label}
                </span>
                <span
                  className={`text-sm font-semibold tabular-nums leading-none ${item.valueClass}`}
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
