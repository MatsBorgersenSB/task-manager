"use client";

import AppModal from "@/components/shared/AppModal";
import { ui } from "@/lib/ui/classes";

type KeyboardShortcutsModalProps = {
  open: boolean;
  onClose: () => void;
  isInternal: boolean;
};

type ShortcutItem = {
  keys: string[];
  description: string;
  internalOnly?: boolean;
};

const SHORTCUTS: ShortcutItem[] = [
  {
    keys: ["F"],
    description: "Toggle Focus Mode (collapse/expand workspace header)",
  },
  {
    keys: ["?"],
    description: "Open or close this keyboard shortcuts guide",
  },
  {
    keys: ["Esc"],
    description: "Close open task panel, modal, or exit Focus/Fullscreen mode",
  },
  {
    keys: ["↑", "↓", "←", "→"],
    description: "Navigate between cells in the task table",
  },
  {
    keys: ["Enter"],
    description: "Edit selected table cell or submit Quick Add task row",
  },
  {
    keys: ["M"],
    description: "Move open task under a parent task (when Task Panel is open)",
    internalOnly: true,
  },
  {
    keys: ["P"],
    description: "Promote open subtask to a main task (when Task Panel is open)",
    internalOnly: true,
  },
  {
    keys: ["S"],
    description: "Create a subtask under the open task (when Task Panel is open)",
    internalOnly: true,
  },
];

export default function KeyboardShortcutsModal({
  open,
  onClose,
  isInternal,
}: KeyboardShortcutsModalProps) {
  const visibleShortcuts = SHORTCUTS.filter(
    (item) => !item.internalOnly || isInternal
  );

  return (
    <AppModal
      open={open}
      onClose={onClose}
      ariaLabelledBy="keyboard-shortcuts-title"
      panelClassName="max-w-md p-6"
    >
      <div className="flex items-start justify-between gap-3 border-b border-border/60 pb-3">
        <div>
          <h2
            id="keyboard-shortcuts-title"
            className="text-base font-semibold text-primary"
          >
            Keyboard Shortcuts
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            Speed up your daily task management workflow
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-2 py-1 text-xs font-semibold text-muted hover:bg-slate-100 hover:text-primary"
          aria-label="Close keyboard shortcuts"
        >
          ✕
        </button>
      </div>

      <div className="mt-2 divide-y divide-border/60">
        {visibleShortcuts.map((shortcut) => (
          <div
            key={shortcut.description}
            className="flex items-center justify-between gap-4 py-2.5"
          >
            <span className="text-xs text-primary/90">
              {shortcut.description}
            </span>
            <div className="flex shrink-0 items-center gap-1">
              {shortcut.keys.map((key) => (
                <kbd
                  key={key}
                  className="inline-flex min-w-[1.5rem] items-center justify-center rounded border border-border bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-primary shadow-sm"
                >
                  {key}
                </kbd>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex justify-end border-t border-border/60 pt-3">
        <button
          type="button"
          onClick={onClose}
          className={ui.btnPrimarySm}
        >
          Got it
        </button>
      </div>
    </AppModal>
  );
}
