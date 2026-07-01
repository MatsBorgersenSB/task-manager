"use client";

import { useEffect, useMemo, useState } from "react";
import ProjectLifecycleMenu from "@/components/projects/ProjectLifecycleMenu";
import ProjectStatusBadge from "@/components/projects/ProjectStatusBadge";
import type { Project } from "@/lib/projects/types";
import { ui } from "@/lib/ui/classes";

type ProjectLifecycleGovernancePanelProps = {
  projects: Project[];
  isAdmin: boolean;
  title?: string;
  description?: string;
  onProjectsChanged: () => void | Promise<void>;
};

export default function ProjectLifecycleGovernancePanel({
  projects,
  isAdmin,
  title = "Manage project lifecycle",
  description = "Mark projects complete, archive them, restore archived work, or permanently delete when appropriate.",
  onProjectsChanged,
}: ProjectLifecycleGovernancePanelProps) {
  const [selectedId, setSelectedId] = useState("");

  const visibleProjects = useMemo(
    () =>
      [...projects]
        .filter((project) => !project.deleted_at)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [projects]
  );

  useEffect(() => {
    if (visibleProjects.length === 0) {
      setSelectedId("");
      return;
    }
    if (!visibleProjects.some((project) => project.id === selectedId)) {
      setSelectedId(visibleProjects[0].id);
    }
  }, [selectedId, visibleProjects]);

  const selectedProject =
    visibleProjects.find((project) => project.id === selectedId) ?? null;

  return (
    <section className={`p-6 ${ui.card}`}>
      <h3 className="text-sm font-semibold text-primary">{title}</h3>
      <p className="mt-2 text-sm text-muted">{description}</p>

      {visibleProjects.length === 0 ? (
        <p className="mt-4 text-sm text-muted">No projects available.</p>
      ) : (
        <div className="mt-4 space-y-4">
          <div>
            <label className={ui.label} htmlFor="lifecycle-project-select">
              Project
            </label>
            <select
              id="lifecycle-project-select"
              value={selectedId}
              onChange={(event) => setSelectedId(event.target.value)}
              className={`mt-1 ${ui.input}`}
            >
              {visibleProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          {selectedProject ? (
            <div className="rounded-lg border border-border bg-background/60 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-primary">
                  {selectedProject.name}
                </p>
                <ProjectStatusBadge status={selectedProject.project_status} />
              </div>
              <div className="mt-4">
                <ProjectLifecycleMenu
                  project={selectedProject}
                  isAdmin={isAdmin}
                  onUpdated={() => void onProjectsChanged()}
                  onDeleted={() => void onProjectsChanged()}
                />
              </div>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
