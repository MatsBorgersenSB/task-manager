"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createProject,
  fetchProjectsWithDefault,
  getDefaultProjectId,
  inviteProjectUser,
  shareProject,
} from "@/lib/projects/api";
import { persistProjectId, resolveSelectedProjectId } from "@/lib/projects/selection";
import type { Project } from "@/lib/projects/types";
import { repairOrphanTasks } from "@/lib/tasks/api";
import { logProjectActivity } from "@/lib/tasks/projectActivity";

type UseProjectManagementOptions = {
  isInternal: boolean;
  initialProjectId?: string | null;
  repairOrphans?: boolean;
  autoLoad?: boolean;
};

export function useProjectManagement({
  isInternal,
  initialProjectId,
  repairOrphans = false,
  autoLoad = true,
}: UseProjectManagementOptions) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectActionError, setProjectActionError] = useState<string | null>(null);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [createProjectLoading, setCreateProjectLoading] = useState(false);
  const [createProjectError, setCreateProjectError] = useState<string | null>(null);
  const [shareProjectLoading, setShareProjectLoading] = useState(false);
  const [inviteProjectLoading, setInviteProjectLoading] = useState(false);

  const loadProjects = useCallback(async (): Promise<Project[]> => {
    setProjectsLoading(true);
    setProjectActionError(null);
    try {
      const next = await fetchProjectsWithDefault(isInternal);
      setProjects(next);

      const defaultProjectId = getDefaultProjectId(next);
      if (repairOrphans && isInternal && defaultProjectId) {
        await repairOrphanTasks(defaultProjectId);
      }

      return next;
    } catch (err) {
      setProjectActionError(
        err instanceof Error ? err.message : "Failed to load projects."
      );
      setProjects([]);
      return [];
    } finally {
      setProjectsLoading(false);
    }
  }, [isInternal, repairOrphans]);

  useEffect(() => {
    if (autoLoad) {
      void loadProjects();
    }
  }, [autoLoad, loadProjects]);

  useEffect(() => {
    setSelectedProjectId((current) =>
      resolveSelectedProjectId(projects, current, initialProjectId)
    );
  }, [initialProjectId, projects]);

  const handleSelectProject = useCallback((projectId: string) => {
    setSelectedProjectId(projectId);
    persistProjectId(projectId);
    setProjectActionError(null);
  }, []);

  const handleCreateProject = useCallback(async (name: string, description: string) => {
    setCreateProjectLoading(true);
    setCreateProjectError(null);
    try {
      const created = await createProject({ name, description });
      setProjects((prev) =>
        [...prev, created].sort((a, b) => a.name.localeCompare(b.name))
      );
      setSelectedProjectId(created.id);
      persistProjectId(created.id);
      setCreateProjectOpen(false);
    } catch (err) {
      setCreateProjectError(
        err instanceof Error ? err.message : "Failed to create project."
      );
    } finally {
      setCreateProjectLoading(false);
    }
  }, []);

  const handleShareProject = useCallback(async () => {
    if (!selectedProjectId) return;
    setShareProjectLoading(true);
    setProjectActionError(null);
    try {
      const updated = await shareProject(selectedProjectId);
      setProjects((prev) =>
        prev.map((project) => (project.id === updated.id ? updated : project))
      );
      void logProjectActivity({
        projectId: selectedProjectId,
        eventType: "project_shared",
        summary: "Project shared with client",
        clientVisible: true,
      });
    } catch (err) {
      setProjectActionError(
        err instanceof Error ? err.message : "Failed to share project."
      );
    } finally {
      setShareProjectLoading(false);
    }
  }, [selectedProjectId]);

  const handleInviteUser = useCallback(
    async (email: string) => {
      if (!selectedProjectId) return;
      setInviteProjectLoading(true);
      setProjectActionError(null);
      try {
        await inviteProjectUser(selectedProjectId, email, "client");
      } catch (err) {
        setProjectActionError(
          err instanceof Error ? err.message : "Failed to invite user."
        );
      } finally {
        setInviteProjectLoading(false);
      }
    },
    [selectedProjectId]
  );

  const selectedProject = projects.find(
    (project) => project.id === selectedProjectId
  );

  const updateProjectInList = useCallback((updated: Project) => {
    setProjects((prev) =>
      prev.map((project) => (project.id === updated.id ? updated : project))
    );
  }, []);

  return {
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
    loadProjects,
    handleSelectProject,
    handleCreateProject,
    handleShareProject,
    handleInviteUser,
    setProjectActionError,
    updateProjectInList,
  };
}
