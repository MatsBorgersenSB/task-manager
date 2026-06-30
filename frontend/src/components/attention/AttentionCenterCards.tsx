"use client";

import type { AttentionFilterKey } from "@/lib/attention/attentionWorkspace";
import type { WeightedAttentionBreakdown } from "@/lib/attention/attentionEngine";
import { attentionCountColorClass } from "@/lib/attention/attentionEngine";
import type { MyTasksWorkspaceStats } from "@/lib/attention/myTasksWorkspace";

type AttentionCenterCardsProps = {
  myTasksStats: MyTasksWorkspaceStats;
  attention: WeightedAttentionBreakdown;
  unreadNotifications: number;
  projectsAtRiskCount: number;
  waitingCount: number;
  activeFilter: AttentionFilterKey | null;
  onFilterClick: (filter: AttentionFilterKey) => void;
};

type CardDef = {
  key: AttentionFilterKey;
  label: string;
  shortLabel: string;
  value: number;
  valueClass: string;
  activeClass: string;
};

export default function AttentionCenterCards({
  myTasksStats,
  attention,
  unreadNotifications,
  projectsAtRiskCount,
  waitingCount,
  activeFilter,
  onFilterClick,
}: AttentionCenterCardsProps) {
  const attentionColors = attentionCountColorClass(attention.totalCount);

  const cards: CardDef[] = [
    {
      key: "myTasks",
      label: "My Tasks",
      shortLabel: "My Tasks",
      value: myTasksStats.open,
      valueClass: "text-blue-900",
      activeClass: "bg-blue-100 ring-blue-300",
    },
    {
      key: "attention",
      label: "Attention Required",
      shortLabel: "Attention",
      value: attention.totalCount,
      valueClass: attentionColors.value,
      activeClass: "bg-amber-100 ring-amber-300",
    },
    {
      key: "notifications",
      label: "Unread Notifications",
      shortLabel: "Unread",
      value: unreadNotifications,
      valueClass: "text-violet-900",
      activeClass: "bg-violet-100 ring-violet-300",
    },
    {
      key: "projectsAtRisk",
      label: "Projects At Risk",
      shortLabel: "At Risk",
      value: projectsAtRiskCount,
      valueClass: "text-red-900",
      activeClass: "bg-red-100 ring-red-300",
    },
    {
      key: "waiting",
      label: "Waiting For Response",
      shortLabel: "Waiting",
      value: waitingCount,
      valueClass: "text-orange-900",
      activeClass: "bg-orange-100 ring-orange-300",
    },
  ];

  return (
    <section aria-label="Attention Center">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Attention Center
        </h2>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-1 gap-y-1 text-sm">
        {cards.map((card, index) => {
          const isActive = activeFilter === card.key;
          return (
            <span key={card.key} className="inline-flex items-center">
              {index > 0 ? (
                <span className="mx-1.5 text-muted/50" aria-hidden>
                  |
                </span>
              ) : null}
              <button
                type="button"
                title={card.label}
                aria-pressed={isActive}
                onClick={() => onFilterClick(card.key)}
                className={`inline-flex items-baseline gap-1 rounded px-2 py-1 transition ${
                  isActive
                    ? `ring-1 ${card.activeClass}`
                    : "hover:bg-slate-100"
                } ${card.key === "attention" ? attentionColors.card : ""}`}
              >
                <span className="text-xs text-muted">{card.shortLabel}</span>
                <span
                  className={`text-sm font-bold tabular-nums ${card.valueClass}`}
                >
                  {card.value}
                </span>
              </button>
            </span>
          );
        })}
      </div>
    </section>
  );
}
