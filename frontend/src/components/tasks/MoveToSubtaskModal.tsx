"use client";

import { useMemo, useState } from "react";
import type { Task } from "@/lib/tasks/types";
import { ui } from "@/lib/ui/classes";

type MoveToSubtaskModalProps = {
  open: boolean;
  task: Task | null;
  candidates: Task[];
  loading?: boolean;
  error?: string | null;
  onConfirm: (parentTaskId: string) => void;
  onClose: () => void;
};

export default function MoveToSubtaskModal({
  open,
  task,
  candidates,
  loading = false,
  error = null,
  onConfirm,
  onClose,
}: MoveToSubtaskModalProps) {
  const [selectedId, setSelectedId] = useState("");

  const options = useMemo(
    () =>
      candidates.map((candidate) => ({
        id: candidate._uuid,
        label: `#${candidate.id} — ${(candidate.Issue ?? "").trim() || "Untitled"}`,
      })),
    [candidates]
  );

  if (!open || !task) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="move-to-subtask-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-primary/60 backdrop-blur-sm"
        aria-label="Close dialog"
        onClick={loading ? undefined : onClose}
      />
      <div className={`relative w-full max-w-lg p-6 ${ui.card}`}>
        <h3 id="move-to-subtask-title" className={ui.sectionTitle}>
          Move to subtask
        </h3>
        <p className="mt-2 text-sm text-muted">
          Select a main task to attach{" "}
          <span className="font-medium text-primary">
            #{task.id} — {(task.Issue ?? "").trim() || "Untitled"}
          </span>{" "}
          as a subtask.
        </p>

        <label className={`${ui.label} mt-4`} htmlFor="move-to-subtask-parent">
          Parent task
        </label>
        <select
          id="move-to-subtask-parent"
          value={selectedId}
          onChange={(event) => setSelectedId(event.target.value)}
          className={ui.input}
          disabled={loading || options.length === 0}
        >
          <option value="">Select parent task…</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>

        {options.length === 0 ? (
          <p className="mt-2 text-xs text-muted">
            No other main tasks are available.
          </p>
        ) : null}

        {error ? <p className="mt-3 text-xs text-red-600">{error}</p> : null}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className={ui.btnSecondary}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loading || !selectedId}
            onClick={() => onConfirm(selectedId)}
            className={ui.btnPrimary}
          >
            {loading ? "Moving…" : "Move to subtask"}
          </button>
        </div>
      </div>
    </div>
  );
}
