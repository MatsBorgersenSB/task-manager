"use client";

import { useEffect, useState } from "react";
import SchemaMigrationNotice from "@/components/admin/SchemaMigrationNotice";
import { useSchemaCapabilities } from "@/hooks/useSchemaCapabilities";
import { fetchLifecycleDashboard } from "@/lib/projects/lifecycleApi";
import type { LifecycleDashboard } from "@/lib/projects/lifecycle";
import { lifecycleActionLabel } from "@/lib/projects/lifecycleDisplay";
import { ui } from "@/lib/ui/classes";

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-2 flex items-center gap-2 text-2xl font-bold text-primary">
        <span aria-hidden>{icon}</span>
        {value}
      </p>
    </div>
  );
}

export default function ProjectLifecycleDashboard() {
  const { capabilities } = useSchemaCapabilities();
  const [data, setData] = useState<LifecycleDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!capabilities?.projectLifecycle) {
      setLoading(false);
      return;
    }
    void fetchLifecycleDashboard()
      .then(setData)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load lifecycle dashboard.")
      )
      .finally(() => setLoading(false));
  }, [capabilities?.projectLifecycle]);

  if (!capabilities?.projectLifecycle) {
    return (
      <SchemaMigrationNotice
        capabilities={capabilities}
        feature="projectLifecycle"
        label="Project lifecycle dashboard"
      />
    );
  }

  if (loading) {
    return <p className="text-sm text-muted">Loading lifecycle dashboard…</p>;
  }

  if (error) {
    return <div className={`p-4 text-sm text-red-700 ${ui.alertError}`}>{error}</div>;
  }

  if (!data) return null;

  return (
    <div className="space-y-8">
      <section>
        <h2 className={ui.sectionTitle}>Project lifecycle overview</h2>
        <p className="mt-2 text-sm text-muted">
          Governed transitions from active through completed, archived, and permanent deletion.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Active projects" value={data.active_count} icon="●" />
          <StatCard label="Completed projects" value={data.completed_count} icon="✅" />
          <StatCard label="Archived projects" value={data.archived_count} icon="📦" />
          <StatCard label="Deleted this month" value={data.deleted_this_month} icon="🗑" />
        </div>
      </section>

      <section className={`p-6 ${ui.card}`}>
        <h3 className="text-sm font-semibold text-primary">Recent lifecycle events</h3>
        {data.recent_events.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No lifecycle events recorded yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {data.recent_events.map((event) => (
              <li key={event.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-medium text-primary">
                    {lifecycleActionLabel(event.action)}
                  </p>
                  <p className="text-sm text-muted">{event.project_name}</p>
                  {event.reason ? (
                    <p className="mt-1 text-xs text-muted">Reason: {event.reason}</p>
                  ) : null}
                </div>
                <time className="text-xs text-muted">
                  {new Date(event.created_at).toLocaleString()}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
