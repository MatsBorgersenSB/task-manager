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
  onOpenTask: (task: Task) => void;
  onPromoteSubtask: (task: Task) => void;
  onToggleComplete: (task: Task) => void;
  onAddSubtask: () => void;
};

function formatSubtaskDueDate(task: Task): string {
  const due = task["Date Due"];
  if (!due) return "—";
  return normalizeDateInput(due);
}

function formatSubtaskStatus(task: Task): string {
  if (isSubtaskComplete(task)) return "Completed";
  return (task.status ?? "").trim() || "Open";
}

export default function TaskSubtasksSection({
  subtasks,
  busyId = null,
  adding = false,
  error = null,
  onOpenTask,
  onPromoteSubtask,
  onToggleComplete,
  onAddSubtask,
}: TaskSubtasksSectionProps) {
  return (
    <div className="space-y-3">
      {subtasks.length === 0 ? (
        <p className="text-sm text-muted">No subtasks yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <th className="pb-2 pr-2">Done</th>
                <th className="pb-2 pr-2">Issue</th>
                <th className="pb-2 pr-2">Responsible</th>
                <th className="pb-2 pr-2">Due</th>
                <th className="pb-2 pr-2">Status</th>
                <th className="pb-2 pr-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {subtasks.map((subtask) => {
                const completed = isSubtaskComplete(subtask);
                const busy = busyId === subtask._uuid;
                return (
                  <tr key={subtask._uuid} className="border-b border-border/70">
                    <td className="py-2 pr-2 align-top">
                      <input
                        type="checkbox"
                        checked={completed}
                        disabled={busy}
                        onChange={() => onToggleComplete(subtask)}
                        className="h-4 w-4 rounded border-border text-accent focus:ring-accent/30"
                        aria-label={
                          completed
                            ? "Mark subtask incomplete"
                            : "Mark subtask complete"
                        }
                      />
                    </td>
                    <td className="py-2 pr-2 align-top">
                      <span
                        className={`block max-w-[14rem] break-words ${
                          completed ? "text-muted line-through" : "text-primary"
                        }`}
                      >
                        {(subtask.Issue ?? "").trim() || "Untitled"}
                      </span>
                    </td>
                    <td className="py-2 pr-2 align-top text-primary/90">
                      {(subtask.Responsible ?? "").trim() || "—"}
                    </td>
                    <td className="py-2 pr-2 align-top whitespace-nowrap">
                      {formatSubtaskDueDate(subtask)}
                    </td>
                    <td className="py-2 pr-2 align-top whitespace-nowrap">
                      {formatSubtaskStatus(subtask)}
                    </td>
                    <td className="py-2 align-top">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => onOpenTask(subtask)}
                          className={ui.btnSecondarySm}
                        >
                          Open
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => onPromoteSubtask(subtask)}
                          className={ui.btnSecondarySm}
                        >
                          Promote
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {error ? <p className="text-xs text-red-600">{error}</p> : null}

      <button
        type="button"
        onClick={onAddSubtask}
        disabled={adding}
        className={ui.btnGhost}
      >
        {adding ? "Adding…" : "+ Add subtask"}
      </button>
    </div>
  );
}
