"use client";

import type { ReactNode } from "react";
import ExportMenu from "@/components/shared/ExportMenu";
import { RowHighlightLegend } from "@/components/tasks/TaskManagerGuidance";
import type { Task, TaskViewMode } from "@/lib/tasks/types";
import { ui } from "@/lib/ui/classes";

type TaskWorkspaceToolbarProps = {
  mode: TaskViewMode;
  visibleTasks: Task[];
  disabled?: boolean;
  focusMode?: boolean;
  isFullscreen?: boolean;
  onToggleFocus?: () => void;
  onToggleFullscreen?: () => void;
  onPrint: () => void;
  onClearFilters?: () => void;
  showOptionalColumns?: boolean;
  onToggleOptionalColumns?: (next: boolean) => void;
  showColumnToggle?: boolean;
  showRowHighlightLegend?: boolean;
};

function ToolbarGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className={ui.toolbarGroupLabel}>{label}</span>
      <div className="flex flex-wrap items-center gap-1">{children}</div>
    </div>
  );
}

export default function TaskWorkspaceToolbar({
  mode,
  visibleTasks,
  disabled = false,
  focusMode = false,
  isFullscreen = false,
  onToggleFocus,
  onToggleFullscreen,
  onPrint,
  onClearFilters,
  showOptionalColumns = false,
  onToggleOptionalColumns,
  showColumnToggle = false,
  showRowHighlightLegend = false,
}: TaskWorkspaceToolbarProps) {
  return (
    <div
      className={`no-print ${ui.compactBarBordered} flex-wrap items-center justify-between gap-x-4 gap-y-2`}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <ToolbarGroup label="Export">
        <ExportMenu
          mode={mode}
          tasks={visibleTasks}
          disabled={disabled}
          onPrint={onPrint}
        />
      </ToolbarGroup>

      <ToolbarGroup label="View">
        {onToggleFocus ? (
          <button
            type="button"
            onClick={onToggleFocus}
            className={`${ui.btnUtilitySm}${
              focusMode ? " bg-accent/10 text-accent" : ""
            }`}
            aria-pressed={focusMode}
            title="Toggle focus mode (F)"
          >
            {focusMode ? "Exit focus" : "Focus"}
          </button>
        ) : null}
        {onToggleFullscreen ? (
          <button
            type="button"
            onClick={onToggleFullscreen}
            className={`${ui.btnUtilitySm}${
              isFullscreen ? " bg-accent/10 text-accent" : ""
            }`}
            aria-pressed={isFullscreen}
            title="Toggle fullscreen"
          >
            {isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          </button>
        ) : null}
      </ToolbarGroup>

      <ToolbarGroup label="Filters">
        {onClearFilters ? (
          <button
            type="button"
            onClick={onClearFilters}
            className={ui.btnUtilitySm}
          >
            Clear filters
          </button>
        ) : null}
        {showColumnToggle && onToggleOptionalColumns ? (
          <label className={`${ui.filterToggle} cursor-pointer text-xs`}>
            <input
              type="checkbox"
              checked={showOptionalColumns}
              onChange={(event) => onToggleOptionalColumns(event.target.checked)}
              className="rounded border-border text-accent focus:ring-accent/20"
            />
            Columns
          </label>
        ) : null}
      </ToolbarGroup>
      </div>

      {showRowHighlightLegend ? (
        <div className="ml-auto flex shrink-0 items-center print:hidden">
          <RowHighlightLegend />
        </div>
      ) : null}
    </div>
  );
}
