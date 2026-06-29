"use client";

import TaskPanelSection from "@/components/tasks/TaskPanelSection";
import {
  formatHistoryDate,
  formatHistoryHeadline,
  formatPanelTimestamp,
  useTaskActivity,
} from "@/lib/tasks/activity";
import type { TaskViewMode } from "@/lib/tasks/types";

type TaskActivitySectionProps = {
  taskId: string;
  mode?: TaskViewMode;
  createdAt?: string | null;
  updatedAt?: string | null;
  updatedBy?: string | null;
  refreshKey?: string | null;
};

function displayHistoryValue(value: string | null | undefined): string {
  if (value == null || value.trim() === "") return "—";
  return value.trim();
}

export default function TaskActivitySection({
  taskId,
  mode = "internal",
  createdAt,
  updatedAt,
  updatedBy,
  refreshKey,
}: TaskActivitySectionProps) {
  const { logs, loading, error, tableMissing } = useTaskActivity(
    taskId,
    mode,
    refreshKey
  );

  return (
    <TaskPanelSection title="History">
      {mode === "internal" ? (
        <dl className="mb-4 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Created at</dt>
            <dd className="text-right text-primary">
              {formatPanelTimestamp(createdAt)}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Updated at</dt>
            <dd className="text-right text-primary">
              {formatPanelTimestamp(updatedAt)}
            </dd>
          </div>
          {updatedBy ? (
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Last updated by</dt>
              <dd className="text-right text-primary">{updatedBy}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted">Loading history…</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : tableMissing ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          History is not set up yet. Run migration{" "}
          <code className="text-xs">042_task_activity_events.sql</code> in Supabase.
        </p>
      ) : logs.length === 0 ? (
        <p className="text-sm text-muted">No history recorded yet.</p>
      ) : (
        <ul className="space-y-4">
          {logs.map((log) => (
            <li
              key={log.id}
              className="border-b border-border/70 pb-4 last:border-b-0 last:pb-0"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                {formatHistoryDate(log.created_at)}
              </p>
              <p className="mt-1 text-sm font-medium text-primary">
                {formatHistoryHeadline(log)}
              </p>
              {log.event_type === "field_change" ||
              log.event_type === "status_changed" ||
              log.event_type === "due_date_changed" ||
              log.event_type === "responsible_changed" ? (
                <div className="mt-2 space-y-1 text-xs text-muted">
                  <p>
                    <span className="font-semibold text-primary/80">Old:</span>{" "}
                    {displayHistoryValue(log.old_value)}
                  </p>
                  <p>
                    <span className="font-semibold text-primary/80">New:</span>{" "}
                    {displayHistoryValue(log.new_value)}
                  </p>
                </div>
              ) : log.new_value ? (
                <p className="mt-2 text-xs text-muted">{log.new_value}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </TaskPanelSection>
  );
}
