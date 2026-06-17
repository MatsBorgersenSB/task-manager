"use client";

import { useEffect, useState } from "react";
import type { Task, TaskLink, TaskLinkType } from "@/lib/tasks/types";
import {
  createTaskLinkId,
  extractFileName,
  inferLinkType,
  linkTypeLabel,
} from "@/lib/tasks/taskLinks";
import { ui } from "@/lib/ui/classes";

const LINK_TYPE_OPTIONS: TaskLinkType[] = ["file", "folder", "image", "link"];

type TaskLinksModalProps = {
  open: boolean;
  task: Task | null;
  saving?: boolean;
  onClose: () => void;
  onSave: (task: Task, links: TaskLink[]) => void | Promise<void>;
};

type DraftLink = {
  name: string;
  url: string;
  type: TaskLinkType;
};

const EMPTY_DRAFT: DraftLink = {
  name: "",
  url: "",
  type: "link",
};

export default function TaskLinksModal({
  open,
  task,
  saving = false,
  onClose,
  onSave,
}: TaskLinksModalProps) {
  const [links, setLinks] = useState<TaskLink[]>([]);
  const [draft, setDraft] = useState<DraftLink>(EMPTY_DRAFT);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !task) return;
    setLinks(task.links ?? []);
    setDraft(EMPTY_DRAFT);
    setError(null);
  }, [open, task]);

  if (!open || !task) return null;

  function handleUrlChange(url: string) {
    setDraft((prev) => ({
      ...prev,
      url,
      type: url.trim() ? inferLinkType(url) : prev.type,
    }));
  }

  function handleAddLink() {
    let name = draft.name.trim();
    const url = draft.url.trim();
    if (!url) {
      setError("URL is required.");
      return;
    }

    if (!name) {
      name = extractFileName(url);
    }

    setLinks((prev) => [
      ...prev,
      {
        id: createTaskLinkId(),
        name,
        url,
        type: draft.type,
      },
    ]);
    setDraft(EMPTY_DRAFT);
    setError(null);
  }

  function handleRemoveLink(linkId: string) {
    setLinks((prev) => prev.filter((link) => link.id !== linkId));
  }

  async function handleSave() {
    setError(null);
    try {
      await onSave(task, links);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save links.");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-links-modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-primary/60 backdrop-blur-sm"
        aria-label="Close dialog"
        onClick={saving ? undefined : onClose}
      />
      <div className={`relative w-full max-w-lg p-6 ${ui.card}`}>
        <h3 id="task-links-modal-title" className={ui.sectionTitle}>
          Links — Task #{task.id}
        </h3>
        <p className="mt-1 text-sm text-muted">
          Add OneDrive folders, files, or URLs. Visible in Internal View only.
        </p>

        {links.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No links yet.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {links.map((link) => (
              <li
                key={link.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-primary">
                    {link.name}
                  </p>
                  <p className="truncate text-xs text-muted">{link.url}</p>
                  <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted">
                    {linkTypeLabel(link.type)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={ui.btnSecondarySm}
                  >
                    Open
                  </a>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleRemoveLink(link.id)}
                    className={ui.btnDanger}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-5 space-y-3 rounded-lg border border-dashed border-border bg-background/60 p-4">
          <p className="text-sm font-medium text-primary">Add link</p>
          <div>
            <label className={ui.label} htmlFor="task-link-name">
              Name
            </label>
            <input
              id="task-link-name"
              type="text"
              value={draft.name}
              disabled={saving}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, name: event.target.value }))
              }
              placeholder="e.g. Commissioning folder"
              className={ui.input}
            />
          </div>
          <div>
            <label className={ui.label} htmlFor="task-link-url">
              URL
            </label>
            <input
              id="task-link-url"
              type="url"
              value={draft.url}
              disabled={saving}
              onChange={(event) => handleUrlChange(event.target.value)}
              placeholder="https://..."
              className={ui.input}
            />
          </div>
          <div>
            <label className={ui.label} htmlFor="task-link-type">
              Type
            </label>
            <select
              id="task-link-type"
              value={draft.type}
              disabled={saving}
              onChange={(event) =>
                setDraft((prev) => ({
                  ...prev,
                  type: event.target.value as TaskLinkType,
                }))
              }
              className={ui.input}
            >
              {LINK_TYPE_OPTIONS.map((type) => (
                <option key={type} value={type}>
                  {linkTypeLabel(type)}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={handleAddLink}
            className={ui.btnSecondarySm}
          >
            Add to list
          </button>
        </div>

        {error ? (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className={ui.btnSecondary}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className={ui.btnPrimary}
          >
            {saving ? "Saving…" : "Save links"}
          </button>
        </div>
      </div>
    </div>
  );
}
