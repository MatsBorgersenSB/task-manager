"use client";

import type { ProjectLifecycleFilter } from "@/lib/projects/lifecycle";

const FILTERS: { id: ProjectLifecycleFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "completed", label: "Completed" },
  { id: "archived", label: "Archived" },
];

type ProjectLifecycleFilterTabsProps = {
  value: ProjectLifecycleFilter;
  onChange: (filter: ProjectLifecycleFilter) => void;
  className?: string;
};

export default function ProjectLifecycleFilterTabs({
  value,
  onChange,
  className = "",
}: ProjectLifecycleFilterTabsProps) {
  return (
    <div
      className={`flex flex-wrap gap-1 rounded-lg border border-border bg-background p-1 ${className}`}
      role="tablist"
      aria-label="Project status filter"
    >
      {FILTERS.map((filter) => {
        const active = value === filter.id;
        return (
          <button
            key={filter.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(filter.id)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              active
                ? "bg-accent text-white shadow-sm"
                : "text-muted hover:bg-surface hover:text-primary"
            }`}
          >
            {filter.label}
          </button>
        );
      })}
    </div>
  );
}
