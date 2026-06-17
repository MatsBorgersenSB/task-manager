"use client";

import type { Task, TaskLink } from "@/lib/tasks/types";
import { linkTypeLabel } from "@/lib/tasks/taskLinks";
import { ui } from "@/lib/ui/classes";

type TaskLinksCellProps = {
  task: Task;
  onManageLinks: (task: Task) => void;
};

function linkAbbreviation(link: TaskLink): string {
  const label = link.name.trim() || link.url;
  if (label.length <= 14) return label;
  return `${label.slice(0, 12)}…`;
}

export default function TaskLinksCell({
  task,
  onManageLinks,
}: TaskLinksCellProps) {
  const links = task.links ?? [];
  const visibleLinks = links.slice(0, 3);
  const overflow = links.length - visibleLinks.length;

  return (
    <div className="flex flex-wrap items-center gap-1">
      {visibleLinks.map((link) => (
        <a
          key={link.id}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          title={`${linkTypeLabel(link.type)}: ${link.name || link.url}`}
          className={ui.linkPill}
          onClick={(event) => event.stopPropagation()}
        >
          <span aria-hidden className="shrink-0 text-[10px] uppercase text-muted">
            {link.type === "folder"
              ? "DIR"
              : link.type === "file"
                ? "FILE"
                : link.type === "image"
                  ? "IMG"
                  : "URL"}
          </span>
          <span className="truncate">{linkAbbreviation(link)}</span>
        </a>
      ))}

      {overflow > 0 ? (
        <span className="text-xs text-muted">+{overflow}</span>
      ) : null}

      <button
        type="button"
        className={ui.linkPillAdd}
        title="Manage links"
        aria-label="Manage links"
        onClick={(event) => {
          event.stopPropagation();
          onManageLinks(task);
        }}
      >
        +
      </button>
    </div>
  );
}
