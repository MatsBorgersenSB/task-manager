"use client";

import UserAvatar from "@/components/shared/UserAvatar";
import {
  formatProjectFeedEditLine,
  formatProjectFeedHeadline,
} from "@/lib/tasks/feedFormatting";
import {
  formatProjectActivityDate,
  type ProjectActivityEntry,
} from "@/lib/tasks/projectActivity";
import { formatPanelTimestamp } from "@/lib/tasks/taskPanel";

type ProjectFeedEntryRowProps = {
  entry: ProjectActivityEntry;
  compact?: boolean;
};

export default function ProjectFeedEntryRow({
  entry,
  compact = false,
}: ProjectFeedEntryRowProps) {
  const headline = formatProjectFeedHeadline(entry);
  const editLine = formatProjectFeedEditLine(entry);
  const authorName = entry.author_name ?? "Unknown user";

  return (
    <li
      className={
        compact
          ? "border-b border-border/50 pb-2 last:border-b-0 last:pb-0"
          : "border-b border-border/70 pb-4 last:border-b-0 last:pb-0"
      }
    >
      <div className="flex items-start gap-2.5">
        <UserAvatar
          name={authorName}
          email={entry.author_email}
          size={compact ? "sm" : "md"}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-primary">{headline}</p>
          {entry.task_number != null ? (
            <p className="mt-0.5 text-xs text-muted">
              #{entry.task_number}{" "}
              {entry.task_title ? entry.task_title : ""}
            </p>
          ) : null}
          {entry.detail ? (
            <p className="mt-1.5 rounded-md bg-slate-50 px-2 py-1.5 text-xs text-primary/90">
              {entry.detail}
            </p>
          ) : null}
          <p className="mt-1.5 text-[11px] text-muted">
            {formatPanelTimestamp(entry.created_at)}
            {editLine ? (
              <>
                {" · "}
                {editLine}
                {entry.updated_at
                  ? ` · ${formatProjectActivityDate(entry.updated_at)}`
                  : ""}
              </>
            ) : null}
          </p>
        </div>
      </div>
    </li>
  );
}
