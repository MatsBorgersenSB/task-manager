"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchProjectActivity,
  formatProjectActivityDate,
  type ProjectActivityEntry,
} from "@/lib/tasks/projectActivity";
import type { TaskViewMode } from "@/lib/tasks/types";
import { ui } from "@/lib/ui/classes";

type CollapsibleRecentUpdatesProps = {
  projectId: string;
  mode: TaskViewMode;
  defaultCollapsed?: boolean;
  /** When true, render feed content only (parent handles collapse). */
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

function RecentUpdatesContent({
  projectId,
  mode,
}: {
  projectId: string;
  mode: TaskViewMode;
}) {
  const [showAll, setShowAll] = useState(false);
  const [entries, setEntries] = useState<ProjectActivityEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await fetchProjectActivity(projectId, mode, 40);
      setEntries(result.entries);
      setLoadError(result.error);
      setHasLoaded(true);
    } catch (err) {
      setEntries([]);
      setLoadError(
        err instanceof Error ? err.message : "Failed to load recent updates."
      );
      setHasLoaded(true);
    } finally {
      setLoading(false);
    }
  }, [mode, projectId]);

  useEffect(() => {
    if (!hasLoaded) {
      void load();
    }
  }, [hasLoaded, load]);

  const visibleEntries = showAll ? entries : entries.slice(0, 5);
  const hasMore = entries.length > 5;

  if (loading) {
    return <p className="text-sm text-muted">Loading…</p>;
  }

  if (loadError) {
    return <p className="text-sm text-red-700">{loadError}</p>;
  }

  if (entries.length === 0) {
    return <p className="text-sm text-muted">No activity yet.</p>;
  }

  return (
    <>
      <ul className="space-y-2.5">
        {visibleEntries.map((entry) => (
          <li
            key={entry.id}
            className="border-b border-border/50 pb-2 last:border-b-0 last:pb-0"
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
              {formatProjectActivityDate(entry.created_at)}
            </p>
            <p className="mt-0.5 text-sm font-medium text-primary">
              {feedHeadline(entry)}
            </p>
            {entry.task_number != null ? (
              <p className="mt-0.5 text-xs text-muted">
                #{entry.task_number}{" "}
                {entry.task_title ? entry.task_title : ""}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
      {hasMore ? (
        <button
          type="button"
          onClick={() => setShowAll((prev) => !prev)}
          className={`mt-2 ${ui.btnGhost} w-full py-1.5 text-xs`}
        >
          {showAll ? "Show less" : "View All"}
        </button>
      ) : null}
    </>
  );
}

export default function CollapsibleRecentUpdates({
  projectId,
  mode,
  defaultCollapsed = true,
  embedded = false,
}: CollapsibleRecentUpdatesProps) {
  const [expanded, setExpanded] = useState(!defaultCollapsed);

  if (embedded) {
    return <RecentUpdatesContent projectId={projectId} mode={mode} />;
  }

  return (
    <div className="rounded-lg border border-border/80 bg-slate-50/50">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted transition hover:bg-slate-100/80"
        aria-expanded={expanded}
      >
        <span>Recent Updates</span>
        <span aria-hidden>{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded ? (
        <div className="border-t border-border/70 px-3 pb-3 pt-2">
          <RecentUpdatesContent projectId={projectId} mode={mode} />
        </div>
      ) : null}
    </div>
  );
}
