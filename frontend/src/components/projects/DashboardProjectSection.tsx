"use client";

import Link from "next/link";
import CreateProjectModal from "@/components/projects/CreateProjectModal";
import ProjectToolbar from "@/components/projects/ProjectToolbar";
import { useProjectManagement } from "@/hooks/useProjectManagement";
import { ui } from "@/lib/ui/classes";

export default function DashboardProjectSection() {
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
    isInternal: true,
    repairOrphans: true,
  });

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

      <section className={`mt-8 p-6 ${ui.card}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className={ui.sectionTitle}>Projects</h2>
            <p className="mt-2 text-sm text-muted">
              Create projects, share them with clients, and invite users before opening task views.
            </p>
          </div>
          {selectedProjectId ? (
            <div className="flex flex-wrap gap-2">
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
          ) : null}
        </div>

        <div className="mt-4">
          <ProjectToolbar
            projects={projects}
            selectedProjectId={selectedProjectId}
            loading={projectsLoading}
            isInternal
            shareLoading={shareProjectLoading}
            inviteLoading={inviteProjectLoading}
            actionError={projectActionError}
            onSelectProject={handleSelectProject}
            onCreateProject={() => setCreateProjectOpen(true)}
            onShareProject={() => void handleShareProject()}
            onInviteUser={(email) => void handleInviteUser(email)}
          />
        </div>

        {selectedProject?.is_shared ? (
          <p className="mt-3 text-sm text-green-700">
            {selectedProject.name} is shared with clients. Invited users can open the client view.
          </p>
        ) : selectedProject ? (
          <p className="mt-3 text-sm text-muted">
            Share {selectedProject.name} with clients before inviting external users.
          </p>
        ) : null}
      </section>
    </>
  );
}
