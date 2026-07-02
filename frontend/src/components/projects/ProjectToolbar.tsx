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
    <section
      className={`no-print ${ui.zone}`}
      aria-label="Project"
    >
      <div className={ui.zoneHeader}>
        <div className="min-w-0 flex-1">
          <p className={ui.zoneLabel}>Project</p>
          <label htmlFor="project-selector" className="sr-only">
            Select project
          </label>
          <select
            id="project-selector"
            value={selectedProjectId ?? ""}
            onChange={(event) => onSelectProject(event.target.value)}
            disabled={loading || toolbarProjects.length === 0}
            className={`${ui.filterToolbarSelect} mt-1 h-9 max-w-md`}
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
          <div className="flex flex-wrap items-center gap-2">
            {onCreateProject ? (
              <button
                type="button"
                onClick={onCreateProject}
                className={ui.btnSecondarySm}
              >
                New project
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
          </div>
        ) : null}
      </div>

      {isInternal && !readOnly && onInviteUser ? (
        <div className={`${ui.zoneBody} border-t border-border/40 pt-3`}>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[14rem] flex-1">
              <label
                htmlFor="invite-user-email"
                className="mb-1 block text-xs font-medium text-muted"
              >
                Invite collaborator
              </label>
              <input
                id="invite-user-email"
                type="email"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="client@example.com"
                className={ui.input}
                disabled={!selectedProjectId || inviteLoading}
              />
            </div>
            <button
              type="button"
              disabled={
                !selectedProjectId || inviteLoading || !inviteEmail.trim()
              }
              onClick={() => {
                onInviteUser(inviteEmail);
                setInviteEmail("");
              }}
              className={ui.btnSecondarySm}
            >
              {inviteLoading ? "Inviting…" : "Invite"}
            </button>
          </div>
        </div>
      ) : null}

      {selectedProject ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-border/40 px-4 py-2.5 sm:px-5">
          <ProjectStatusBadge status={selectedProject.project_status} />
          {selectedProject.description ? (
            <p className={ui.textCaption}>{selectedProject.description}</p>
          ) : null}
        </div>
      ) : null}

      {actionError ? (
        <p className="border-t border-border/40 px-4 py-2 text-sm text-red-600 sm:px-5">
          {actionError}
        </p>
      ) : null}
    </section>
  );
}
