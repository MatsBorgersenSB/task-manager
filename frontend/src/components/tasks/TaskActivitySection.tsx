"use client";

import TaskPanelSection from "@/components/tasks/TaskPanelSection";
import {
  formatActivityEntry,
  formatActivityUser,
  formatPanelTimestamp,
  useTaskActivity,
} from "@/lib/tasks/activity";

type TaskActivitySectionProps = {
  taskId: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  updatedBy?: string | null;
  refreshKey?: string | null;
};

export default function TaskActivitySection({
  taskId,
  createdAt,
  updatedAt,
  updatedBy,
  refreshKey,
}: TaskActivitySectionProps) {
  const { logs, loading, error, tableMissing } = useTaskActivity(taskId, refreshKey);

  return (
    <TaskPanelSection title="Activity">
      <dl className="space-y-3 text-sm">
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

      <div className="mt-4 border-t border-border pt-4">
        {loading ? (
          <p className="text-sm text-muted">Loading activity…</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : tableMissing ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Activity history is not set up yet. In Supabase SQL Editor, run migration{" "}
            <code className="text-xs">013_ensure_activity_logs.sql</code> from{" "}
            <code className="text-xs">supabase/migrations/</code>.
          </p>
        ) : logs.length === 0 ? (
          <p className="text-sm text-muted">No changes recorded yet.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm text-muted">
            {logs.map((log) => (
              <li key={log.id}>
                <p className="text-xs text-muted/80">
                  {formatPanelTimestamp(log.created_at)}
                  <span className="text-muted/60"> · </span>
                  <span className="font-medium text-primary">
                    {formatActivityUser(log)}
                  </span>
                </p>
                <p>{formatActivityEntry(log)}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </TaskPanelSection>
  );
}
