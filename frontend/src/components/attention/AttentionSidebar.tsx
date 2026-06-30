"use client";

import Link from "next/link";
import type { AttentionFilterKey } from "@/lib/attention/attentionWorkspace";
import { useAttentionSidebarCollapsed } from "@/lib/attention/attentionSidebarPreferences";

type AttentionSidebarProps = {
  attentionCount: number;
  waitingCount: number;
  unreadNotifications: number;
  myTasksCount: number;
  activeFilter: AttentionFilterKey | null;
  onFilterClick: (filter: AttentionFilterKey) => void;
};

export default function AttentionSidebar({
  attentionCount,
  waitingCount,
  unreadNotifications,
  myTasksCount,
  activeFilter,
  onFilterClick,
}: AttentionSidebarProps) {
  const { collapsed, toggle } = useAttentionSidebarCollapsed();

  if (collapsed) {
    return (
      <aside className="no-print hidden xl:block">
        <button
          type="button"
          onClick={toggle}
          className="fixed right-4 top-24 z-40 rounded-lg border border-border bg-white px-2 py-3 text-xs font-semibold text-primary shadow-md"
          aria-label="Show attention sidebar"
        >
          ◀
        </button>
      </aside>
    );
  }

  const items: { key: AttentionFilterKey | "notifications"; label: string; icon: string; count: number }[] = [
    { key: "attention", label: "Attention Required", icon: "⚠", count: attentionCount },
    { key: "waiting", label: "Waiting Responses", icon: "💬", count: waitingCount },
    { key: "notifications", label: "Notifications", icon: "🔔", count: unreadNotifications },
    { key: "myTasks", label: "My Tasks", icon: "📋", count: myTasksCount },
  ];

  return (
    <aside className="no-print hidden w-56 shrink-0 xl:block">
      <div className="sticky top-20 rounded-lg border border-border bg-white p-3 shadow-sm">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Quick Nav
          </p>
          <button
            type="button"
            onClick={toggle}
            className="text-xs text-muted hover:text-primary"
            aria-label="Hide attention sidebar"
          >
            ▶
          </button>
        </div>
        <ul className="space-y-1">
          {items.map((item) => (
            <li key={item.key}>
              <button
                type="button"
                onClick={() => onFilterClick(item.key as AttentionFilterKey)}
                className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition ${
                  activeFilter === item.key
                    ? "bg-accent/10 font-semibold text-primary"
                    : "hover:bg-slate-50"
                }`}
              >
                <span>
                  <span aria-hidden className="mr-1.5">
                    {item.icon}
                  </span>
                  {item.label}
                </span>
                <span className="tabular-nums text-xs text-muted">{item.count}</span>
              </button>
            </li>
          ))}
        </ul>
        <Link
          href="/internal"
          className="mt-3 block text-center text-xs font-semibold text-accent hover:underline"
        >
          Open task workspace
        </Link>
      </div>
    </aside>
  );
}
