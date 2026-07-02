"use client";

import ExportMenu from "@/components/shared/ExportMenu";
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
};

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
}: TaskWorkspaceToolbarProps) {
  return (
    <div className="no-print flex flex-wrap items-center justify-between gap-3 border-b border-border/50 px-4 py-2.5 sm:px-5">
      <p className={ui.zoneLabel}>Actions</p>
      <div className="flex flex-wrap items-center gap-1.5">
        <ExportMenu
          mode={mode}
          tasks={visibleTasks}
          disabled={disabled}
          onPrint={onPrint}
        />
        {onClearFilters ? (
          <button
            type="button"
            onClick={onClearFilters}
            className={ui.btnUtilitySm}
          >
            Clear filters
          </button>
        ) : null}
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
      </div>
    </div>
  );
}
