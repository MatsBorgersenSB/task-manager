"use client";

import { useState } from "react";
import type { Project } from "@/lib/projects/types";
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
  embedded?: boolean;
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
  embedded = false,
}: ProjectToolbarProps) {
  const [inviteEmail, setInviteEmail] = useState("");
  const toolbarProjects = filterProjectsForToolbar(projects, selectedProjectId);

  return (
    <section
      className={
        embedded
          ? "no-print"
          : "no-print rounded-lg border border-border/70 bg-surface shadow-sm"
      }
      aria-label="Project and collaboration"
    >
      <div className={ui.compactBar}>
        <label htmlFor="project-selector" className="sr-only">
          Select project
        </label>
        <select
          id="project-selector"
          value={selectedProjectId ?? ""}
          onChange={(event) => onSelectProject(event.target.value)}
          disabled={loading || toolbarProjects.length === 0}
          className={ui.filterToolbarSelectSm}
        >
          {toolbarProjects.length === 0 ? (
            <option value="">No projects</option>
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

        {isInternal && !readOnly ? (
          <>
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

            {onInviteUser ? (
              <>
                <span
                  className="hidden h-5 w-px shrink-0 bg-border/80 sm:block"
                  aria-hidden
                />
                <label htmlFor="invite-user-email" className="sr-only">
                  Invite collaborator email
                </label>
                <input
                  id="invite-user-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  placeholder="Invite email"
                  className={ui.inputCompact}
                  disabled={!selectedProjectId || inviteLoading}
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      inviteEmail.trim() &&
                      selectedProjectId &&
                      !inviteLoading
                    ) {
                      onInviteUser(inviteEmail);
                      setInviteEmail("");
                    }
                  }}
                />
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
                  {inviteLoading ? "…" : "Invite"}
                </button>
              </>
            ) : null}
          </>
        ) : null}
      </div>

      {actionError ? (
        <p className="border-t border-border/40 px-3 py-1 text-xs text-red-600 sm:px-4">
          {actionError}
        </p>
      ) : null}
    </section>
  );
}
