"use client";

import { useState } from "react";
import type { Project } from "@/lib/projects/types";
import ProjectStatusBadge from "@/components/projects/ProjectStatusBadge";
import { filterProjectsForToolbar } from "@/lib/projects/lifecycle";
import { ui } from "@/lib/ui/classes";

type ProjectToolbarProps = {
  projects: Project[];
  selectedProjectId: string | null;
  loading?: boolean;
  isInternal?: boolean;
  shareLoading?: boolean;
  inviteLoading?: boolean;
  actionError?: string | null;
  onSelectProject: (projectId: string) => void;
  onCreateProject?: () => void;
  onShareProject?: () => void;
  onInviteUser?: (email: string) => void;
  readOnly?: boolean;
};

export default function ProjectToolbar({
  projects,
  selectedProjectId,
  loading = false,
  isInternal = false,
  shareLoading = false,
  inviteLoading = false,
  actionError = null,
  onSelectProject,
  onCreateProject,
  onShareProject,
  onInviteUser,
  readOnly = false,
}: ProjectToolbarProps) {
  const [inviteEmail, setInviteEmail] = useState("");
  const toolbarProjects = filterProjectsForToolbar(projects, selectedProjectId);
  const selectedProject = projects.find(
    (project) => project.id === selectedProjectId
  );

  return (
    <div className="no-print mb-2 rounded-lg border border-border bg-surface px-3 py-2 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[12rem] flex-1">
          <label
            htmlFor="project-selector"
            className="sr-only"
          >
            Project
          </label>
          <select
            id="project-selector"
            value={selectedProjectId ?? ""}
            onChange={(event) => onSelectProject(event.target.value)}
            disabled={loading || toolbarProjects.length === 0}
            className={`${ui.filterToolbarSelect} h-8 w-full`}
          >
            {toolbarProjects.length === 0 ? (
              <option value="">No projects available</option>
            ) : (
              toolbarProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                  {(project.project_status ?? "active") !== "active"
                    ? ` (${project.project_status})`
                    : ""}
                </option>
              ))
            )}
          </select>
        </div>

        {isInternal && !readOnly ? (
          <>
            {onCreateProject ? (
              <button
                type="button"
                onClick={onCreateProject}
                className={ui.btnSecondarySm}
              >
                + Create project
              </button>
            ) : null}
            <button
              type="button"
              onClick={onShareProject}
              disabled={!selectedProjectId || shareLoading}
              className={ui.btnSecondarySm}
            >
              {shareLoading ? "Sharing…" : "Share with client"}
            </button>
            <div className="flex min-w-[16rem] flex-1 items-end gap-2">
              <div className="min-w-0 flex-1">
                <label
                  htmlFor="invite-user-email"
                  className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted"
                >
                  Invite user
                </label>
                <input
                  id="invite-user-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  placeholder="client@example.com"
                  className={ui.filterToolbarInput}
                  disabled={!selectedProjectId || inviteLoading}
                />
              </div>
              <button
                type="button"
                disabled={!selectedProjectId || inviteLoading || !inviteEmail.trim()}
                onClick={() => {
                  if (!onInviteUser) return;
                  onInviteUser(inviteEmail);
                  setInviteEmail("");
                }}
                className={ui.btnSecondarySm}
              >
                {inviteLoading ? "Inviting…" : "Invite"}
              </button>
            </div>
          </>
        ) : null}
      </div>

      {selectedProject ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <ProjectStatusBadge status={selectedProject.project_status} />
          {selectedProject.description ? (
            <p className="text-sm text-muted">{selectedProject.description}</p>
          ) : null}
        </div>
      ) : null}

      {actionError ? (
        <p className="mt-2 text-xs text-red-600">{actionError}</p>
      ) : null}
    </div>
  );
}
