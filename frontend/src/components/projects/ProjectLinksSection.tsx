"use client";

import type { TaskLink } from "@/lib/tasks/types";
import { linkTypeIcon, linkTypeLabel } from "@/lib/tasks/taskLinks";
import { ui } from "@/lib/ui/classes";

type ProjectLinksSectionProps = {
  links: TaskLink[];
  canEdit?: boolean;
  onManage?: () => void;
};

export default function ProjectLinksSection({
  links,
  canEdit = false,
  onManage,
}: ProjectLinksSectionProps) {
  return (
    <div className="mt-4 border-t border-border pt-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          Project Links
        </p>
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
      <p className="mt-1 text-xs text-muted">
        Websites, SharePoint, OneDrive, documents, photos, and Outlook emails.
      </p>
      {links.length === 0 ? (
        <p className="mt-2 text-sm text-muted">No project links yet.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {links.slice(0, 4).map((link) => (
            <li key={link.id}>
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-md px-1 py-0.5 text-sm text-primary hover:bg-background hover:text-accent"
                title={link.url}
              >
                <span className="flex items-center gap-1.5 font-medium">
                  <span aria-hidden>{linkTypeIcon(link.type)}</span>
                  <span className="truncate">{link.name}</span>
                </span>
                <span className="mt-0.5 block text-xs text-muted">
                  {linkTypeLabel(link.type)}
                </span>
              </a>
            </li>
          ))}
          {links.length > 4 ? (
            <li className="text-xs text-muted">+{links.length - 4} more</li>
          ) : null}
        </ul>
      )}
    </div>
  );
}
