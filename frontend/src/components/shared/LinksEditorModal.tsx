"use client";

import { useEffect, useState } from "react";
import type { TaskLink, TaskLinkType } from "@/lib/tasks/types";
import {
  createTaskLinkId,
  extractFileName,
  inferLinkType,
  LINK_TYPE_EXAMPLES,
  LINK_TYPE_OPTIONS,
  linkTypeIcon,
  linkTypeLabel,
} from "@/lib/tasks/taskLinks";
import { ui } from "@/lib/ui/classes";

type LinksEditorModalProps = {
  open: boolean;
  title: string;
  description?: string;
  links: TaskLink[];
  readOnly?: boolean;
  saving?: boolean;
  onClose: () => void;
  onSave: (links: TaskLink[]) => void | Promise<void>;
};

type DraftLink = {
  name: string;
  url: string;
  type: TaskLinkType;
};

const EMPTY_DRAFT: DraftLink = {
  name: "",
  url: "",
  type: "document",
};

export default function LinksEditorModal({
  open,
  title,
  description = "Store links to SharePoint, OneDrive, Outlook, and photos. Documents stay in Microsoft 365.",
  links: initialLinks,
  readOnly = false,
  saving = false,
  onClose,
  onSave,
}: LinksEditorModalProps) {
  const [links, setLinks] = useState<TaskLink[]>([]);
  const [draft, setDraft] = useState<DraftLink>(EMPTY_DRAFT);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLinks(initialLinks);
    setDraft(EMPTY_DRAFT);
    setError(null);
  }, [open, initialLinks]);

  if (!open) return null;

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
    if (!name) name = extractFileName(url);

    setLinks((prev) => [
      ...prev,
      { id: createTaskLinkId(), name, url, type: draft.type },
    ]);
    setDraft(EMPTY_DRAFT);
    setError(null);
  }

  async function handleSave() {
    setError(null);
    try {
      await onSave(links);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save links.");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        className="absolute inset-0 bg-primary/60 backdrop-blur-sm"
        aria-label="Close dialog"
        onClick={saving ? undefined : onClose}
      />
      <div className={`relative w-full max-w-lg p-6 ${ui.card}`}>
        <h3 className={ui.sectionTitle}>{title}</h3>
        <p className="mt-1 text-sm text-muted">{description}</p>

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
                    <span aria-hidden className="mr-1">
                      {linkTypeIcon(link.type)}
                    </span>
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
                  {!readOnly ? (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() =>
                        setLinks((prev) =>
                          prev.filter((item) => item.id !== link.id)
                        )
                      }
                      className={ui.btnDanger}
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}

        {!readOnly ? (
          <div className="mt-5 space-y-3 rounded-lg border border-dashed border-border bg-background/60 p-4">
            <p className="text-sm font-medium text-primary">Add link</p>
            <div>
              <label className={ui.label} htmlFor="link-title">
                Title
              </label>
              <input
                id="link-title"
                type="text"
                value={draft.name}
                disabled={saving}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder="e.g. Burner Test Report"
                className={ui.input}
              />
            </div>
            <div>
              <label className={ui.label} htmlFor="link-url">
                URL
              </label>
              <input
                id="link-url"
                type="url"
                value={draft.url}
                disabled={saving}
                onChange={(event) => handleUrlChange(event.target.value)}
                placeholder="https://..."
                className={ui.input}
              />
            </div>
            <div>
              <label className={ui.label} htmlFor="link-type">
                Type
              </label>
              <select
                id="link-type"
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
                    {linkTypeIcon(type)} {linkTypeLabel(type)} —{" "}
                    {LINK_TYPE_EXAMPLES[type]}
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
        ) : null}

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
            {readOnly ? "Close" : "Cancel"}
          </button>
          {!readOnly ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave()}
              className={ui.btnPrimary}
            >
              {saving ? "Saving…" : "Save links"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
