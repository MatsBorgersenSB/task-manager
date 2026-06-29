"use client";

import { useEffect, useState } from "react";
import type { Project } from "@/lib/projects/types";
import { DUE_STATUS_LEGEND } from "@/lib/tasks/taskDates";
import type { TaskViewMode } from "@/lib/tasks/types";
import { viewModeDescription } from "@/lib/viewAccess";
import { ui } from "@/lib/ui/classes";

const HELP_BANNER_KEY = "task-manager-help-banner-dismissed";

export function TaskManagerHelpBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(localStorage.getItem(HELP_BANNER_KEY) !== "1");
  }, []);

  if (!visible) return null;

  return (
    <div className="no-print flex flex-wrap items-start justify-between gap-3 rounded-lg border border-accent/20 bg-accent/5 px-4 py-3 text-sm text-primary">
      <p>
        Create tasks, assign areas, and share with your client when ready.
      </p>
      <button
        type="button"
        onClick={() => {
          localStorage.setItem(HELP_BANNER_KEY, "1");
          setVisible(false);
        }}
        className="shrink-0 text-xs font-semibold text-muted transition hover:text-primary"
      >
        Dismiss
      </button>
    </div>
  );
}

export function DueDateLegend() {
  return (
    <div
      className="no-print flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted"
      aria-label="Due date legend"
    >
      <span className="font-semibold uppercase tracking-wide text-primary/70">
        Legend
      </span>
      {DUE_STATUS_LEGEND.map(({ icon, label }) => (
        <span key={label} className="inline-flex items-center gap-1">
          <span aria-hidden>{icon}</span>
          {label}
        </span>
      ))}
    </div>
  );
}

type ClientViewModeBannerProps = {
  mode: TaskViewMode;
  isPreview?: boolean;
};

export function ClientViewModeBanner({
  mode,
  isPreview = false,
}: ClientViewModeBannerProps) {
  if (mode !== "client") return null;

  return (
    <div className="no-print rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-primary">
      <p className="font-semibold text-primary">
        {isPreview ? "Client View preview" : "Client View"}
      </p>
      <p className="mt-1 text-muted">
        {isPreview
          ? "You are previewing what clients see. Internal comments, SB owners, admin controls, and project administration are hidden."
          : viewModeDescription("client")}
      </p>
      <ul className="mt-2 list-inside list-disc text-xs text-muted">
        <li>Client-visible tasks and fields only</li>
        <li>No internal comments or SB owner fields</li>
        <li>No import, sharing, or project admin tools</li>
      </ul>
    </div>
  );
}

type ProjectWorkflowBannerProps = {
  project: Project;
  shareLoading?: boolean;
  onShareProject: () => void;
};

export function ProjectWorkflowBanner({
  project,
  shareLoading = false,
  onShareProject,
}: ProjectWorkflowBannerProps) {
  if (project.is_shared) {
    return (
      <div className="no-print rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-primary">
        <p className="font-medium text-green-800">
          ✅ Project shared with client
        </p>
      </div>
    );
  }

  return (
    <div className="no-print rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-primary">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <ol className="list-decimal space-y-1 pl-5 text-primary/90">
          <li>Add tasks</li>
          <li>Assign responsibility</li>
          <li>Share with client</li>
        </ol>
        <button
          type="button"
          onClick={onShareProject}
          disabled={shareLoading}
          className={ui.btnPrimarySm}
        >
          {shareLoading ? "Sharing…" : "Share project"}
        </button>
      </div>
    </div>
  );
}

type NoProjectSelectedProps = {
  isInternal: boolean;
  hasProjects: boolean;
  onCreateProject?: () => void;
};

export function NoProjectSelectedState({
  isInternal,
  hasProjects,
  onCreateProject,
}: NoProjectSelectedProps) {
  return (
    <div className={`${ui.card} no-print py-16 text-center`}>
      <p className="text-lg font-semibold text-primary">⚠ No project selected</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">
        {hasProjects
          ? "Choose a project from the list above to view and manage tasks."
          : isInternal
            ? "Create a project before adding tasks or sharing with clients."
            : "No shared projects are available for your account yet."}
      </p>
      {isInternal && onCreateProject ? (
        <button
          type="button"
          onClick={onCreateProject}
          className={`${ui.btnPrimary} mt-6`}
        >
          Create Project
        </button>
      ) : null}
    </div>
  );
}

type NoTasksYetProps = {
  onAddTask: () => void;
  disabled?: boolean;
};

export function NoTasksYetState({ onAddTask, disabled }: NoTasksYetProps) {
  return (
    <div className={`${ui.card} no-print py-16 text-center`}>
      <p className="text-lg font-semibold text-primary">No tasks yet</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">
        Add your first task to start tracking work in this project.
      </p>
      <button
        type="button"
        onClick={onAddTask}
        disabled={disabled}
        className={`${ui.btnPrimary} mt-6`}
      >
        + Add your first task
      </button>
    </div>
  );
}
