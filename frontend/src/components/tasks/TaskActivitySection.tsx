"use client";

import TaskPanelSection from "@/components/tasks/TaskPanelSection";
import {
  formatActivityEntry,
  formatPanelTimestamp,
  useTaskActivity,
} from "@/lib/tasks/activity";

type TaskActivitySectionProps = {
  taskId: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  refreshKey?: string | null;
};

export default function TaskActivitySection({
  taskId,
  createdAt,
  updatedAt,
  refreshKey,
}: TaskActivitySectionProps) {
  const { logs, loading, error } = useTaskActivity(taskId, refreshKey);

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
      </dl>

      <div className="mt-4 border-t border-border pt-4">
        {loading ? (
          <p className="text-sm text-muted">Loading activity…</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : logs.length === 0 ? (
          <p className="text-sm text-muted">No changes recorded yet.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm text-muted">
            {logs.map((log) => (
              <li key={log.id}>
                <p className="text-xs text-muted/80">
                  {formatPanelTimestamp(log.created_at)}
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
