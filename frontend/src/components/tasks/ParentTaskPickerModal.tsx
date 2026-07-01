"use client";

import { useEffect, useMemo, useState } from "react";
import type { Task } from "@/lib/tasks/types";
import { hierarchyShortName } from "@/lib/tasks/hierarchyDisplay";
import { getParentTask, taskHierarchyLabel } from "@/lib/tasks/subtasks";
import { ui } from "@/lib/ui/classes";

export type ParentTaskPickerMode = "convert" | "reparent" | "bulk";

type ParentTaskPickerModalProps = {
  open: boolean;
  mode?: ParentTaskPickerMode;
  task?: Task | null;
  tasks?: Task[];
  candidates: Task[];
  currentParentId?: string | null;
  allTasks?: Task[];
  loading?: boolean;
  error?: string | null;
  onConfirm: (parentTaskId: string) => void;
  onClose: () => void;
};

function modalCopy(mode: ParentTaskPickerMode, task?: Task | null, count = 1) {
  switch (mode) {
    case "reparent":
      return {
        title: "Move to different parent",
        description: task
          ? `Choose a new main task for ${taskHierarchyLabel(task)}.`
          : "Choose a new parent task.",
        confirm: "Move subtask",
      };
    case "bulk":
      return {
        title: "Move under task",
        description: `Choose which main task ${count} selected task${count === 1 ? "" : "s"} should sit under.`,
        confirm: "Move under task",
        previewConfirm: "Move tasks",
      };
    default:
      return {
        title: "Move under task",
        description: task
          ? `Choose which main task ${taskHierarchyLabel(task)} should sit under.`
          : "Choose a parent main task.",
        confirm: "Move under task",
      };
  }
}

export default function ParentTaskPickerModal({
  open,
  mode = "convert",
  task = null,
  tasks = [],
  candidates,
  currentParentId = null,
  allTasks = [],
  loading = false,
  error = null,
  onConfirm,
  onClose,
}: ParentTaskPickerModalProps) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [bulkStep, setBulkStep] = useState<"pick" | "confirm">("pick");

  const copy = modalCopy(mode, task, tasks.length);

  const selectedParent = useMemo(
    () => candidates.find((candidate) => candidate._uuid === selectedId) ?? null,
    [candidates, selectedId]
  );

  const currentParent = useMemo(() => {
    if (!currentParentId || !task) return null;
    return getParentTask(allTasks, task) ?? null;
  }, [allTasks, currentParentId, task]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((candidate) => {
      const label = taskHierarchyLabel(candidate).toLowerCase();
      return label.includes(q);
    });
  }, [candidates, query]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setSelectedId("");
      setBulkStep("pick");
    }
  }, [open]);

  if (!open) return null;

  const showBulkPreview = mode === "bulk" && bulkStep === "confirm" && selectedParent;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="parent-task-picker-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-primary/60 backdrop-blur-sm"
        aria-label="Close dialog"
        onClick={loading ? undefined : onClose}
      />
      <div className={`relative w-full max-w-lg p-6 ${ui.card}`}>
        <h3 id="parent-task-picker-title" className={ui.sectionTitle}>
          {showBulkPreview ? "Confirm move under task" : copy.title}
        </h3>

        {showBulkPreview ? (
          <>
            <p className="mt-3 text-sm text-primary">
              <span className="font-semibold">{tasks.length}</span> task
              {tasks.length === 1 ? "" : "s"} will become subtask
              {tasks.length === 1 ? "" : "s"} of:
            </p>
            <p className="mt-2 rounded-md border border-border bg-slate-50 px-3 py-2 text-sm font-bold text-primary">
              {hierarchyShortName(taskHierarchyLabel(selectedParent))}
            </p>
            <p className="mt-3 text-sm text-muted">Proceed?</p>
            <ul className="mt-3 max-h-36 space-y-1 overflow-y-auto text-xs text-muted">
              {tasks.map((entry) => (
                <li key={entry._uuid} className="truncate">
                  {taskHierarchyLabel(entry)}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted">{copy.description}</p>

            {mode === "reparent" && currentParent ? (
              <p className="mt-2 text-xs text-muted">
                Current parent:{" "}
                <span className="font-medium text-primary">
                  {taskHierarchyLabel(currentParent)}
                </span>
              </p>
            ) : null}

            <label className={`${ui.label} mt-4`} htmlFor="parent-task-search">
              Search parent tasks
            </label>
            <input
              id="parent-task-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by # or title…"
              className={ui.input}
              disabled={loading}
              autoFocus
            />

            <label className={`${ui.label} mt-3`} htmlFor="parent-task-select">
              Parent task
            </label>
            <select
              id="parent-task-select"
              value={selectedId}
              onChange={(event) => setSelectedId(event.target.value)}
              className={ui.input}
              disabled={loading || filtered.length === 0}
              size={Math.min(8, Math.max(3, filtered.length))}
            >
              <option value="">Select parent task…</option>
              {filtered.map((candidate) => (
                <option key={candidate._uuid} value={candidate._uuid}>
                  {taskHierarchyLabel(candidate)}
                </option>
              ))}
            </select>

            {candidates.length === 0 ? (
              <p className="mt-2 text-xs text-muted">
                No eligible main tasks are available.
              </p>
            ) : filtered.length === 0 ? (
              <p className="mt-2 text-xs text-muted">No tasks match your search.</p>
            ) : null}
          </>
        )}

        {error ? <p className="mt-3 text-xs text-red-600">{error}</p> : null}

        <div className="mt-6 flex justify-end gap-3">
          {showBulkPreview ? (
            <button
              type="button"
              disabled={loading}
              onClick={() => setBulkStep("pick")}
              className={ui.btnSecondary}
            >
              Back
            </button>
          ) : (
            <button
              type="button"
              disabled={loading}
              onClick={onClose}
              className={ui.btnSecondary}
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            disabled={loading || !selectedId}
            onClick={() => {
              if (mode === "bulk" && bulkStep === "pick" && selectedId) {
                setBulkStep("confirm");
                return;
              }
              onConfirm(selectedId);
            }}
            className={ui.btnPrimary}
          >
            {loading
              ? "Saving…"
              : showBulkPreview
                ? copy.previewConfirm ?? "Proceed"
                : copy.confirm}
          </button>
        </div>
      </div>
    </div>
  );
}
