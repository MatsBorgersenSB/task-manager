"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import TaskCommentSection from "@/components/tasks/TaskCommentSection";
import TaskPanelSection from "@/components/tasks/TaskPanelSection";
import { deleteTaskApi } from "@/lib/tasks/api";
import { useTaskComments } from "@/lib/tasks/comments";
import { fieldLabel } from "@/lib/tasks/labels";
import {
  CLIENT_STATUS_OPTIONS,
  emptyPanelDraft,
  formatPanelTimestamp,
  panelDraftEquals,
  RISK_OPTIONS,
  saveTaskPanel,
  SB_STATUS_OPTIONS,
  taskToPanelDraft,
  type TaskPanelDraft,
} from "@/lib/tasks/taskPanel";
import type { AppUser, Task, TaskViewMode } from "@/lib/tasks/types";
import { ui } from "@/lib/ui/classes";

const ACTION_COMMENT_FIELD = "Response or Action taken by SB";

type TaskPanelProps = {
  task: Task | null;
  onClose: () => void;
  onUpdated?: (task: Task) => void;
  onCreated?: (task: Task) => void;
  onDeleted?: (task: Task) => void;
  mode?: TaskViewMode;
  users?: AppUser[];
};

const inputClass = ui.input;
const labelClass = ui.label;
const textareaClass = `${ui.input} ${ui.textarea}`;

export default function TaskPanel({
  task,
  onClose,
  onUpdated,
  onCreated,
  onDeleted,
  mode = "internal",
  users = [],
}: TaskPanelProps) {
  const isInternal = mode === "internal";
  const actionCommentReadOnly = !isInternal;

  const [activeTask, setActiveTask] = useState<Task | null>(task);
  const isNew = activeTask === null;

  const taskId = activeTask?._uuid ?? null;
  const {
    commentsForType,
    loading: commentsLoading,
    error: commentsError,
    reload: reloadComments,
  } = useTaskComments(taskId, mode);

  const [draft, setDraft] = useState<TaskPanelDraft>(() =>
    task ? taskToPanelDraft(task) : emptyPanelDraft()
  );
  const [createdAt, setCreatedAt] = useState(task?._createdAt);
  const [updatedAt, setUpdatedAt] = useState(task?._updatedAt);
  const [updatedBy, setUpdatedBy] = useState(task?._updatedBy);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const lastSavedRef = useRef<TaskPanelDraft>(
    task ? taskToPanelDraft(task) : emptyPanelDraft()
  );

  useEffect(() => {
    setActiveTask(task);
    const next = task ? taskToPanelDraft(task) : emptyPanelDraft();
    setDraft(next);
    lastSavedRef.current = next;
    setCreatedAt(task?._createdAt);
    setUpdatedAt(task?._updatedAt);
    setUpdatedBy(task?._updatedBy);
    setError(null);
  }, [task]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (deleteConfirmOpen) {
        if (!deleting) setDeleteConfirmOpen(false);
        return;
      }
      onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deleteConfirmOpen, deleting, onClose]);

  useEffect(() => {
    if (panelDraftEquals(draft, lastSavedRef.current)) return;
    if (!taskId && !draft.title.trim()) return;

    const timer = window.setTimeout(async () => {
      setSaving(true);
      setError(null);
      const creating = taskId === null;
      try {
        const saved = await saveTaskPanel(mode, taskId, draft);
        lastSavedRef.current = taskToPanelDraft(saved);
        setCreatedAt(saved._createdAt);
        setUpdatedAt(saved._updatedAt);
        setUpdatedBy(saved._updatedBy);

        if (creating) {
          setActiveTask(saved);
          onCreated?.(saved);
        } else {
          onUpdated?.(saved);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save.");
      } finally {
        setSaving(false);
      }
    }, 700);

    return () => window.clearTimeout(timer);
  }, [draft, mode, onCreated, onUpdated, taskId]);

  const updateField = useCallback(
    <K extends keyof TaskPanelDraft>(key: K, value: TaskPanelDraft[K]) => {
      setDraft((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const toggleSbOwner = useCallback((name: string, checked: boolean) => {
    setDraft((prev) => {
      const next = checked
        ? [...prev.sbOwners, name]
        : prev.sbOwners.filter((owner) => owner !== name);
      return { ...prev, sbOwners: next };
    });
  }, []);

  async function confirmDeleteTask() {
    if (!activeTask) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteTaskApi(mode, activeTask._uuid);
      setDeleteConfirmOpen(false);
      onDeleted?.(activeTask);
      onClose();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete task.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Delete task?"
        description="Are you sure you want to delete this task?"
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
        layerClassName="z-[60]"
        onConfirm={() => void confirmDeleteTask()}
        onCancel={() => {
          if (!deleting) setDeleteConfirmOpen(false);
        }}
      />

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
              {!isNew ? (
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Task #{activeTask.id}
                </p>
              ) : null}
              <h2 id="task-panel-title" className="mt-1 text-lg font-semibold text-primary">
                {isNew ? "New Task" : "Task Details"}
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

          <div className="flex-1 overflow-y-auto px-5 py-5">
            <TaskPanelSection title="Task details" first>
              <label className={labelClass}>
                {fieldLabel("Issue")}
                <input
                  type="text"
                  value={draft.title}
                  onChange={(event) => updateField("title", event.target.value)}
                  className={inputClass}
                  placeholder="Describe the task"
                />
              </label>
            </TaskPanelSection>

            <TaskPanelSection title="Client fields">
              <label className={labelClass}>
                {fieldLabel("status")}
                <select
                  value={draft.clientStatus}
                  onChange={(event) => updateField("clientStatus", event.target.value)}
                  className={inputClass}
                >
                  {!CLIENT_STATUS_OPTIONS.includes(
                    draft.clientStatus as (typeof CLIENT_STATUS_OPTIONS)[number]
                  ) && draft.clientStatus ? (
                    <option value={draft.clientStatus}>{draft.clientStatus}</option>
                  ) : null}
                  {CLIENT_STATUS_OPTIONS.map((option) => (
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

              <label className={labelClass}>
                {fieldLabel("Date Due")}
                <input
                  type="date"
                  value={draft.dateDue}
                  onChange={(event) => updateField("dateDue", event.target.value)}
                  className={inputClass}
                />
              </label>

              <label className={labelClass}>
                {fieldLabel("Date Completed")}
                <input
                  type="date"
                  value={draft.dateCompleted}
                  onChange={(event) => updateField("dateCompleted", event.target.value)}
                  className={inputClass}
                />
              </label>

              <label className={labelClass}>
                {fieldLabel(ACTION_COMMENT_FIELD)}
                <textarea
                  value={draft.actionComment}
                  onChange={(event) => updateField("actionComment", event.target.value)}
                  className={`${textareaClass}${actionCommentReadOnly ? " bg-background text-muted" : ""}`}
                  rows={3}
                  readOnly={actionCommentReadOnly}
                  tabIndex={actionCommentReadOnly ? -1 : undefined}
                />
              </label>
            </TaskPanelSection>

            {isInternal ? (
              <TaskPanelSection title="Internal fields">
                <label className={labelClass}>
                  {fieldLabel("SB Status")}
                  <select
                    value={draft.sbStatus}
                    onChange={(event) => updateField("sbStatus", event.target.value)}
                    className={inputClass}
                  >
                    <option value="">Select…</option>
                    {SB_STATUS_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={labelClass}>
                  {fieldLabel("Risk")}
                  <select
                    value={draft.risk}
                    onChange={(event) => updateField("risk", event.target.value)}
                    className={inputClass}
                  >
                    <option value="">Select…</option>
                    {RISK_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={labelClass}>
                  {fieldLabel("Risk Comment")}
                  <textarea
                    value={draft.riskComment}
                    onChange={(event) => updateField("riskComment", event.target.value)}
                    className={textareaClass}
                    rows={3}
                  />
                </label>

                <div className={labelClass}>
                  {fieldLabel("SB Owner")}
                  <div className="mt-1 grid max-h-48 grid-cols-2 gap-2 overflow-y-auto rounded-lg border border-border bg-surface p-3">
                    {users.length === 0 ? (
                      <span className="text-sm text-muted">No users loaded.</span>
                    ) : (
                      users.map((user) => (
                        <label
                          key={user.id}
                          className="flex items-center gap-2 text-sm text-primary/80"
                        >
                          <input
                            type="checkbox"
                            checked={draft.sbOwners.includes(user.name)}
                            onChange={(event) =>
                              toggleSbOwner(user.name, event.target.checked)
                            }
                            className="rounded border-border text-accent focus:ring-accent/20"
                          />
                          {user.name}
                        </label>
                      ))
                    )}
                  </div>
                </div>
              </TaskPanelSection>
            ) : null}

            <TaskPanelSection title="Communication">
              {isNew ? (
                <p className="text-sm text-muted">
                  Enter a task title to create the task, then add comments here.
                </p>
              ) : (
                <div className="space-y-6">
                  <TaskCommentSection
                    title="Client comments"
                    type="client"
                    taskId={taskId!}
                    comments={commentsForType("client")}
                    loading={commentsLoading}
                    canPost
                    embedded
                    onCommentAdded={() => void reloadComments()}
                  />

                  {isInternal ? (
                    <TaskCommentSection
                      title="Internal comments"
                      type="internal"
                      taskId={taskId!}
                      comments={commentsForType("internal")}
                      loading={commentsLoading}
                      canPost
                      embedded
                      onCommentAdded={() => void reloadComments()}
                    />
                  ) : null}

                  {commentsError ? (
                    <p className="text-xs text-red-600">{commentsError}</p>
                  ) : null}
                </div>
              )}
            </TaskPanelSection>

            <TaskPanelSection title="Metadata">
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Created at</dt>
                  <dd className="text-right text-primary">
                    {formatPanelTimestamp(createdAt)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Updated at</dt>
                  <dd className="text-right text-primary">
                    {formatPanelTimestamp(updatedAt)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Updated by</dt>
                  <dd className="truncate text-right text-primary">
                    {updatedBy ?? "—"}
                  </dd>
                </div>
              </dl>
            </TaskPanelSection>

            {!isNew ? (
              <div className="mt-8 border-t border-border pt-6">
                {deleteError ? (
                  <p className="mb-3 text-xs text-red-600">{deleteError}</p>
                ) : null}
                <button
                  type="button"
                  disabled={deleting || saving}
                  onClick={() => setDeleteConfirmOpen(true)}
                  className={`${ui.btnDangerLg} w-full disabled:opacity-50`}
                >
                  {deleting ? "Deleting…" : "Delete task"}
                </button>
                <p className="mt-2 text-xs text-slate-500">
                  This action cannot be undone
                </p>
              </div>
            ) : null}
          </div>

          <footer className="shrink-0 border-t border-border bg-background/40 px-5 py-3">
            {saving ? (
              <p className="text-xs font-medium text-accent-dark">
                {isNew ? "Creating…" : "Saving…"}
              </p>
            ) : error ? (
              <p className="text-xs text-red-600">{error}</p>
            ) : isNew && !draft.title.trim() ? (
              <p className="text-xs text-muted">Enter a task title to create.</p>
            ) : (
              <p className="text-xs text-muted">Changes save automatically.</p>
            )}
          </footer>
        </aside>
      </div>
    </>
  );
}
