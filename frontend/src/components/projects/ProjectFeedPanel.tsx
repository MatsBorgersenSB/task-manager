"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchProjectActivity,
  formatProjectActivityDate,
  type ProjectActivityEntry,
} from "@/lib/tasks/projectActivity";
import type { TaskViewMode } from "@/lib/tasks/types";

type ProjectFeedPanelProps = {
  projectId: string;
  mode: TaskViewMode;
};

function feedHeadline(entry: ProjectActivityEntry): string {
  switch (entry.event_type) {
    case "task_created":
      return "Task created";
    case "due_date_changed":
      return "Due date changed";
    case "client_comment_added":
      return "Client comment added";
    case "internal_comment_added":
      return "Internal note added";
    case "subtask_completed":
      return "Subtask completed";
    case "project_shared":
      return "Project shared with client";
    case "link_added":
      return "Link added";
    case "client_task_opened":
      return entry.summary;
    case "client_project_viewed":
      return "Client viewed project";
    case "client_acknowledged":
      return "Client acknowledged completion";
    case "status_changed":
      return "Status changed";
    case "task_completed":
      return "Task completed";
    default:
      return entry.summary;
  }
}

export default function ProjectFeedPanel({ projectId, mode }: ProjectFeedPanelProps) {
  const [entries, setEntries] = useState<ProjectActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchProjectActivity(projectId, mode, 40);
      setEntries(result.entries);
      setTableMissing(result.tableMissing);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [mode, projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const title = mode === "client" ? "Recent Updates" : "Project Feed";

  return (
    <section
      className="no-print rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5"
      aria-label={title}
    >
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
        {title}
      </h3>

      {loading ? (
        <p className="mt-3 text-sm text-muted">Loading…</p>
      ) : tableMissing ? (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Project feed is not set up yet. Run migration{" "}
          <code className="text-xs">043_client_collaboration.sql</code>.
        </p>
      ) : entries.length === 0 ? (
        <p className="mt-3 text-sm text-muted">No activity yet.</p>
      ) : (
        <ul className="mt-3 space-y-4">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="border-b border-border/70 pb-4 last:border-b-0 last:pb-0"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                {formatProjectActivityDate(entry.created_at)}
              </p>
              <p className="mt-1 text-sm font-medium text-primary">
                {feedHeadline(entry)}
              </p>
              {entry.task_number != null ? (
                <p className="mt-1 text-xs text-muted">
                  #{entry.task_number}{" "}
                  {entry.task_title ? entry.task_title : ""}
                </p>
              ) : null}
              {entry.detail ? (
                <p className="mt-2 rounded-md bg-slate-50 px-2 py-1.5 text-xs text-primary/90">
                  {entry.detail}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
