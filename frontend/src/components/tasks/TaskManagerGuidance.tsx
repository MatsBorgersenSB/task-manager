"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Project } from "@/lib/projects/types";
import {
  DUE_DATE_COLUMN_LEGEND,
  TABLE_ROW_HIGHLIGHT_LEGEND,
} from "@/lib/tasks/taskDates";
import type { TaskViewMode } from "@/lib/tasks/types";
import { viewModeDescription } from "@/lib/viewAccess";
import {
  SUMMARY_FILTER_BANNER_LABELS,
  type SummaryFilterKey,
} from "@/lib/tasks/summaryFilters";
import { ui } from "@/lib/ui/classes";

const HELP_BANNER_KEY = "task-manager-help-banner-dismissed";

const legendChipBase =
  "inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[10px] font-medium leading-none ring-1 ring-black/5";

type LegendChipItem = {
  chipClass: string;
  label: string;
  title?: string;
};

function LegendChips({
  items,
  ariaLabel,
  className,
}: {
  items: readonly LegendChipItem[];
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-wrap items-center gap-1 ${className ?? ""}`}
      aria-label={ariaLabel}
    >
      {items.map(({ chipClass, label, title }) => (
        <span
          key={label}
          title={title}
          className={`${legendChipBase} ${chipClass}`}
        >
          {label}
        </span>
      ))}
    </div>
  );
}

/** Row background colors — statistics dashboard or legacy toolbar slot. */
export function RowHighlightLegend({
  variant = "dashboard",
}: {
  variant?: "dashboard" | "toolbar";
}) {
  return (
    <div
      className={`flex flex-wrap items-center gap-1.5 ${
        variant === "dashboard" ? "justify-start" : ""
      }`}
    >
      <span
        className={
          variant === "dashboard"
            ? "shrink-0 text-[11px] font-medium text-muted after:content-[':']"
            : `${ui.toolbarGroupLabel} hidden sm:inline`
        }
      >
        Row Highlights
      </span>
      <LegendChips
        items={TABLE_ROW_HIGHLIGHT_LEGEND}
        ariaLabel="Row highlight legend"
      />
    </div>
  );
}

/** Due-date cell colors — Date Due column header. */
export function DueDateColumnLegend({ className }: { className?: string }) {
  return (
    <LegendChips
      items={DUE_DATE_COLUMN_LEGEND}
      ariaLabel="Due date legend"
      className={className}
    />
  );
}

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

type SummaryFilterBannerProps = {
  filterKey: SummaryFilterKey;
  onClear: () => void;
};

export function SummaryFilterBanner({
  filterKey,
  onClear,
}: SummaryFilterBannerProps) {
  return (
    <div className="no-print flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-primary">
      <p>
        Showing:{" "}
        <strong className="font-semibold">
          {SUMMARY_FILTER_BANNER_LABELS[filterKey]}
        </strong>
      </p>
      <button type="button" onClick={onClear} className={ui.btnSecondarySm}>
        Clear Filter
      </button>
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
        {isPreview ? "CLIENT VIEW preview" : "CLIENT VIEW"}
      </p>
      <p className="mt-1 text-muted">
        {isPreview
          ? "You are previewing the customer-facing view. Action comments, internal comments, priority, and project administration are hidden."
          : viewModeDescription("client")}
      </p>
      <ul className="mt-2 list-inside list-disc text-xs text-muted">
        <li>Project dashboard and client-visible tasks</li>
        <li>Status, due dates, intervention and completion dates</li>
        <li>Client comments only — no internal or action comments</li>
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
      <p className="text-sm text-muted">
        Clients can view tasks and add comments on this project.
      </p>
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
  dashboardHref?: string;
};

export function NoProjectSelectedState({
  isInternal,
  hasProjects,
  dashboardHref = "/dashboard",
}: NoProjectSelectedProps) {
  return (
    <div className={`${ui.card} no-print py-16 text-center`}>
      <p className="text-lg font-semibold text-primary">No project selected</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">
        {hasProjects
          ? "Choose a project from the list above to view and manage tasks."
          : isInternal
            ? "Create a project from the dashboard before adding tasks or sharing with clients."
            : "No shared projects are available for your account yet."}
      </p>
      {isInternal && !hasProjects ? (
        <Link href={dashboardHref} className={`${ui.btnPrimary} mt-6 inline-flex`}>
          Go to dashboard
        </Link>
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
        + Create First Task
      </button>
    </div>
  );
}
