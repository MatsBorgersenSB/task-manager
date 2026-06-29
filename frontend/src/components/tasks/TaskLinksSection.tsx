"use client";

import type { TaskLink } from "@/lib/tasks/types";
import {
  linkTypeIcon,
  linkTypeLabel,
} from "@/lib/tasks/taskLinks";
import { ui } from "@/lib/ui/classes";

type TaskLinksSectionProps = {
  links: TaskLink[];
  canEdit?: boolean;
  onManage?: () => void;
};

export default function TaskLinksSection({
  links,
  canEdit = false,
  onManage,
}: TaskLinksSectionProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-primary">Links</p>
        {onManage ? (
          <button type="button" onClick={onManage} className={ui.btnSecondarySm}>
            {canEdit ? "Manage links" : "View links"}
          </button>
        ) : null}
      </div>
      <p className="text-xs text-muted">
        Link to SharePoint, OneDrive, Outlook, or documents — no file uploads.
      </p>
      {links.length === 0 ? (
        <p className="text-sm text-muted">No links yet.</p>
      ) : (
        <ul className="space-y-2">
          {links.map((link) => (
            <li
              key={link.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-primary">
                  <span aria-hidden className="mr-1.5">
                    {linkTypeIcon(link.type)}
                  </span>
                  {link.name}
                </p>
                <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted">
                  {linkTypeLabel(link.type)}
                </p>
              </div>
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className={ui.btnSecondarySm}
              >
                Open
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
