"use client";

import type { Task } from "@/lib/tasks/types";
import { isSubtaskComplete } from "@/lib/tasks/subtasks";
import { normalizeDateInput } from "@/lib/tasks/utils";
import { ui } from "@/lib/ui/classes";

type TaskSubtasksSectionProps = {
  subtasks: Task[];
  busyId?: string | null;
  adding?: boolean;
  error?: string | null;
  canEdit?: boolean;
  onOpenTask: (task: Task) => void;
  onToggleComplete: (task: Task) => void;
  onAddSubtask: () => void;
};

function formatSubtaskDueDate(task: Task): string {
  const due = task["Date Due"];
  if (!due) return "—";
  return normalizeDateInput(due);
}

export default function TaskSubtasksSection({
  subtasks,
  busyId = null,
  adding = false,
  error = null,
  canEdit = true,
  onOpenTask,
  onToggleComplete,
  onAddSubtask,
}: TaskSubtasksSectionProps) {
  return (
    <div className="space-y-3">
      {subtasks.length === 0 ? (
        <p className="text-sm text-muted">No subtasks yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {subtasks.map((subtask) => {
            const completed = isSubtaskComplete(subtask);
            const busy = busyId === subtask._uuid;
            const title = (subtask.Issue ?? "").trim() || "Untitled";
            const responsible = (subtask.Responsible ?? "").trim() || "—";

            return (
              <li key={subtask._uuid}>
                <div className="flex items-start gap-3 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={completed}
                    disabled={busy || !canEdit}
                    onChange={() => onToggleComplete(subtask)}
                    onClick={(event) => event.stopPropagation()}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-border text-accent focus:ring-accent/30"
                    aria-label={
                      completed
                        ? "Mark subtask incomplete"
                        : "Mark subtask complete"
                    }
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onOpenTask(subtask)}
                    className="min-w-0 flex-1 text-left transition hover:opacity-80"
                  >
                    <p
                      className={`text-sm font-medium ${
                        completed
                          ? "text-muted line-through"
                          : "text-primary"
                      }`}
                    >
                      {title}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {responsible} · Due {formatSubtaskDueDate(subtask)}
                    </p>
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {error ? <p className="text-xs text-red-600">{error}</p> : null}

      {canEdit ? (
        <button
          type="button"
          onClick={onAddSubtask}
          disabled={adding}
          className={ui.btnGhost}
        >
          {adding ? "Adding…" : "+ Add Subtask"}
        </button>
      ) : null}
    </div>
  );
}
