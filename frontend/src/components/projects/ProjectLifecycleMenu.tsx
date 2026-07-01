"use client";

import { useState } from "react";
import ProjectDeleteDialog from "@/components/projects/ProjectDeleteDialog";
import type { Project } from "@/lib/projects/types";
import type { ProjectLifecycleAction } from "@/lib/projects/lifecycle";
import { transitionProjectLifecycle } from "@/lib/projects/lifecycleApi";
import { ui } from "@/lib/ui/classes";

type ProjectLifecycleMenuProps = {
  project: Project;
  isAdmin: boolean;
  onUpdated: (project: Project) => void;
  onDeleted: () => void;
};

export default function ProjectLifecycleMenu({
  project,
  isAdmin,
  onUpdated,
  onDeleted,
}: ProjectLifecycleMenuProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const status = project.project_status ?? "active";

  async function runAction(action: ProjectLifecycleAction) {
    setLoading(true);
    setError(null);
    try {
      const updated = await transitionProjectLifecycle(project.id, action);
      onUpdated(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lifecycle action failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {status === "active" ? (
          <button
            type="button"
            disabled={loading}
            onClick={() => void runAction("complete")}
            className={ui.btnSecondarySm}
          >
            Mark complete
          </button>
        ) : null}
        {status === "active" || status === "completed" ? (
          <button
            type="button"
            disabled={loading}
            onClick={() => void runAction("archive")}
            className={ui.btnSecondarySm}
          >
            Archive project
          </button>
        ) : null}
        {status === "archived" ? (
          <>
            <button
              type="button"
              disabled={loading}
              onClick={() => void runAction("restore_active")}
              className={ui.btnSecondarySm}
            >
              Restore to active
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => void runAction("restore_completed")}
              className={ui.btnSecondarySm}
            >
              Restore to completed
            </button>
            {isAdmin ? (
              <button
                type="button"
                disabled={loading}
                onClick={() => setDeleteOpen(true)}
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
              >
                Delete permanently…
              </button>
            ) : null}
          </>
        ) : null}
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}

      <ProjectDeleteDialog
        open={deleteOpen}
        projectId={project.id}
        projectName={project.name}
        onClose={() => setDeleteOpen(false)}
        onDeleted={onDeleted}
      />
    </>
  );
}
