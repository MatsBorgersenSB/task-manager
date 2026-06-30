"use client";

import type { HierarchyUndoAction } from "@/hooks/useHierarchyUndo";

type HierarchyUndoToastProps = {
  action: HierarchyUndoAction | null;
  undoing?: boolean;
  onUndo: () => void;
  onDismiss: () => void;
};

export default function HierarchyUndoToast({
  action,
  undoing = false,
  onUndo,
  onDismiss,
}: HierarchyUndoToastProps) {
  if (!action) return null;

  return (
    <div
      className="fixed bottom-6 left-1/2 z-[80] flex max-w-md -translate-x-1/2 items-center gap-3 rounded-lg border border-border bg-primary px-4 py-3 text-sm text-white shadow-lg"
      role="status"
      aria-live="polite"
    >
      <p className="min-w-0 flex-1">{action.message}</p>
      <button
        type="button"
        onClick={onUndo}
        disabled={undoing}
        className="shrink-0 rounded-md bg-white/15 px-3 py-1 text-xs font-semibold transition hover:bg-white/25 disabled:opacity-60"
      >
        {undoing ? "Undoing…" : "Undo"}
      </button>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 text-white/70 transition hover:text-white"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
