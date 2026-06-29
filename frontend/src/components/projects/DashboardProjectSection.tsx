"use client";

import Link from "next/link";
import { useState } from "react";
import CreateProjectModal from "@/components/projects/CreateProjectModal";
import { useProjectManagement } from "@/hooks/useProjectManagement";
import { isInternal, type UserRole } from "@/lib/roles";
import { ui } from "@/lib/ui/classes";

type DashboardProjectSectionProps = {
  role: UserRole;
};

export default function DashboardProjectSection({
  role,
}: DashboardProjectSectionProps) {
  const isInternalUser = isInternal(role);
  const [inviteEmail, setInviteEmail] = useState("");
  const {
    projects,
    selectedProject,
    selectedProjectId,
    projectsLoading,
    projectActionError,
    createProjectOpen,
    setCreateProjectOpen,
    createProjectLoading,
    createProjectError,
    shareProjectLoading,
    inviteProjectLoading,
    handleSelectProject,
    handleCreateProject,
    handleShareProject,
    handleInviteUser,
  } = useProjectManagement({
    isInternal: isInternalUser,
    repairOrphans: isInternalUser,
    autoLoad: isInternalUser,
  });

  if (!isInternalUser) {
    return null;
  }

  async function submitInvite() {
    const email = inviteEmail.trim();
    if (!email) return;
    await handleInviteUser(email);
    setInviteEmail("");
  }

  return (
    <>
      <CreateProjectModal
        open={createProjectOpen}
        loading={createProjectLoading}
        error={createProjectError}
        onClose={() => {
          if (!createProjectLoading) setCreateProjectOpen(false);
        }}
        onCreate={(name, description) => void handleCreateProject(name, description)}
      />

      <section className={`mb-8 p-6 ${ui.card}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className={ui.sectionTitle}>Projects</h2>
            <p className="mt-2 text-sm text-muted">
              Create projects, share them with clients, and invite users here before opening task views.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCreateProjectOpen(true)}
            className={ui.btnPrimary}
          >
            + Create project
          </button>
        </div>

        <div className="mt-6">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
            Project list
          </h3>
          {projectsLoading ? (
            <p className="mt-3 text-sm text-muted">Loading projects…</p>
          ) : projects.length === 0 ? (
            <p className="mt-3 text-sm text-muted">
              No projects yet. Create your first project to get started.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-border rounded-lg border border-border bg-surface">
              {projects.map((project) => {
                const isSelected = project.id === selectedProjectId;
                return (
                  <li key={project.id}>
                    <button
                      type="button"
                      onClick={() => handleSelectProject(project.id)}
                      className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition ${
                        isSelected
                          ? "bg-accent/10 ring-1 ring-inset ring-accent/30"
                          : "hover:bg-background"
                      }`}
                    >
                      <span>
                        <span className="font-semibold text-primary">
                          {project.name}
                        </span>
                        {project.description ? (
                          <span className="mt-0.5 block text-sm text-muted">
                            {project.description}
                          </span>
                        ) : null}
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        {project.is_shared ? (
                          <span className="rounded-full border border-green-300 bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                            Shared
                          </span>
                        ) : (
                          <span className="rounded-full border border-border bg-background px-2 py-0.5 text-xs font-semibold text-muted">
                            Internal only
                          </span>
                        )}
                        {isSelected ? (
                          <span className="text-xs font-semibold text-accent">
                            Selected
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {selectedProject ? (
          <div className="mt-6 rounded-lg border border-border bg-background p-4">
            <h3 className="text-sm font-semibold text-primary">
              Manage {selectedProject.name}
            </h3>

            <div className="mt-4 flex flex-wrap items-end gap-3">
              <button
                type="button"
                onClick={() => void handleShareProject()}
                disabled={
                  !selectedProjectId ||
                  shareProjectLoading ||
                  selectedProject.is_shared
                }
                className={ui.btnSecondarySm}
              >
                {shareProjectLoading
                  ? "Sharing…"
                  : selectedProject.is_shared
                    ? "Shared with clients"
                    : "Share this project with client"}
              </button>

              <div className="flex min-w-[18rem] flex-1 items-end gap-2">
                <div className="min-w-0 flex-1">
                  <label
                    htmlFor="dashboard-invite-email"
                    className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted"
                  >
                    Invite user
                  </label>
                  <input
                    id="dashboard-invite-email"
                    type="email"
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                    placeholder="client@example.com"
                    className={ui.filterToolbarInput}
                    disabled={!selectedProjectId || inviteProjectLoading}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void submitInvite();
                      }
                    }}
                  />
                </div>
                <button
                  type="button"
                  disabled={
                    !selectedProjectId || inviteProjectLoading || !inviteEmail.trim()
                  }
                  onClick={() => void submitInvite()}
                  className={ui.btnSecondarySm}
                >
                  {inviteProjectLoading ? "Inviting…" : "Invite"}
                </button>
              </div>
            </div>

            {selectedProject.is_shared ? (
              <p className="mt-3 text-sm text-green-700">
                Invited users can open the client view for this project.
              </p>
            ) : (
              <p className="mt-3 text-sm text-muted">
                Share this project before inviting external users.
              </p>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href={`/internal?project=${selectedProjectId}`}
                className={ui.btnSecondarySm}
              >
                Open internal tasks
              </Link>
              <Link
                href={`/client?project=${selectedProjectId}`}
                className={ui.btnSecondarySm}
              >
                Preview client view
              </Link>
            </div>
          </div>
        ) : null}

        {projectActionError ? (
          <p className="mt-4 text-sm text-red-600">{projectActionError}</p>
        ) : null}
      </section>
    </>
  );
}
