"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import CreateProjectWizard from "@/components/projects/CreateProjectWizard";
import ProjectLifecycleFilterTabs from "@/components/projects/ProjectLifecycleFilterTabs";
import ProjectLifecycleMenu from "@/components/projects/ProjectLifecycleMenu";
import ProjectStatusBadge from "@/components/projects/ProjectStatusBadge";
import { useProjectManagement } from "@/hooks/useProjectManagement";
import { useSchemaCapabilities } from "@/hooks/useSchemaCapabilities";
import {
  fetchProjectWorkSignals,
  type ProjectWorkSignal,
} from "@/lib/projects/workSignals";
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
  const { capabilities } = useSchemaCapabilities();
  const lifecycleEnabled = capabilities?.projectLifecycle ?? false;
  const [inviteEmail, setInviteEmail] = useState("");
  const [managedProjectId, setManagedProjectId] = useState<string | null>(null);
  const [workSignals, setWorkSignals] = useState<Record<string, ProjectWorkSignal>>({});
  const {
    projects,
    filteredProjects,
    lifecycleFilter,
    setLifecycleFilter,
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

  useEffect(() => {
    if (!isInternalUser) return;
    let cancelled = false;
    void fetchProjectWorkSignals().then((next) => {
      if (!cancelled) setWorkSignals(next);
    });
    return () => {
      cancelled = true;
    };
  }, [isInternalUser, projects]);

  if (!isInternalUser) {
    return null;
  }

  const managedProject =
    filteredProjects.find((project) => project.id === managedProjectId) ?? null;

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
            <p className="mt-2 max-w-xl text-sm text-muted">
              Open a project to work its tasks. Manage is for sharing, invites, and closing a project.
            </p>
            {lifecycleEnabled && userIsAdmin ? (
              <Link
                href="/admin/lifecycle"
                className="mt-2 inline-block text-sm font-medium text-accent hover:underline"
              >
                Lifecycle dashboard
              </Link>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCreateProjectOpen(true)}
              className={projects.length === 0 ? ui.btnPrimary : ui.btnSecondary}
            >
              + Create project
            </button>
            <Link href="/internal/templates" className={ui.btnSecondary}>
              Template library
            </Link>
          </div>
        </div>

        {lifecycleEnabled ? (
          <div className="mt-6">
            <ProjectLifecycleFilterTabs
              value={lifecycleFilter}
              onChange={setLifecycleFilter}
            />
          </div>
        ) : (
          <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Project complete / archive / delete is unavailable until you run{" "}
            <code className="text-xs">051_project_lifecycle.sql</code> in the
            Supabase SQL editor, then refresh this page.
          </p>
        )}

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
                const signal = workSignals[project.id];
                const isManaged = project.id === managedProjectId;
                return (
                  <li key={project.id} className="flex items-stretch">
                    <Link
                      href={`/internal?project=${project.id}`}
                      className={`flex min-w-0 flex-1 items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-background ${
                        isManaged ? "bg-accent/5" : ""
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-2 font-semibold text-primary">
                          {project.name}
                          {lifecycleEnabled ? (
                            <ProjectStatusBadge status={project.project_status} />
                          ) : null}
                        </span>
                        <ProjectWorkSignalLine signal={signal} />
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
                      </span>
                    </Link>
                    <button
                      type="button"
                      aria-expanded={isManaged}
                      onClick={() => {
                        handleSelectProject(project.id);
                        setInviteEmail("");
                        setManagedProjectId((current) =>
                          current === project.id ? null : project.id
                        );
                      }}
                      className={`shrink-0 border-l border-border px-4 text-sm font-medium transition ${
                        isManaged
                          ? "bg-accent/10 text-accent"
                          : "text-primary hover:bg-background"
                      }`}
                    >
                      {isManaged ? "Close" : "Manage"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {managedProject ? (
          <div className="mt-6 rounded-lg border border-border bg-background p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h3 className="text-sm font-semibold text-primary">
                Manage {managedProject.name}
              </h3>
              <Link
                href={`/client?project=${managedProject.id}`}
                className={ui.btnSecondarySm}
              >
                Preview client view
              </Link>
            </div>

            <div className="mt-4 flex flex-wrap items-end gap-3">
              <button
                type="button"
                onClick={() => void handleShareProject()}
                disabled={
                  shareProjectLoading || managedProject.is_shared
                }
                className={ui.btnSecondarySm}
              >
                {shareProjectLoading
                  ? "Sharing…"
                  : managedProject.is_shared
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
                    disabled={inviteProjectLoading}
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
                  disabled={inviteProjectLoading || !inviteEmail.trim()}
                  onClick={() => void submitInvite()}
                  className={ui.btnSecondarySm}
                >
                  {inviteProjectLoading ? "Inviting…" : "Invite"}
                </button>
              </div>
            </div>

            {managedProject.is_shared ? (
              <p className="mt-3 text-sm text-green-700">
                Invited users can open the client view for this project.
              </p>
            ) : (
              <p className="mt-3 text-sm text-muted">
                Share this project before inviting external users.
              </p>
            )}

            {lifecycleEnabled ? (
              <div className="mt-6 border-t border-border pt-4">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Project lifecycle
                </h4>
                <p className="mt-1 text-xs text-muted">
                  Mark complete, archive, or delete. Task work stays in the project.
                </p>
                <div className="mt-3">
                  <ProjectLifecycleMenu
                    project={managedProject}
                    isAdmin={userIsAdmin}
                    onUpdated={(updated) => {
                      updateProjectInList(updated);
                      void loadProjects();
                    }}
                    onDeleted={() => {
                      setManagedProjectId(null);
                      void loadProjects();
                    }}
                  />
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {projectActionError ? (
          <p className="mt-4 text-sm text-red-600">{projectActionError}</p>
        ) : null}
      </section>
    </>
  );
}

function ProjectWorkSignalLine({
  signal,
}: {
  signal: ProjectWorkSignal | undefined;
}) {
  if (!signal) {
    return <span className="mt-1 block text-sm text-muted">Checking work…</span>;
  }

  if (signal.overdue === 0 && signal.waiting === 0) {
    return <span className="mt-1 block text-sm text-muted">On track</span>;
  }

  return (
    <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm">
      {signal.overdue > 0 ? (
        <span className="font-medium text-red-700">
          {signal.overdue} overdue
        </span>
      ) : null}
      {signal.waiting > 0 ? (
        <span className="font-medium text-violet-700">
          {signal.waiting} waiting
        </span>
      ) : null}
    </span>
  );
}
