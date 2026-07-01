"use client";

import type { TaskLink } from "@/lib/tasks/types";
import TaskLinkListItem from "@/components/tasks/TaskLinkListItem";
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
        Link to websites, SharePoint, OneDrive, Outlook, or technical documents — no file uploads.
      </p>
      {links.length === 0 ? (
        <p className="text-sm text-muted">No links yet.</p>
      ) : (
        <ul className="space-y-2">
          {links.map((link) => (
            <li key={link.id}>
              <TaskLinkListItem
                link={link}
                actions={
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={ui.btnSecondarySm}
                  >
                    Open
                  </a>
                }
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
