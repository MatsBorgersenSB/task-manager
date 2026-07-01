"use client";

import type { TaskLink } from "@/lib/tasks/types";
import { linkTypeIcon, linkTypeLabel } from "@/lib/tasks/taskLinks";

type TaskLinkListItemProps = {
  link: TaskLink;
  actions?: React.ReactNode;
  showUrl?: boolean;
  className?: string;
};

export default function TaskLinkListItem({
  link,
  actions,
  showUrl = false,
  className = "flex items-start justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2",
}: TaskLinkListItemProps) {
  return (
    <div className={className}>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-primary">
          <span aria-hidden className="mr-1.5">
            {linkTypeIcon(link.type)}
          </span>
          {link.name}
        </p>
        {showUrl ? (
          <p className="truncate text-xs text-muted">{link.url}</p>
        ) : null}
        <p className="mt-0.5 text-xs text-muted">{linkTypeLabel(link.type)}</p>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
