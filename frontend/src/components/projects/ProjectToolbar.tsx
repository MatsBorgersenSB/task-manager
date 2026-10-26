"use client";

import { useEffect, useRef, useState } from "react";
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
  /** Optional inline badges, view switch, and KPI summary bar rendered in the same unified row. */
  workspaceContext?: React.ReactNode;
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
  workspaceContext,
}: ProjectToolbarProps) {
  const [inviteEmail, setInviteEmail] = useState("");
  const [sharePopoverOpen, setSharePopoverOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const toolbarProjects = filterProjectsForToolbar(projects, selectedProjectId);
  const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? null;

  useEffect(() => {
    if (!sharePopoverOpen) return;
    function handleOutsideClick(event: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node)
      ) {
        setSharePopoverOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [sharePopoverOpen]);

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
          className={`${ui.filterToolbarSelectSm} font-semibold text-primary`}
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
                title="Create a new project"
              >
                + Project
              </button>
            ) : null}

            <div ref={popoverRef} className="relative">
              <button
                type="button"
                onClick={() => setSharePopoverOpen((prev) => !prev)}
                disabled={!selectedProjectId}
                aria-expanded={sharePopoverOpen}
                className={`${ui.btnSecondarySm} inline-flex items-center gap-1.5`}
              >
                <span aria-hidden className="text-xs">
                  {selectedProject?.is_shared ? "🟢" : "🔒"}
                </span>
                <span>Share &amp; Invite</span>
              </button>

              {sharePopoverOpen ? (
                <div className="absolute left-0 top-full z-50 mt-1.5 w-80 rounded-lg border border-border bg-white p-3 shadow-lg">
                  <div className="flex items-center justify-between border-b border-border/60 pb-2">
                    <div>
                      <p className="text-xs font-semibold text-primary">
                        Client Collaboration
                      </p>
                      <p className="text-[11px] text-muted">
                        {selectedProject?.is_shared
                          ? "Shared with external client portal"
                          : "Internal only — not visible to clients"}
                      </p>
                    </div>
                    {onShareProject ? (
                      <button
                        type="button"
                        onClick={onShareProject}
                        disabled={!selectedProjectId || shareLoading}
                        className={ui.btnSecondarySm}
                      >
                        {shareLoading
                          ? "Sharing…"
                          : selectedProject?.is_shared
                            ? "Re-sync share"
                            : "Enable sharing"}
                      </button>
                    ) : null}
                  </div>

                  {onInviteUser ? (
                    <div className="mt-2.5">
                      <label
                        htmlFor="invite-user-email"
                        className="block text-[11px] font-medium text-primary/80"
                      >
                        Invite collaborator by email
                      </label>
                      <div className="mt-1 flex items-center gap-1.5">
                        <input
                          id="invite-user-email"
                          type="email"
                          value={inviteEmail}
                          onChange={(event) => setInviteEmail(event.target.value)}
                          placeholder="colleague@client.com"
                          className={`${ui.inputCompact} flex-1`}
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
                          onClick={() => {
                            onInviteUser(inviteEmail);
                            setInviteEmail("");
                          }}
                          disabled={
                            !selectedProjectId ||
                            inviteLoading ||
                            !inviteEmail.trim()
                          }
                          className={ui.btnPrimarySm}
                        >
                          {inviteLoading ? "Inviting…" : "Invite"}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </>
        ) : null}

        {workspaceContext ? (
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            {workspaceContext}
          </div>
        ) : null}

        {actionError ? (
          <span className="text-xs font-medium text-red-700" role="alert">
            {actionError}
          </span>
        ) : null}
      </div>
    </section>
  );
}
