"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchProjectActivity,
  formatProjectActivityDate,
  type ProjectActivityEntry,
} from "@/lib/tasks/projectActivity";

type ClientActivityPanelProps = {
  projectId: string;
};

const CLIENT_EVENT_TYPES = new Set([
  "client_comment_added",
  "client_task_opened",
  "client_project_viewed",
  "client_acknowledged",
]);

function clientActivityHeadline(entry: ProjectActivityEntry): string {
  switch (entry.event_type) {
    case "client_comment_added":
      return "Client added comment";
    case "client_task_opened":
      return entry.summary;
    case "client_project_viewed":
      return "Client viewed project";
    case "client_acknowledged":
      return "Client acknowledged completion";
    default:
      return entry.summary;
  }
}

export default function ClientActivityPanel({ projectId }: ClientActivityPanelProps) {
  const [entries, setEntries] = useState<ProjectActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchProjectActivity(projectId, "internal", 30);
      const clientOnly = result.entries.filter((entry) =>
        CLIENT_EVENT_TYPES.has(entry.event_type)
      );
      setEntries(clientOnly);
      setTableMissing(result.tableMissing);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section
      className="no-print rounded-xl border border-violet-200 bg-violet-50/40 px-4 py-4 shadow-sm sm:px-5"
      aria-label="Client Activity"
    >
      <h3 className="text-sm font-semibold uppercase tracking-wide text-violet-900/70">
        Client Activity
      </h3>

      {loading ? (
        <p className="mt-3 text-sm text-muted">Loading…</p>
      ) : tableMissing ? (
        <p className="mt-3 text-sm text-muted">Client activity tracking not available yet.</p>
      ) : entries.length === 0 ? (
        <p className="mt-3 text-sm text-muted">No client activity recorded yet.</p>
      ) : (
        <ul className="mt-3 space-y-4">
          {entries.slice(0, 8).map((entry) => (
            <li
              key={entry.id}
              className="border-b border-violet-200/60 pb-4 last:border-b-0 last:pb-0"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-violet-800/60">
                {formatProjectActivityDate(entry.created_at)}
              </p>
              <p className="mt-1 text-sm font-medium text-violet-950">
                {clientActivityHeadline(entry)}
              </p>
              {entry.detail ? (
                <p className="mt-2 rounded-md bg-white/80 px-2 py-1.5 text-xs text-violet-950/90">
                  &ldquo;{entry.detail}&rdquo;
                </p>
              ) : null}
              {entry.task_number != null && entry.event_type === "client_task_opened" ? (
                <p className="mt-1 text-xs text-violet-800/70">
                  #{entry.task_number} {entry.task_title ?? ""}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
