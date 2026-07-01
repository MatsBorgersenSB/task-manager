"use client";

import Link from "next/link";
import { useState } from "react";
import CreateProjectWizard from "@/components/projects/CreateProjectWizard";
import ProjectLifecycleFilterTabs from "@/components/projects/ProjectLifecycleFilterTabs";
import ProjectLifecycleMenu from "@/components/projects/ProjectLifecycleMenu";
import ProjectStatusBadge from "@/components/projects/ProjectStatusBadge";
import { useProjectManagement } from "@/hooks/useProjectManagement";
import { isAdmin, isInternal, type UserRole } from "@/lib/roles";
import { ui } from "@/lib/ui/classes";

type DashboardProjectSectionProps = {
  role: UserRole;
};

export default function DashboardProjectSection({
  role,
}: DashboardProjectSectionProps) {
  const isInternalUser = isInternal(role);
  const userIsAdmin = isAdmin(role);
  const [inviteEmail, setInviteEmail] = useState("");
  const {
    projects,
    filteredProjects,
    lifecycleFilter,
    setLifecycleFilter,
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
    handleCreateFromWizard,
    handleShareProject,
    handleInviteUser,
    loadProjects,
    updateProjectInList,
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
      <CreateProjectWizard
        open={createProjectOpen}
        loading={createProjectLoading}
        error={createProjectError}
        onClose={() => {
          if (!createProjectLoading) setCreateProjectOpen(false);
        }}
        onCreated={handleCreateFromWizard}
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
          <Link href="/internal/templates" className={ui.btnSecondary}>
            Template library
          </Link>
          <Link href="/internal/archived" className={ui.btnSecondary}>
            Archived projects
          </Link>
          {userIsAdmin ? (
            <Link href="/admin/lifecycle" className={ui.btnSecondary}>
              Lifecycle dashboard
            </Link>
          ) : null}
        </div>

        <div className="mt-6">
          <ProjectLifecycleFilterTabs
            value={lifecycleFilter}
            onChange={setLifecycleFilter}
          />
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
          ) : filteredProjects.length === 0 ? (
            <p className="mt-3 text-sm text-muted">
              No projects match this filter.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-border rounded-lg border border-border bg-surface">
              {filteredProjects.map((project) => {
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
                        <span className="flex flex-wrap items-center gap-2 font-semibold text-primary">
                          {project.name}
                          <ProjectStatusBadge status={project.project_status} />
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

            <div className="mt-6 border-t border-border pt-4">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">
                Lifecycle
              </h4>
              <div className="mt-3">
                <ProjectLifecycleMenu
                  project={selectedProject}
                  isAdmin={userIsAdmin}
                  onUpdated={(updated) => {
                    updateProjectInList(updated);
                    void loadProjects();
                  }}
                  onDeleted={() => {
                    void loadProjects();
                  }}
                />
              </div>
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
