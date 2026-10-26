"use client";

import { useMemo, useState } from "react";
import {
  getDirectSuccessorTasks,
  getEffectivePredecessors,
  isTaskCompleted,
  listPredecessorCandidates,
} from "@/lib/tasks/dependencies";
import { taskDisplayId, taskHierarchyLabel } from "@/lib/tasks/subtasks";
import type { Task } from "@/lib/tasks/types";
import type { TaskDependency } from "@/lib/templates/types";
import { ui } from "@/lib/ui/classes";

type TaskDependenciesSectionProps = {
  activeTask: Task;
  allTasks: Task[];
  dependencies: TaskDependency[];
  canEdit: boolean;
  onAddDependency?: (predecessorTaskId: string) => Promise<void>;
  onRemoveDependency?: (dependencyId: string) => Promise<void>;
  onOpenTask?: (task: Task) => void;
};

export default function TaskDependenciesSection({
  activeTask,
  allTasks,
  dependencies,
  canEdit,
  onAddDependency,
  onRemoveDependency,
  onOpenTask,
}: TaskDependenciesSectionProps) {
  const [selectedPredId, setSelectedPredId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectivePredecessors = useMemo(
    () => getEffectivePredecessors(activeTask, allTasks, dependencies),
    [activeTask, allTasks, dependencies]
  );

  const directSuccessors = useMemo(
    () => getDirectSuccessorTasks(activeTask._uuid, allTasks, dependencies),
    [activeTask._uuid, allTasks, dependencies]
  );

  const candidates = useMemo(
    () => listPredecessorCandidates(activeTask, allTasks, dependencies),
    [activeTask, allTasks, dependencies]
  );

  async function handleAdd() {
    if (!selectedPredId || !onAddDependency) return;
    setBusy(true);
    setError(null);
    try {
      await onAddDependency(selectedPredId);
      setSelectedPredId("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not add dependency."
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(dependencyId: string) {
    if (!onRemoveDependency) return;
    setBusy(true);
    setError(null);
    try {
      await onRemoveDependency(dependencyId);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not remove dependency."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 space-y-3 border-t border-border/70 pt-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          Predecessor Dependencies (Can first start when completed)
        </p>
        <p className="mt-0.5 text-xs text-muted">
          Connect this task to another main task or subtask (e.g. #1.1). This
          task and its subtasks cannot start until all predecessors are
          completed.
        </p>
      </div>

      {effectivePredecessors.length === 0 ? (
        <p className="text-xs text-muted">
          No predecessor dependencies — this task can start anytime.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-white">
          {effectivePredecessors.map((entry) => {
            const pred = entry.predecessor;
            const predNumber = taskDisplayId(pred, allTasks);
            const predTitle = (pred.Issue ?? "").trim() || "Untitled";
            const inheritedFrom = entry.inheritedFromTask;

            return (
              <li
                key={`${entry.dependency.id}-${inheritedFrom?._uuid ?? "direct"}`}
                className="flex items-center justify-between gap-2 px-3 py-2 text-xs"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                        entry.isComplete
                          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                          : "bg-amber-50 text-amber-800 ring-1 ring-amber-300"
                      }`}
                    >
                      {entry.isComplete ? "✓ Completed" : "🔒 Blocking start"}
                    </span>
                    <button
                      type="button"
                      onClick={() => onOpenTask?.(pred)}
                      className="truncate font-semibold text-primary hover:text-accent hover:underline"
                    >
                      #{predNumber} — {predTitle}
                    </button>
                  </div>
                  {inheritedFrom ? (
                    <p className="mt-0.5 text-[11px] text-muted">
                      Inherited from parent{" "}
                      <button
                        type="button"
                        onClick={() => onOpenTask?.(inheritedFrom)}
                        className="font-medium text-accent hover:underline"
                      >
                        #{taskDisplayId(inheritedFrom, allTasks)}
                      </button>{" "}
                      (blocks #{taskDisplayId(inheritedFrom, allTasks)} and all
                      its subtasks)
                    </p>
                  ) : null}
                </div>

                {!inheritedFrom && canEdit && onRemoveDependency ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleRemove(entry.dependency.id)}
                    className="shrink-0 rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                    title="Remove predecessor link"
                  >
                    Remove
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {canEdit && onAddDependency ? (
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedPredId}
            disabled={busy || candidates.length === 0}
            onChange={(event) => setSelectedPredId(event.target.value)}
            aria-label="Select predecessor task or subtask"
            className={`${ui.input} min-w-[14rem] flex-1 py-1.5 text-xs`}
          >
            <option value="">
              {candidates.length === 0
                ? "No eligible tasks/subtasks to connect…"
                : "Connect to task or subtask (e.g. #1.1)…"}
            </option>
            {candidates.map((candidate) => {
              const done = isTaskCompleted(candidate);
              return (
                <option key={candidate._uuid} value={candidate._uuid}>
                  {taskHierarchyLabel(candidate, allTasks)}{" "}
                  {done ? "(Completed)" : "(Open)"}
                </option>
              );
            })}
          </select>
          <button
            type="button"
            disabled={busy || !selectedPredId}
            onClick={() => void handleAdd()}
            className={ui.btnSecondarySm}
          >
            {busy ? "Linking…" : "+ Connect Predecessor"}
          </button>
        </div>
      ) : null}

      {directSuccessors.length > 0 ? (
        <div className="pt-1">
          <p className="text-[11px] font-semibold text-muted">
            Tasks waiting on #{taskDisplayId(activeTask, allTasks)}:
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {directSuccessors.map((succ) => (
              <button
                key={succ._uuid}
                type="button"
                onClick={() => onOpenTask?.(succ)}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-primary hover:border-accent hover:text-accent"
              >
                <span>→</span>
                <span>{taskHierarchyLabel(succ, allTasks)}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
