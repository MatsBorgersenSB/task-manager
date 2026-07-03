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
  chipClass: string;
  labelClass: string;
  valueClass: string;
  activeClass: string;
}[] = [
  {
    key: "open",
    statKey: "open",
    label: "Open",
    chipClass: "border-blue-200/90 bg-blue-50/90",
    labelClass: "text-blue-700",
    valueClass: "text-blue-800",
    activeClass: "border-blue-300 bg-blue-100 ring-2 ring-blue-200/80",
  },
  {
    key: "completed",
    statKey: "completed",
    label: "Completed",
    chipClass: "border-emerald-200/90 bg-emerald-50/90",
    labelClass: "text-emerald-700",
    valueClass: "text-emerald-800",
    activeClass: "border-emerald-300 bg-emerald-100 ring-2 ring-emerald-200/80",
  },
  {
    key: "overdue",
    statKey: "overdue",
    label: "Overdue",
    chipClass: "border-red-200/90 bg-red-50/90",
    labelClass: "text-red-700",
    valueClass: "text-red-800",
    activeClass: "border-red-300 bg-red-100 ring-2 ring-red-200/80",
  },
  {
    key: "dueThisWeek",
    statKey: "dueThisWeek",
    label: "Due This Week",
    chipClass: "border-amber-200/90 bg-amber-50/90",
    labelClass: "text-amber-700",
    valueClass: "text-amber-800",
    activeClass: "border-amber-300 bg-amber-100 ring-2 ring-amber-200/80",
  },
  {
    key: "waiting",
    statKey: "waiting",
    label: "Waiting",
    chipClass: "border-violet-200/90 bg-violet-50/90",
    labelClass: "text-violet-700",
    valueClass: "text-violet-800",
    activeClass: "border-violet-300 bg-violet-100 ring-2 ring-violet-200/80",
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
      <div className="flex justify-center px-3 py-2 sm:px-4">
        <div className="flex max-w-full flex-col items-center gap-1.5">
          <span className={ui.zoneLabel}>Statistics</span>
          <div
            className="flex flex-wrap items-center justify-center gap-1.5"
            role="group"
            aria-label="Project statistics"
          >
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
                  className={`inline-flex min-w-[5.25rem] flex-col items-center gap-0.5 rounded-md border px-2.5 py-1.5 text-center shadow-sm transition ${
                    item.chipClass
                  } ${
                    interactive
                      ? "cursor-pointer hover:brightness-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
                      : "cursor-default"
                  } ${isActive ? item.activeClass : ""}`}
                >
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-wide leading-none ${item.labelClass}`}
                  >
                    {item.label}
                  </span>
                  <span
                    className={`text-base font-semibold tabular-nums leading-none ${item.valueClass}`}
                  >
                    {value}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
