"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import TaskCommentSection from "@/components/tasks/TaskCommentSection";
import { useTaskComments } from "@/lib/tasks/comments";
import { fieldLabel } from "@/lib/tasks/labels";
import {
  formatPanelTimestamp,
  panelDraftEquals,
  saveTaskPanel,
  TASK_PANEL_PRIORITY_OPTIONS,
  TASK_PANEL_STATUS_OPTIONS,
  taskToPanelDraft,
  type TaskPanelDraft,
} from "@/lib/tasks/taskPanel";
import type { Task, TaskViewMode } from "@/lib/tasks/types";
import { ui } from "@/lib/ui/classes";

type TaskPanelProps = {
  task: Task;
  onClose: () => void;
  onUpdated?: (task: Task) => void;
  mode?: TaskViewMode;
};

const inputClass = ui.input;
const labelClass = ui.label;

export default function TaskPanel({
  task,
  onClose,
  onUpdated,
  mode = "internal",
}: TaskPanelProps) {
  const isInternal = mode === "internal";
  const {
    commentsForType,
    loading: commentsLoading,
    error: commentsError,
    reload: reloadComments,
  } = useTaskComments(task._uuid, mode);

  const [draft, setDraft] = useState<TaskPanelDraft>(() => taskToPanelDraft(task));
  const [createdAt, setCreatedAt] = useState(task._createdAt);
  const [updatedAt, setUpdatedAt] = useState(task._updatedAt);
  const [updatedBy, setUpdatedBy] = useState(task._updatedBy);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastSavedRef = useRef(taskToPanelDraft(task));

  useEffect(() => {
    const next = taskToPanelDraft(task);
    setDraft(next);
    lastSavedRef.current = next;
    setCreatedAt(task._createdAt);
    setUpdatedAt(task._updatedAt);
    setUpdatedBy(task._updatedBy);
    setError(null);
  }, [task]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (panelDraftEquals(draft, lastSavedRef.current)) return;

    const timer = window.setTimeout(async () => {
      setSaving(true);
      setError(null);
      try {
        const updated = await saveTaskPanel(mode, task._uuid, draft);
        lastSavedRef.current = taskToPanelDraft(updated);
        setCreatedAt(updated._createdAt);
        setUpdatedAt(updated._updatedAt);
        setUpdatedBy(updated._updatedBy);
        onUpdated?.(updated);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save changes.");
      } finally {
        setSaving(false);
      }
    }, 700);

    return () => window.clearTimeout(timer);
  }, [draft, mode, onUpdated, task._uuid]);

  const updateField = useCallback(
    <K extends keyof TaskPanelDraft>(key: K, value: TaskPanelDraft[K]) => {
      setDraft((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-primary/40 backdrop-blur-[1px]"
        aria-label="Close task panel"
        onClick={onClose}
      />

      <aside
        className="relative flex h-full w-full max-w-[400px] flex-col border-l border-border bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-panel-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Task #{task.id}
            </p>
            <h2 id="task-panel-title" className="mt-1 text-lg font-semibold text-primary">
              Task details
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-2.5 py-1.5 text-sm font-semibold text-primary transition hover:bg-primary/5"
            aria-label="Close"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="space-y-4">
            <label className={labelClass}>
              Task title
              <input
                type="text"
                value={draft.title}
                onChange={(event) => updateField("title", event.target.value)}
                className={inputClass}
                placeholder="Task title"
              />
            </label>

            <label className={labelClass}>
              Status
              <select
                value={draft.status}
                onChange={(event) => updateField("status", event.target.value)}
                className={inputClass}
              >
                {TASK_PANEL_STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className={labelClass}>
              Priority
              <select
                value={draft.priority}
                onChange={(event) => updateField("priority", event.target.value)}
                className={inputClass}
              >
                {TASK_PANEL_PRIORITY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className={labelClass}>
              {fieldLabel("Responsible")}
              <input
                type="text"
                value={draft.responsible}
                onChange={(event) => updateField("responsible", event.target.value)}
                className={inputClass}
              />
            </label>

            <TaskCommentSection
              title="Client Comments"
              type="client"
              taskId={task._uuid}
              comments={commentsForType("client")}
              loading={commentsLoading}
              canPost
              onCommentAdded={() => void reloadComments()}
            />

            {isInternal ? (
              <TaskCommentSection
                title="Internal Comments"
                type="internal"
                taskId={task._uuid}
                comments={commentsForType("internal")}
                loading={commentsLoading}
                canPost
                onCommentAdded={() => void reloadComments()}
              />
            ) : null}

            {commentsError ? (
              <p className="text-xs text-red-600">{commentsError}</p>
            ) : null}
          </div>
        </div>

        <footer className="shrink-0 border-t border-border bg-background/40 px-5 py-4">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Created at</dt>
              <dd className="text-right text-primary">{formatPanelTimestamp(createdAt)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Updated at</dt>
              <dd className="text-right text-primary">{formatPanelTimestamp(updatedAt)}</dd>
            </div>
            {updatedBy ? (
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Updated by</dt>
                <dd className="truncate text-right text-primary">{updatedBy}</dd>
              </div>
            ) : null}
          </dl>

          {saving ? (
            <p className="mt-3 text-xs font-medium text-accent-dark">Saving…</p>
          ) : error ? (
            <p className="mt-3 text-xs text-red-600">{error}</p>
          ) : (
            <p className="mt-3 text-xs text-muted">Changes save automatically.</p>
          )}
        </footer>
      </aside>
    </div>
  );
}
