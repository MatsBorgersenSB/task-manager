"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchProjectActivity,
  formatProjectActivityDate,
  type ProjectActivityEntry,
} from "@/lib/tasks/projectActivity";
import type { TaskViewMode } from "@/lib/tasks/types";
import { DashboardSectionHideButton } from "@/components/projects/DashboardSectionControls";

type ProjectFeedPanelProps = {
  projectId: string;
  mode: TaskViewMode;
  onHide?: () => void;
  embedded?: boolean;
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

function ProjectFeedContent({
  loading,
  loadError,
  tableMissing,
  entries,
}: {
  loading: boolean;
  loadError: string | null;
  tableMissing: boolean;
  entries: ProjectActivityEntry[];
}) {
  if (loading) {
    return <p className="text-sm text-muted">Loading…</p>;
  }

  if (loadError) {
    return (
      <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
        Could not load project feed: {loadError}
      </p>
    );
  }

  if (tableMissing) {
    return (
      <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
        Project feed is not set up yet. Run migration{" "}
        <code className="text-xs">043_client_collaboration.sql</code> in Supabase.
      </p>
    );
  }

  if (entries.length === 0) {
    return <p className="text-sm text-muted">No activity yet.</p>;
  }

  return (
    <ul className="space-y-4">
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
  );
}

export default function ProjectFeedPanel({
  projectId,
  mode,
  onHide,
  embedded = false,
}: ProjectFeedPanelProps) {
  const [entries, setEntries] = useState<ProjectActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await fetchProjectActivity(projectId, mode, 40);
      setEntries(result.entries);
      setTableMissing(result.tableMissing);
      setLoadError(result.error);
    } catch (err) {
      setEntries([]);
      setTableMissing(false);
      setLoadError(err instanceof Error ? err.message : "Failed to load project feed.");
    } finally {
      setLoading(false);
    }
  }, [mode, projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const title = mode === "client" ? "Recent Updates" : "Project Feed";

  const content = (
    <ProjectFeedContent
      loading={loading}
      loadError={loadError}
      tableMissing={tableMissing}
      entries={entries}
    />
  );

  if (embedded) {
    return content;
  }

  return (
    <section
      className="no-print rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5"
      aria-label={title}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
          {title}
        </h3>
        {onHide ? (
          <DashboardSectionHideButton label={title} onHide={onHide} />
        ) : null}
      </div>
      <div className="mt-3">{content}</div>
    </section>
  );
}
