"use client";

import type { Project } from "@/lib/projects/types";
import type { ProjectTaskStats } from "@/lib/tasks/projectStats";

type ProjectContextBarProps = {
  project: Project;
  stats: ProjectTaskStats;
  loading?: boolean;
  variant?: "internal" | "client";
};

const STAT_ITEMS: {
  key: keyof ProjectTaskStats;
  label: string;
  accent?: boolean;
}[] = [
  { key: "open", label: "Open Tasks" },
  { key: "completed", label: "Completed" },
  { key: "overdue", label: "Overdue", accent: true },
  { key: "dueThisWeek", label: "Due This Week" },
  { key: "recentUpdates", label: "Recent Updates" },
];

export default function ProjectContextBar({
  project,
  stats,
  loading = false,
  variant = "internal",
}: ProjectContextBarProps) {
  const isInternal = variant === "internal";

  return (
    <div
      className={`no-print rounded-lg border px-4 py-3 text-sm text-primary ${
        isInternal
          ? "border-blue-100 bg-blue-50"
          : "border-slate-200 bg-slate-50"
      }`}
    >
      <h2 className="text-base font-semibold text-primary">{project.name}</h2>

      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-5">
        {STAT_ITEMS.map(({ key, label, accent }) => {
          const value = loading ? "—" : stats[key];
          const highlight =
            !loading && accent && typeof value === "number" && value > 0;

          return (
            <div key={key}>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted">
                {label}
              </dt>
              <dd
                className={`mt-0.5 text-xl font-bold tabular-nums ${
                  highlight ? "text-red-700" : "text-primary"
                }`}
              >
                {value}
              </dd>
            </div>
          );
        })}
      </dl>

      {project.is_shared ? (
        <p className="mt-3 text-sm font-medium text-green-700">
          ✅ Shared with Client
        </p>
      ) : isInternal ? (
        <p className="mt-3 text-xs text-muted">Not shared with client yet</p>
      ) : null}
    </div>
  );
}
