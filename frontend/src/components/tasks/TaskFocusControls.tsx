"use client";

import { ui } from "@/lib/ui/classes";

type TaskFocusControlsProps = {
  focusMode: boolean;
  isFullscreen: boolean;
  onToggleFocus: () => void;
  onToggleFullscreen: () => void;
  onExitFocus: () => void;
};

export default function TaskFocusControls({
  focusMode,
  isFullscreen,
  onToggleFocus,
  onToggleFullscreen,
  onExitFocus,
}: TaskFocusControlsProps) {
  return (
    <div className="no-print flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
      <button
        type="button"
        onClick={onToggleFocus}
        className={`${ui.btnSecondarySm} inline-flex items-center gap-1.5${
          focusMode ? " border-accent bg-accent/10 text-accent" : ""
        }`}
        aria-pressed={focusMode}
        title="Toggle Focus Mode (F)"
      >
        <span aria-hidden>⛶</span>
        {focusMode ? "Exit Focus" : "Focus Tasks"}
      </button>
      <button
        type="button"
        onClick={onToggleFullscreen}
        className={`${ui.btnSecondarySm} inline-flex items-center gap-1.5${
          isFullscreen ? " border-accent bg-accent/10 text-accent" : ""
        }`}
        aria-pressed={isFullscreen}
        title="Toggle fullscreen table"
      >
        <span aria-hidden>⛶</span>
        {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
      </button>
      {focusMode ? (
        <button
          type="button"
          onClick={onExitFocus}
          className="text-xs font-medium text-muted hover:text-primary"
        >
          ESC to exit focus
        </button>
      ) : (
        <span className="text-[10px] text-muted">Press F for focus mode</span>
      )}
    </div>
  );
}
