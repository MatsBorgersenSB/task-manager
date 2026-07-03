"use client";

import { ui } from "@/lib/ui/classes";

type TaskWorkspaceFocusBarProps = {
  onExit: () => void;
};

export default function TaskWorkspaceFocusBar({
  onExit,
}: TaskWorkspaceFocusBarProps) {
  return (
    <div className="no-print flex items-center justify-between gap-3 border-b border-border/60 bg-slate-50/90 px-3 py-1.5">
      <p className="text-xs text-muted">
        Collapsed header — table only. Press{" "}
        <kbd className="rounded border border-border bg-white px-1 py-0.5 font-mono text-[10px]">
          F
        </kbd>{" "}
        or{" "}
        <kbd className="rounded border border-border bg-white px-1 py-0.5 font-mono text-[10px]">
          Esc
        </kbd>{" "}
        to restore controls.
      </p>
      <button type="button" onClick={onExit} className={ui.btnSecondarySm}>
        Show header
      </button>
    </div>
  );
}
