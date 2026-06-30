"use client";

import { useState } from "react";
import type { TaskLink } from "@/lib/tasks/types";
import {
  linkTypeIcon,
  linkTypeLabel,
} from "@/lib/tasks/taskLinks";
import { ui } from "@/lib/ui/classes";

type CollapsibleProjectLinksProps = {
  links: TaskLink[];
  canEdit?: boolean;
  onManage?: () => void;
  defaultCollapsed?: boolean;
  /** When true, render links list only (parent handles collapse). */
  embedded?: boolean;
};

function ProjectLinksContent({ links }: { links: TaskLink[] }) {
  if (links.length === 0) {
    return <p className="text-sm text-muted">No project links yet.</p>;
  }

  return (
    <ul className="space-y-1.5">
      {links.slice(0, 4).map((link) => (
        <li key={link.id}>
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex max-w-full items-center gap-1.5 truncate text-sm text-primary hover:text-accent"
            title={link.url}
          >
            <span aria-hidden>{linkTypeIcon(link.type)}</span>
            <span className="truncate font-medium">{link.name}</span>
            <span className="shrink-0 text-[10px] uppercase text-muted">
              {linkTypeLabel(link.type)}
            </span>
          </a>
        </li>
      ))}
      {links.length > 4 ? (
        <li className="text-xs text-muted">+{links.length - 4} more</li>
      ) : null}
    </ul>
  );
}

export default function CollapsibleProjectLinks({
  links,
  canEdit = false,
  onManage,
  defaultCollapsed = true,
  embedded = false,
}: CollapsibleProjectLinksProps) {
  const [expanded, setExpanded] = useState(!defaultCollapsed);

  if (links.length === 0 && !canEdit && embedded) {
    return <p className="text-sm text-muted">No project links yet.</p>;
  }

  if (links.length === 0 && !canEdit) {
    return null;
  }

  if (embedded) {
    return <ProjectLinksContent links={links} />;
  }

  return (
    <div className="rounded-lg border border-border/80 bg-slate-50/50">
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left text-xs font-semibold uppercase tracking-wide text-muted transition hover:text-primary"
          aria-expanded={expanded}
        >
          <span>
            Project Links
            {links.length > 0 ? (
              <span className="ml-1.5 font-normal normal-case text-muted">
                ({links.length})
              </span>
            ) : null}
          </span>
          <span aria-hidden>{expanded ? "▲" : "▼"}</span>
        </button>
        {canEdit && onManage ? (
          <button type="button" onClick={onManage} className={ui.btnSecondarySm}>
            Manage
          </button>
        ) : onManage && links.length > 0 ? (
          <button type="button" onClick={onManage} className={ui.btnSecondarySm}>
            View all
          </button>
        ) : null}
      </div>

      {expanded ? (
        <div className="border-t border-border/70 px-3 pb-3 pt-2">
          <ProjectLinksContent links={links} />
        </div>
      ) : null}
    </div>
  );
}
