"use client";

import { useState } from "react";
import AppModal from "@/components/shared/AppModal";
import { ui } from "@/lib/ui/classes";

type CreateProjectModalProps = {
  open: boolean;
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
  onCreate: (name: string, description: string) => void;
};

export default function CreateProjectModal({
  open,
  loading = false,
  error = null,
  onClose,
  onCreate,
}: CreateProjectModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  if (!open) return null;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    onCreate(name, description);
  }

  return (
    <AppModal
      open={open}
      onClose={onClose}
      disableClose={loading}
      ariaLabelledBy="create-project-title"
      panelClassName="max-w-lg"
    >
      <form
        onSubmit={handleSubmit}
        className={`p-6 ${ui.card}`}
      >
        <h3 id="create-project-title" className={ui.sectionTitle}>
          Create project
        </h3>
        <p className="mt-2 text-sm text-muted">
          Tasks are grouped by project. Internal users can share projects with clients.
        </p>

        <label className={`${ui.label} mt-4`} htmlFor="project-name">
          Project name
        </label>
        <input
          id="project-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className={ui.input}
          placeholder="Project A"
          disabled={loading}
          required
        />

        <label className={`${ui.label} mt-4`} htmlFor="project-description">
          Description
        </label>
        <textarea
          id="project-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className={`${ui.input} ${ui.textarea}`}
          placeholder="Optional description"
          disabled={loading}
        />

        {error ? <p className="mt-3 text-xs text-red-600">{error}</p> : null}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className={ui.btnSecondary}
          >
            Cancel
          </button>
          <button type="submit" disabled={loading} className={ui.btnPrimary}>
            {loading ? "Creating…" : "Create project"}
          </button>
        </div>
      </form>
    </AppModal>
  );
}
