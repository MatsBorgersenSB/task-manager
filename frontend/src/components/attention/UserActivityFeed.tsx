"use client";

import Link from "next/link";
import type { UserActivityEntry } from "@/lib/attention/userActivityFeed";
import { formatProjectActivityDate } from "@/lib/tasks/projectActivity";

type UserActivityFeedProps = {
  entries: UserActivityEntry[];
};

function activityHref(entry: UserActivityEntry): string | null {
  if (!entry.project_id) return null;
  const params = new URLSearchParams({ project: entry.project_id });
  if (entry.task_id) params.set("task", entry.task_id);
  return `/internal?${params.toString()}`;
}

export default function UserActivityFeed({ entries }: UserActivityFeedProps) {
  return (
    <section aria-label="Your Activity">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
        Your Activity
      </h3>
      <p className="mt-0.5 text-xs text-muted">Last 7 days · newest first</p>

      {entries.length === 0 ? (
        <p className="mt-3 text-sm text-muted">No recent activity.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {entries.map((entry) => {
            const href = activityHref(entry);
            return (
              <li
                key={entry.id}
                className="rounded-lg border border-border/70 bg-slate-50/60 px-3 py-2"
              >
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                  {formatProjectActivityDate(entry.created_at)}
                </p>
                <p className="mt-0.5 text-sm font-medium text-primary">
                  {entry.summary}
                </p>
                {entry.project_name ? (
                  <p className="mt-0.5 text-xs text-muted">{entry.project_name}</p>
                ) : null}
                {entry.task_number != null ? (
                  <p className="text-xs text-muted">
                    #{entry.task_number} {entry.task_title ?? ""}
                  </p>
                ) : null}
                {href ? (
                  <Link
                    href={href}
                    className="mt-1 inline-block text-xs font-semibold text-accent hover:underline"
                  >
                    Open
                  </Link>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
