"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import TaskActivitySection from "@/components/tasks/TaskActivitySection";
import TaskCommentSection from "@/components/tasks/TaskCommentSection";
import TaskPanelField from "@/components/tasks/TaskPanelField";
import TaskPanelSection from "@/components/tasks/TaskPanelSection";
import TaskVisibilityField from "@/components/tasks/TaskVisibilityField";
import { deleteTaskApi } from "@/lib/tasks/api";
import { formatAreaCodeChangeMessage } from "@/lib/tasks/areasApi";
import { useTaskComments } from "@/lib/tasks/comments";
import { panelColumnsByGroup } from "@/lib/tasks/panelFields";
import {
  emptyPanelDraft,
  getAreaInputForSave,
  panelDraftEquals,
  saveTaskPanel,
  setPanelDraftField,
  taskToPanelDraft,
  type TaskPanelDraft,
} from "@/lib/tasks/taskPanel";
import type { Area } from "@/lib/tasks/areas";
import type { AppUser, Task, TaskViewMode } from "@/lib/tasks/types";
import { ui } from "@/lib/ui/classes";

const PANEL_WIDTH_STORAGE_KEY = "task-panel-width";
const PANEL_DEFAULT_WIDTH = 400;
const MIN_WIDTH = 320;
const MAX_WIDTH = 800;
const MOBILE_PANEL_MAX_WIDTH = 767;
const PANEL_AUTO_SAVE_DEBOUNCE_MS = 2500;

function useMobilePanelLayout(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(`(max-width: ${MOBILE_PANEL_MAX_WIDTH}px)`);
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return isMobile;
}

function clampPanelWidth(newWidth: number): number {
  const clamped = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, newWidth));
  return clamped;
}

function readStoredPanelWidth(): number {
  if (typeof window === "undefined") return PANEL_DEFAULT_WIDTH;
  const stored = window.localStorage.getItem(PANEL_WIDTH_STORAGE_KEY);
  const parsed = stored ? Number(stored) : NaN;
  if (!Number.isFinite(parsed)) return PANEL_DEFAULT_WIDTH;
  return clampPanelWidth(parsed);
}

function persistPanelWidth(width: number) {
  window.localStorage.setItem(PANEL_WIDTH_STORAGE_KEY, String(width));
}

type TaskPanelProps = {
  task: Task | null;
  areas?: Area[];
  onAreasChange?: (areas: Area[]) => void;
  onClose: () => void;
  onUpdated?: (task: Task) => void;
  onCreated?: (task: Task) => void;
  onDeleted?: (task: Task) => void;
  mode?: TaskViewMode;
  users?: AppUser[];
};

export default function TaskPanel({
  task,
  areas = [],
  onAreasChange,
  onClose,
  onUpdated,
  onCreated,
  onDeleted,
  mode = "internal",
  users = [],
}: TaskPanelProps) {
  const isInternal = mode === "internal";

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
    task ? taskToPanelDraft(task, areas) : emptyPanelDraft()
  );
  const [createdAt, setCreatedAt] = useState(task?._createdAt);
  const [updatedAt, setUpdatedAt] = useState(task?._updatedAt);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [areaNotice, setAreaNotice] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const lastSavedRef = useRef<TaskPanelDraft>(
    task ? taskToPanelDraft(task, areas) : emptyPanelDraft()
  );
  const openTaskUuidRef = useRef<string | null>(task?._uuid ?? null);
  const [panelWidth, setPanelWidth] = useState(PANEL_DEFAULT_WIDTH);
  const [isDragging, setIsDragging] = useState(false);
  const [resizeHandleFlash, setResizeHandleFlash] = useState(false);
  const isMobile = useMobilePanelLayout();
  const isResizingRef = useRef(false);
  const resizeStartRef = useRef({ startX: 0, startWidth: PANEL_DEFAULT_WIDTH });

  useEffect(() => {
    setPanelWidth(readStoredPanelWidth());
  }, []);

  useEffect(() => {
    if (!isMobile) return;
    isResizingRef.current = false;
    setIsDragging(false);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, [isMobile]);

  useEffect(() => {
    function onMouseMove(event: MouseEvent) {
      if (!isResizingRef.current) return;
      const { startX, startWidth } = resizeStartRef.current;
      const newWidth = startWidth + (startX - event.clientX);
      const clamped = clampPanelWidth(newWidth);
      setPanelWidth((current) => (current === clamped ? current : clamped));
    }

    function onMouseUp() {
      if (!isResizingRef.current) return;
      isResizingRef.current = false;
      setIsDragging(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setPanelWidth((width) => {
        const clamped = clampPanelWidth(width);
        persistPanelWidth(clamped);
        return clamped;
      });
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      isResizingRef.current = false;
      setIsDragging(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, []);

  const handleResizeMouseDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (isMobile || event.detail > 1) return;
      event.preventDefault();
      event.stopPropagation();
      isResizingRef.current = true;
      setIsDragging(true);
      const startWidth = clampPanelWidth(panelWidth);
      resizeStartRef.current = { startX: event.clientX, startWidth };
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [isMobile, panelWidth]
  );

  const handleResizeDoubleClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (isMobile) return;
      event.preventDefault();
      event.stopPropagation();
      isResizingRef.current = false;
      setIsDragging(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setPanelWidth(PANEL_DEFAULT_WIDTH);
      persistPanelWidth(PANEL_DEFAULT_WIDTH);
      setResizeHandleFlash(true);
    },
    [isMobile]
  );

  useEffect(() => {
    if (!resizeHandleFlash) return;
    const timer = window.setTimeout(() => setResizeHandleFlash(false), 350);
    return () => window.clearTimeout(timer);
  }, [resizeHandleFlash]);

  const { client: clientColumns, internal: internalColumns } = useMemo(
    () => panelColumnsByGroup(mode),
    [mode]
  );

  const internalFieldsWithoutVisibility = useMemo(
    () => internalColumns.filter((column) => column.fieldName !== "Visibility"),
    [internalColumns]
  );

  useEffect(() => {
    const next = task ? taskToPanelDraft(task, areas) : emptyPanelDraft();
    const taskUuid = task?._uuid ?? null;
    const switchedTask = taskUuid !== openTaskUuidRef.current;
    openTaskUuidRef.current = taskUuid;

    setActiveTask(task);
    setCreatedAt(task?._createdAt);
    setUpdatedAt(task?._updatedAt);
    setError(null);

    if (switchedTask) {
      setDraft(next);
      lastSavedRef.current = next;
      return;
    }

    setDraft((current) => {
      if (panelDraftEquals(current, lastSavedRef.current)) {
        lastSavedRef.current = next;
        return next;
      }
      return current;
    });
  }, [task, areas]);

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
      const creating = taskId === null;

      const { isCustom, areaInput } = getAreaInputForSave(draft);
      if (isCustom && !areaInput) {
        if (!error) {
          setError("Area name cannot be empty");
        }
        setSaving(false);
        return;
      }

      if (error && areaInput) {
        setError(null);
      }

      try {
        setError(null);
        const previousDraft = lastSavedRef.current;
        const result = await saveTaskPanel(
          mode,
          taskId,
          draft,
          areas,
          previousDraft
        );
        const saved = result.task;
        const nextAreas = result.areas ?? areas;
        if (result.areas) {
          onAreasChange?.(result.areas);
        }
        const savedDraft = taskToPanelDraft(saved, nextAreas);
        lastSavedRef.current = savedDraft;
        setDraft(savedDraft);
        setCreatedAt(saved._createdAt);
        setUpdatedAt(saved._updatedAt);
        setAreaNotice(
          result.areaUpdate
            ? formatAreaCodeChangeMessage(result.areaUpdate) || null
            : null
        );

        if (creating) {
          setActiveTask(saved);
          onCreated?.(saved);
        } else {
          onUpdated?.(saved);
        }
      } catch (err) {
        setAreaNotice(null);
        setError(err instanceof Error ? err.message : "Failed to save.");
      } finally {
        setSaving(false);
      }
    }, PANEL_AUTO_SAVE_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [areas, draft, error, mode, onAreasChange, onCreated, onUpdated, taskId]);

  const updateField = useCallback((fieldName: string, value: string) => {
    setDraft((prev) => setPanelDraftField(prev, fieldName, value));
  }, []);

  const updateArea = useCallback(
    (
      selectedValue: string,
      customAreaInput: string,
      meta?: { areaId?: string; editName?: string }
    ) => {
      setDraft((prev) => ({
        ...prev,
        areaSelectedValue: selectedValue,
        customAreaInput,
        areaSelectedId:
          meta?.areaId !== undefined ? meta.areaId : prev.areaSelectedId,
        areaEditName:
          meta?.editName !== undefined ? meta.editName : prev.areaEditName,
      }));
    },
    []
  );

  const toggleSbOwner = useCallback((name: string, checked: boolean) => {
    setDraft((prev) => {
      const next = checked
        ? [...prev.sbOwners, name]
        : prev.sbOwners.filter((owner) => owner !== name);
      return setPanelDraftField(prev, "SB Owner", next);
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
        layerClassName="z-[1100]"
        onConfirm={() => void confirmDeleteTask()}
        onCancel={() => {
          if (!deleting) setDeleteConfirmOpen(false);
        }}
      />

      <div
        className="fixed inset-x-0 bottom-0 top-[100px] z-[1000] flex justify-end shadow-[0_-2px_8px_rgba(0,0,0,0.05)]"
        role="presentation"
      >
        <button
          type="button"
          className="absolute inset-0 bg-primary/40 backdrop-blur-[1px]"
          aria-label="Close task panel"
          onClick={onClose}
        />

        <aside
          className="relative flex h-full max-h-[calc(100vh-100px)] w-full shrink-0 flex-col overflow-visible border-l border-border bg-white shadow-2xl md:w-auto"
          style={{
            width: isMobile ? "100%" : panelWidth,
            minWidth: isMobile ? undefined : MIN_WIDTH,
            maxWidth: isMobile ? "100%" : MAX_WIDTH,
            transition: isDragging ? "none" : "width 0.1s ease",
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="task-panel-title"
          onClick={(event) => event.stopPropagation()}
        >
          {!isMobile ? (
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize task panel"
              aria-valuenow={panelWidth}
              aria-valuemin={MIN_WIDTH}
              aria-valuemax={MAX_WIDTH}
              className={`group absolute left-0 top-0 z-10 h-full w-1.5 cursor-col-resize touch-none before:absolute before:-left-1 before:top-0 before:h-full before:w-4 before:content-[''] bg-gradient-to-r from-primary/20 via-border/90 to-transparent opacity-75 transition-all duration-150 hover:from-primary/30 hover:via-primary/15 hover:opacity-100 ${
                isDragging
                  ? "from-accent/45 via-accent/30 to-accent/5 opacity-100"
                  : resizeHandleFlash
                    ? "from-accent/40 via-accent/25 to-transparent opacity-100"
                    : ""
              }`}
              onMouseDown={handleResizeMouseDown}
              onDoubleClick={handleResizeDoubleClick}
            >
              <div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 left-1/2 flex -translate-x-1/2 flex-col items-center justify-center gap-1.5 py-8"
              >
                <span
                  className={`h-1 w-1 rounded-full transition-colors ${
                    isDragging
                      ? "bg-accent"
                      : "bg-primary/35 group-hover:bg-primary/55"
                  }`}
                />
                <span
                  className={`h-1 w-1 rounded-full transition-colors ${
                    isDragging
                      ? "bg-accent"
                      : "bg-primary/35 group-hover:bg-primary/55"
                  }`}
                />
                <span
                  className={`h-1 w-1 rounded-full transition-colors ${
                    isDragging
                      ? "bg-accent"
                      : "bg-primary/35 group-hover:bg-primary/55"
                  }`}
                />
              </div>
            </div>
          ) : null}

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

          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-visible px-5 py-5 max-h-[calc(100vh-120px)]">
            {isInternal ? (
              <TaskVisibilityField
                value={draft.visibilityScope}
                onChange={(value) => updateField("Visibility", value)}
              />
            ) : null}

            <TaskPanelSection title="Client fields" first={!isInternal}>
              {clientColumns.map((column) => (
                <TaskPanelField
                  key={column.id}
                  column={column}
                  mode={mode}
                  draft={draft}
                  users={users}
                  areas={areas}
                  onFieldChange={updateField}
                  onAreaChange={updateArea}
                  onSbOwnerToggle={toggleSbOwner}
                />
              ))}
            </TaskPanelSection>

            {isInternal && internalFieldsWithoutVisibility.length > 0 ? (
              <TaskPanelSection title="Internal fields">
                {internalFieldsWithoutVisibility.map((column) => (
                  <TaskPanelField
                    key={column.id}
                    column={column}
                    mode={mode}
                    draft={draft}
                    users={users}
                    areas={areas}
                    onFieldChange={updateField}
                    onAreaChange={updateArea}
                    onSbOwnerToggle={toggleSbOwner}
                  />
                ))}
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

            {isInternal && taskId && !isNew ? (
              <TaskActivitySection
                taskId={taskId}
                createdAt={createdAt}
                updatedAt={updatedAt}
                refreshKey={updatedAt}
              />
            ) : null}

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
            ) : areaNotice ? (
              <p className="text-xs font-medium text-emerald-700">{areaNotice}</p>
            ) : isNew && !draft.title.trim() ? (
              <p className="text-xs text-muted">Enter a task title to create.</p>
            ) : (
              <p className="text-xs text-muted">Changes save automatically after you pause editing.</p>
            )}
          </footer>
        </aside>
      </div>
    </>
  );
}
