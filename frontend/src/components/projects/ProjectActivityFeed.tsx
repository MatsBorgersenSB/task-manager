"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchProjectActivity,
  formatProjectActivityDate,
  type ProjectActivityEntry,
} from "@/lib/tasks/projectActivity";
import type { TaskViewMode } from "@/lib/tasks/types";
import { ui } from "@/lib/ui/classes";

type ActivityTab = "all" | "client";

const CLIENT_EVENT_TYPES = new Set([
  "client_comment_added",
  "client_task_opened",
  "client_project_viewed",
  "client_acknowledged",
]);

type ProjectActivityFeedProps = {
  projectId: string;
  mode: TaskViewMode;
};

function activityHeadline(entry: ProjectActivityEntry): string {
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

export default function ProjectActivityFeed({
  projectId,
  mode,
}: ProjectActivityFeedProps) {
  const [tab, setTab] = useState<ActivityTab>("all");
  const [showAll, setShowAll] = useState(false);
  const [entries, setEntries] = useState<ProjectActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tableMissing, setTableMissing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await fetchProjectActivity(projectId, mode, 50);
      setEntries(result.entries);
      setTableMissing(result.tableMissing);
      setLoadError(result.error);
    } catch (err) {
      setEntries([]);
      setTableMissing(false);
      setLoadError(
        err instanceof Error ? err.message : "Failed to load activity."
      );
    } finally {
      setLoading(false);
    }
  }, [mode, projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredEntries = useMemo(() => {
    if (tab === "client") {
      return entries.filter((entry) => CLIENT_EVENT_TYPES.has(entry.event_type));
    }
    return entries;
  }, [entries, tab]);

  const visibleEntries = showAll
    ? filteredEntries
    : filteredEntries.slice(0, 8);
  const hasMore = filteredEntries.length > 8;

  if (loading) {
    return <p className="text-sm text-muted">Loading activity…</p>;
  }

  if (loadError) {
    return <p className="text-sm text-red-700">{loadError}</p>;
  }

  if (tableMissing) {
    return (
      <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
        Activity tracking is not set up yet. Run migration{" "}
        <code className="text-xs">043_client_collaboration.sql</code> in Supabase.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1">
        <button
          type="button"
          onClick={() => {
            setTab("all");
            setShowAll(false);
          }}
          className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
            tab === "all"
              ? "bg-primary text-white"
              : "bg-slate-100 text-muted hover:text-primary"
          }`}
          aria-pressed={tab === "all"}
        >
          All
        </button>
        <button
          type="button"
          onClick={() => {
            setTab("client");
            setShowAll(false);
          }}
          className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
            tab === "client"
              ? "bg-primary text-white"
              : "bg-slate-100 text-muted hover:text-primary"
          }`}
          aria-pressed={tab === "client"}
        >
          Client
        </button>
      </div>

      {filteredEntries.length === 0 ? (
        <p className="text-sm text-muted">No activity yet.</p>
      ) : (
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
                  {activityHeadline(entry)}
                </p>
                {entry.task_number != null ? (
                  <p className="mt-0.5 text-xs text-muted">
                    #{entry.task_number}{" "}
                    {entry.task_title ? entry.task_title : ""}
                  </p>
                ) : null}
                {entry.detail ? (
                  <p className="mt-1 rounded-md bg-slate-50 px-2 py-1 text-xs text-primary/90">
                    {entry.detail}
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
              {showAll ? "Show less" : `View all (${filteredEntries.length})`}
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}
