"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchProjectActivity,
  formatProjectActivityDate,
  type ProjectActivityEntry,
} from "@/lib/tasks/projectActivity";
import { DashboardSectionHideButton } from "@/components/projects/DashboardSectionControls";

type ClientActivityPanelProps = {
  projectId: string;
  onHide?: () => void;
  embedded?: boolean;
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

function ClientActivityContent({
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
        Could not load client activity: {loadError}
      </p>
    );
  }

  if (tableMissing) {
    return (
      <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
        Client activity tracking is not set up yet. Run migration{" "}
        <code className="text-xs">043_client_collaboration.sql</code> in Supabase.
      </p>
    );
  }

  if (entries.length === 0) {
    return <p className="text-sm text-muted">No client activity recorded yet.</p>;
  }

  return (
    <ul className="space-y-4">
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
  );
}

export default function ClientActivityPanel({
  projectId,
  onHide,
  embedded = false,
}: ClientActivityPanelProps) {
  const [entries, setEntries] = useState<ProjectActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await fetchProjectActivity(projectId, "internal", 30);
      const clientOnly = result.entries.filter((entry) =>
        CLIENT_EVENT_TYPES.has(entry.event_type)
      );
      setEntries(clientOnly);
      setTableMissing(result.tableMissing);
      setLoadError(result.error);
    } catch (err) {
      setEntries([]);
      setTableMissing(false);
      setLoadError(err instanceof Error ? err.message : "Failed to load client activity.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const content = (
    <ClientActivityContent
      loading={loading}
      loadError={loadError}
      tableMissing={tableMissing}
      entries={entries}
    />
  );

  if (embedded) {
    return <div className="text-violet-950">{content}</div>;
  }

  return (
    <section
      className="no-print rounded-xl border border-violet-200 bg-violet-50/40 px-4 py-4 shadow-sm sm:px-5"
      aria-label="Client Activity"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-violet-900/70">
          Client Activity
        </h3>
        {onHide ? (
          <DashboardSectionHideButton label="Client Activity" onHide={onHide} />
        ) : null}
      </div>
      <div className="mt-3">{content}</div>
    </section>
  );
}
