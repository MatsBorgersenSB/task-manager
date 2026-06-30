"use client";

import { useState } from "react";
import type { Project } from "@/lib/projects/types";
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
}: ProjectToolbarProps) {
  const [inviteEmail, setInviteEmail] = useState("");
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
            disabled={loading || projects.length === 0}
            className={`${ui.filterToolbarSelect} h-8 w-full`}
          >
            {projects.length === 0 ? (
              <option value="">No projects available</option>
            ) : (
              projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                  {project.is_shared ? " · Shared" : ""}
                </option>
              ))
            )}
          </select>
        </div>

        {isInternal ? (
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
              disabled={
                !selectedProjectId || shareLoading || selectedProject?.is_shared
              }
              className={ui.btnSecondarySm}
            >
              {shareLoading
                ? "Sharing…"
                : selectedProject?.is_shared
                  ? "Shared with clients"
                  : "Share this project with client"}
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

      {selectedProject?.description ? (
        <p className="mt-2 text-sm text-muted">{selectedProject.description}</p>
      ) : null}

      {actionError ? (
        <p className="mt-2 text-xs text-red-600">{actionError}</p>
      ) : null}
    </div>
  );
}
