"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import ParentTaskPickerModal from "@/components/tasks/ParentTaskPickerModal";
import TaskAcknowledgeSection from "@/components/tasks/TaskAcknowledgeSection";
import TaskActivitySection from "@/components/tasks/TaskActivitySection";
import TaskCommentSection from "@/components/tasks/TaskCommentSection";
import TaskLinksSection from "@/components/tasks/TaskLinksSection";
import TaskPanelField from "@/components/tasks/TaskPanelField";
import TaskPanelSection from "@/components/tasks/TaskPanelSection";
import TaskSubtasksSection from "@/components/tasks/TaskSubtasksSection";
import TaskRelationshipsSection from "@/components/tasks/TaskRelationshipsSection";
import TaskVisibilityField from "@/components/tasks/TaskVisibilityField";
import { deleteTaskApi } from "@/lib/tasks/api";
import { uiLayers } from "@/lib/ui/layers";
import {
  formatAreaCodeChangeMessage,
  AreaUpdateError,
  AREA_UPDATE_USER_MESSAGE,
} from "@/lib/tasks/areasApi";
import { useTaskComments } from "@/lib/tasks/comments";
import {
  panelColumnsByGroup,
  partitionClientPanelColumns,
  prominentInternalPanelColumns,
  remainingInternalPanelColumns,
} from "@/lib/tasks/panelFields";
import { normalizeVisibilityScope } from "@/lib/tasks/visibility";
import {
  applyUpdatedAreaToDraft,
  emptyPanelDraft,
  getAreaInputForSave,
  mergePanelDraftFromTask,
  panelDraftEquals,
  saveTaskPanel,
  resolveAreaIdFromDraft,
  setInterventionDuration,
  setPanelDraftField,
  syncDraftAfterSave,
  taskToPanelDraft,
  type TaskPanelDraft,
} from "@/lib/tasks/taskPanel";
import {
  findAreaInListById,
  findAreaRecordByCode,
  type Area,
} from "@/lib/tasks/areas";
import type { AppUser, Task, TaskViewMode } from "@/lib/tasks/types";
import { notifyPanelSaveChanges } from "@/lib/tasks/taskNotifications";
import {
  canMoveTaskToSubtask,
  canReparentSubtask,
  getParentTask,
  getSubtasksForParent,
  listParentTaskCandidates,
} from "@/lib/tasks/subtasks";
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

function HierarchyIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="3" width="6" height="5" rx="1" />
      <rect x="3" y="16" width="6" height="5" rx="1" />
      <rect x="15" y="16" width="6" height="5" rx="1" />
      <path d="M12 8v3" />
      <path d="M6 16v-1a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
    </svg>
  );
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
  allTasks?: Task[];
  areas?: Area[];
  onAreasChange?: (areas: Area[]) => void;
  onClose: () => void;
  onUpdated?: (task: Task) => void;
  onCreated?: (task: Task) => void;
  onDeleted?: (task: Task) => void;
  onOpenSubtask?: (task: Task) => void;
  onCreateSubtask?: (parent: Task) => Promise<void>;
  onPromoteSubtask?: (subtask: Task) => Promise<void>;
  onMoveToSubtask?: (task: Task, parentTaskId: string) => Promise<void>;
  onToggleSubtaskComplete?: (subtask: Task) => Promise<void>;
  onManageLinks?: (task: Task) => void;
  projectId?: string | null;
  mode?: TaskViewMode;
  users?: AppUser[];
  onCommentsChanged?: () => void;
  readOnly?: boolean;
  /** When true, panel fills the browser fullscreen element (no app header offset). */
  fullscreenLayout?: boolean;
};

export default function TaskPanel({
  task,
  allTasks = [],
  areas = [],
  onAreasChange,
  onClose,
  onUpdated,
  onCreated,
  onDeleted,
  onOpenSubtask,
  onCreateSubtask,
  onPromoteSubtask,
  onMoveToSubtask,
  onToggleSubtaskComplete,
  onManageLinks,
  projectId = null,
  mode = "internal",
  users = [],
  onCommentsChanged,
  readOnly = false,
  fullscreenLayout = false,
}: TaskPanelProps) {
  const isInternal = mode === "internal";
  const canEditPanel = isInternal && !readOnly;

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
  const [updatedBy, setUpdatedBy] = useState(task?._updatedBy);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [areaNotice, setAreaNotice] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [moveModalMode, setMoveModalMode] = useState<"convert" | "reparent">(
    "convert"
  );
  const [moveLoading, setMoveLoading] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [subtaskBusyId, setSubtaskBusyId] = useState<string | null>(null);
  const [subtaskError, setSubtaskError] = useState<string | null>(null);
  const [addingSubtask, setAddingSubtask] = useState(false);
  const lastSavedRef = useRef<TaskPanelDraft>(
    task ? taskToPanelDraft(task, areas) : emptyPanelDraft()
  );
  const createInFlightRef = useRef(false);
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

  const { generalColumns, clientInfoColumns } = useMemo(() => {
    const { core, generalProminent, clientInfo } =
      partitionClientPanelColumns(clientColumns);
    const riskAndNotes = isInternal
      ? prominentInternalPanelColumns(internalColumns)
      : [];
    return {
      generalColumns: [...core, ...generalProminent, ...riskAndNotes],
      clientInfoColumns: clientInfo,
    };
  }, [clientColumns, internalColumns, isInternal]);

  const [showClientFields, setShowClientFields] = useState(true);

  const internalFieldsWithoutVisibility = useMemo(
    () => remainingInternalPanelColumns(internalColumns),
    [internalColumns]
  );

  const subtasks = useMemo(
    () => getSubtasksForParent(allTasks, activeTask?._uuid),
    [activeTask?._uuid, allTasks]
  );

  const parentTask = useMemo(
    () => (activeTask ? getParentTask(allTasks, activeTask) : undefined),
    [activeTask, allTasks]
  );

  const parentCandidates = useMemo(
    () =>
      activeTask
        ? listParentTaskCandidates(allTasks, activeTask, {
            excludeParentId:
              moveModalMode === "reparent" ? activeTask.parent_task_id : null,
          })
        : [],
    [activeTask, allTasks, moveModalMode]
  );

  const canMoveToSubtask =
    activeTask != null && canMoveTaskToSubtask(activeTask, allTasks);
  const canReparent =
    activeTask != null && canReparentSubtask(activeTask, allTasks);

  const runSubtaskAction = useCallback(
    async (subtask: Task, action: () => Promise<void>) => {
      setSubtaskError(null);
      setSubtaskBusyId(subtask._uuid);
      try {
        await action();
      } catch (err) {
        setSubtaskError(
          err instanceof Error ? err.message : "Subtask action failed."
        );
      } finally {
        setSubtaskBusyId(null);
      }
    },
    []
  );

  const handleAddSubtask = useCallback(async () => {
    if (!activeTask || !onCreateSubtask) return;
    setSubtaskError(null);
    setAddingSubtask(true);
    try {
      await onCreateSubtask(activeTask);
    } catch (err) {
      setSubtaskError(
        err instanceof Error ? err.message : "Failed to add subtask."
      );
    } finally {
      setAddingSubtask(false);
    }
  }, [activeTask, onCreateSubtask]);

  const handleConfirmMoveToSubtask = useCallback(
    async (parentTaskId: string) => {
      if (!activeTask || !onMoveToSubtask) return;
      setMoveError(null);
      setMoveLoading(true);
      try {
        await onMoveToSubtask(activeTask, parentTaskId);
        setMoveModalOpen(false);
      } catch (err) {
        setMoveError(
          err instanceof Error ? err.message : "Failed to move task."
        );
      } finally {
        setMoveLoading(false);
      }
    },
    [activeTask, onMoveToSubtask]
  );

  useEffect(() => {
    const next = task ? taskToPanelDraft(task, areas) : emptyPanelDraft();
    const taskUuid = task?._uuid ?? null;
    const switchedTask = taskUuid !== openTaskUuidRef.current;
    openTaskUuidRef.current = taskUuid;

    setActiveTask(task);
    setCreatedAt(task?._createdAt);
    setUpdatedAt(task?._updatedAt);
    setUpdatedBy(task?._updatedBy);
    setError(null);

    if (switchedTask) {
      setDraft(next);
      lastSavedRef.current = next;
      setShowClientFields(
        normalizeVisibilityScope(next.visibilityScope) !== "internal"
      );
      return;
    }

    setDraft((current) => {
      if (panelDraftEquals(current, lastSavedRef.current)) {
        const merged = mergePanelDraftFromTask(lastSavedRef.current, next);
        lastSavedRef.current = merged;
        return merged;
      }
      return current;
    });
  }, [task, areas]);

  useEffect(() => {
    setDraft((prev) => {
      const areaId = resolveAreaIdFromDraft(prev, areas);
      if (!areaId) return prev;

      const byId = findAreaInListById(areaId, areas);
      if (!byId) {
        if (areaId === prev.areaSelectedId) return prev;
        return { ...prev, areaSelectedId: areaId };
      }

      if (
        prev.areaSelectedId === byId.id &&
        prev.areaSelectedValue === byId.code &&
        prev.areaEditName === byId.name
      ) {
        return prev;
      }

      return applyUpdatedAreaToDraft(prev, byId);
    });
  }, [areas]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (deleteConfirmOpen) {
        if (!deleting) setDeleteConfirmOpen(false);
        return;
      }
      if (moveModalOpen) {
        if (!moveLoading) setMoveModalOpen(false);
        return;
      }
      onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deleteConfirmOpen, deleting, moveLoading, moveModalOpen, onClose]);

  useEffect(() => {
    if (readOnly) return;
    if (panelDraftEquals(draft, lastSavedRef.current)) return;
    if (!taskId && !draft.title.trim()) return;

    const timer = window.setTimeout(async () => {
      if (!taskId && createInFlightRef.current) {
        return;
      }

      setSaving(true);
      const creating = taskId === null;
      if (creating) {
        createInFlightRef.current = true;
      }

      const { isCustom, areaInput } = getAreaInputForSave(draft, areas);
      if (isCustom && !areaInput) {
        if (!error) {
          setError("Area name cannot be empty");
        }
        setSaving(false);
        if (creating) {
          createInFlightRef.current = false;
        }
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
          previousDraft,
          projectId
        );
        const saved = result.task;
        const nextAreas = result.areas ?? areas;
        if (result.areas) {
          onAreasChange?.(result.areas);
        }
        const savedDraft = syncDraftAfterSave(
          saved,
          nextAreas,
          result.updatedArea
        );
        lastSavedRef.current = savedDraft;
        setDraft(savedDraft);
        setCreatedAt(saved._createdAt);
        setUpdatedAt(saved._updatedAt);
        setUpdatedBy(saved._updatedBy);
        setAreaNotice(
          result.areaUpdate
            ? formatAreaCodeChangeMessage(result.areaUpdate) || null
            : null
        );

        if (creating) {
          setActiveTask(saved);
          createInFlightRef.current = false;
          onCreated?.(saved);
        } else {
          onUpdated?.(saved);
          if (isInternal && projectId && previousDraft) {
            void notifyPanelSaveChanges({
              previousDraft,
              nextDraft: savedDraft,
              task: saved,
              projectId,
              users,
            });
          }
        }
      } catch (err) {
        setAreaNotice(null);
        setError(
          err instanceof AreaUpdateError
            ? AREA_UPDATE_USER_MESSAGE
            : err instanceof Error
              ? err.message
              : "Failed to save."
        );
      } finally {
        setSaving(false);
        if (creating && createInFlightRef.current) {
          createInFlightRef.current = false;
        }
      }
    }, PANEL_AUTO_SAVE_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [areas, draft, error, isInternal, mode, onAreasChange, onCreated, onUpdated, projectId, readOnly, taskId, users]);

  const updateField = useCallback((fieldName: string, value: string) => {
    setDraft((prev) => setPanelDraftField(prev, fieldName, value));
    if (fieldName === "Visibility") {
      setShowClientFields(normalizeVisibilityScope(value) !== "internal");
    }
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
          meta && "areaId" in meta ? (meta.areaId ?? "") : prev.areaSelectedId,
        areaEditName:
          meta && "editName" in meta ? (meta.editName ?? "") : prev.areaEditName,
      }));
    },
    []
  );

  const updateAreaEditName = useCallback(
    (name: string) => {
      setDraft((prev) => {
        const areaSelectedId =
          prev.areaSelectedId.trim() ||
          findAreaRecordByCode(prev.areaSelectedValue, areas)?.id ||
          "";
        return { ...prev, areaEditName: name, areaSelectedId };
      });
    },
    [areas]
  );

  const updateInterventionDuration = useCallback((days: number, hours: number) => {
    setDraft((prev) => setInterventionDuration(prev, days, hours));
  }, []);

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

  const surfaceBlocked = deleteConfirmOpen || moveModalOpen;

  return (
    <>
      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Delete task?"
        description="Are you sure you want to delete this task?"
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
        onConfirm={() => void confirmDeleteTask()}
        onCancel={() => {
          if (!deleting) setDeleteConfirmOpen(false);
        }}
      />

      <ParentTaskPickerModal
        open={moveModalOpen}
        mode={moveModalMode}
        task={activeTask}
        candidates={parentCandidates}
        currentParentId={activeTask?.parent_task_id}
        allTasks={allTasks}
        loading={moveLoading}
        error={moveError}
        onConfirm={(parentTaskId) => void handleConfirmMoveToSubtask(parentTaskId)}
        onClose={() => {
          if (!moveLoading) setMoveModalOpen(false);
        }}
      />

      <div
        className={`fixed inset-x-0 bottom-0 ${uiLayers.drawer} flex justify-end shadow-[0_-2px_8px_rgba(0,0,0,0.05)] ${
          fullscreenLayout ? "top-0" : "top-[100px]"
        } ${surfaceBlocked ? "pointer-events-none" : ""}`}
        role="presentation"
        aria-hidden={surfaceBlocked}
      >
        <button
          type="button"
          className={`absolute inset-0 bg-primary/40 backdrop-blur-[1px] transition-opacity ${
            surfaceBlocked ? "opacity-0" : ""
          }`}
          aria-label="Close task panel"
          onClick={onClose}
          tabIndex={surfaceBlocked ? -1 : 0}
        />

        <aside
          className={`relative flex h-full shrink-0 flex-col overflow-visible border-l border-border bg-white shadow-2xl transition-[opacity,filter] duration-200 md:w-auto ${
            fullscreenLayout ? "max-h-full" : "max-h-[calc(100vh-100px)]"
          } w-full ${surfaceBlocked ? "opacity-40 saturate-50" : ""}`}
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

          <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border/60 px-6 py-5">
            <div className="min-w-0">
              {!isNew ? (
                <p className={ui.textMetadata}>
                  Task #{activeTask.id}
                  {activeTask.parent_task_id ? " · Subtask" : ""}
                </p>
              ) : null}
              <h2 id="task-panel-title" className="mt-1 text-lg font-semibold text-primary">
                {isNew
                  ? "New Task"
                  : (activeTask.Issue ?? "").trim() || "Task Details"}
              </h2>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-border px-2.5 py-1.5 text-sm font-semibold text-primary transition hover:bg-primary/5"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
          </header>

          {!isNew && isInternal && canEditPanel ? (
            <div
              className="shrink-0 border-b border-border/60 px-6 py-3"
              aria-label="Task actions"
            >
              <h3 className={`${ui.panelSectionTitle} mb-2`}>Task actions</h3>
              <div className="flex flex-col gap-2">
                {canMoveToSubtask && onMoveToSubtask ? (
                  <button
                    type="button"
                    disabled={deleting || saving || moveLoading}
                    onClick={() => {
                      setMoveError(null);
                      setMoveModalMode("convert");
                      setMoveModalOpen(true);
                    }}
                    className={`${ui.btnPrimaryLg} w-full`}
                  >
                    <HierarchyIcon />
                    Move Under Task
                  </button>
                ) : null}
                {deleteError ? (
                  <p className="text-xs text-red-600">{deleteError}</p>
                ) : null}
                <button
                  type="button"
                  disabled={deleting || saving}
                  onClick={() => setDeleteConfirmOpen(true)}
                  className={`${ui.btnDangerLg} w-full`}
                >
                  {deleting ? "Deleting…" : "Delete Task"}
                </button>
                <p className="text-xs text-slate-500">
                  This action cannot be undone
                </p>
              </div>
            </div>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-visible px-6 py-4 max-h-[calc(100vh-120px)]">
            {isInternal ? (
              <TaskPanelSection title="Visibility" first>
                <TaskVisibilityField
                  embedded
                  value={draft.visibilityScope}
                  onChange={(value) => updateField("Visibility", value)}
                />
              </TaskPanelSection>
            ) : null}

            <TaskPanelSection title="General" first={!isInternal}>
              {(isInternal ? generalColumns : clientColumns).map((column) => (
                <TaskPanelField
                  key={column.id}
                  column={column}
                  mode={mode}
                  draft={draft}
                  users={users}
                  areas={areas}
                  onFieldChange={updateField}
                  onAreaChange={updateArea}
                  onAreaEditNameChange={updateAreaEditName}
                  onInterventionDurationChange={updateInterventionDuration}
                  onSbOwnerToggle={toggleSbOwner}
                />
              ))}
            </TaskPanelSection>

            {isInternal && clientInfoColumns.length > 0 ? (
              showClientFields ? (
                <TaskPanelSection title="Client information">
                  {clientInfoColumns.map((column) => (
                    <TaskPanelField
                      key={column.id}
                      column={column}
                      mode={mode}
                      draft={draft}
                      users={users}
                      areas={areas}
                      onFieldChange={updateField}
                      onAreaChange={updateArea}
                      onAreaEditNameChange={updateAreaEditName}
                      onInterventionDurationChange={updateInterventionDuration}
                      onSbOwnerToggle={toggleSbOwner}
                    />
                  ))}
                  <button
                    type="button"
                    onClick={() => setShowClientFields(false)}
                    className="text-xs font-medium text-accent hover:underline"
                  >
                    Hide client information
                  </button>
                </TaskPanelSection>
              ) : (
                <div className="border-t border-border/50 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowClientFields(true)}
                    className="text-xs font-medium text-accent hover:underline"
                  >
                    Show client information
                  </button>
                </div>
              )
            ) : null}

            {isInternal && internalFieldsWithoutVisibility.length > 0 ? (
              <TaskPanelSection title="Internal information">
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
                    onAreaEditNameChange={updateAreaEditName}
                    onInterventionDurationChange={updateInterventionDuration}
                    onSbOwnerToggle={toggleSbOwner}
                  />
                ))}
              </TaskPanelSection>
            ) : null}

            {!isNew && activeTask ? (
              <TaskPanelSection title="Links & files">
                <TaskLinksSection
                  links={activeTask.links ?? []}
                  canEdit={canEditPanel}
                  onManage={
                    onManageLinks
                      ? () => onManageLinks(activeTask)
                      : undefined
                  }
                />
              </TaskPanelSection>
            ) : null}

            {!isNew && activeTask ? (
              <TaskPanelSection title="Task relationships">
                <TaskRelationshipsSection
                  activeTask={activeTask}
                  parentTask={parentTask}
                  subtasks={subtasks}
                  canEdit={canEditPanel && isInternal}
                  canReparent={canReparent}
                  canPromote={Boolean(activeTask.parent_task_id && onPromoteSubtask)}
                  onOpenTask={(task) => onOpenSubtask?.(task)}
                  onMoveToDifferentParent={
                    onMoveToSubtask
                      ? () => {
                          setMoveError(null);
                          setMoveModalMode("reparent");
                          setMoveModalOpen(true);
                        }
                      : undefined
                  }
                  onPromote={
                    onPromoteSubtask && activeTask
                      ? () =>
                          void runSubtaskAction(activeTask, () =>
                            onPromoteSubtask(activeTask)
                          )
                      : undefined
                  }
                  moveLoading={moveLoading}
                  promoteDisabled={
                    saving || deleting || subtaskBusyId != null
                  }
                />
                {!activeTask.parent_task_id && canEditPanel ? (
                  <div className="mt-4 border-t border-border/50 pt-4">
                    <TaskSubtasksSection
                      subtasks={subtasks}
                      busyId={subtaskBusyId}
                      adding={addingSubtask}
                      error={subtaskError}
                      canEdit={canEditPanel}
                      onOpenTask={(subtask) => onOpenSubtask?.(subtask)}
                      onToggleComplete={(subtask) =>
                        void runSubtaskAction(subtask, () =>
                          onToggleSubtaskComplete!(subtask)
                        )
                      }
                      onAddSubtask={() => void handleAddSubtask()}
                    />
                  </div>
                ) : null}
              </TaskPanelSection>
            ) : null}

            <TaskPanelSection title={isInternal ? "Communication" : "Discussion"}>
              {isNew ? (
                <p className="text-sm text-muted">
                  Enter a task title to create the task, then add comments here.
                </p>
              ) : (
                <div className="space-y-8">
                  <TaskCommentSection
                    title="Client Discussion"
                    type="client"
                    taskId={taskId!}
                    projectId={projectId}
                    taskLabel={(activeTask?.Issue ?? "").trim() || undefined}
                    taskNumber={activeTask?.id}
                    comments={commentsForType("client")}
                    loading={commentsLoading}
                    canPost={!readOnly}
                    embedded
                    onCommentAdded={() => {
                      void reloadComments();
                      onCommentsChanged?.();
                    }}
                  />

                  {isInternal ? (
                    <TaskCommentSection
                      title="Internal Discussion"
                      type="internal"
                      taskId={taskId!}
                      projectId={projectId}
                      taskLabel={(activeTask?.Issue ?? "").trim() || undefined}
                      taskNumber={activeTask?.id}
                      comments={commentsForType("internal")}
                      loading={commentsLoading}
                      canPost={!readOnly}
                      embedded
                      onCommentAdded={() => {
                      void reloadComments();
                      onCommentsChanged?.();
                    }}
                    />
                  ) : null}

                  {commentsError ? (
                    <p className="text-xs text-red-600">{commentsError}</p>
                  ) : null}
                </div>
              )}
            </TaskPanelSection>

            {!isNew && taskId ? (
              <TaskPanelSection title={isInternal ? "Acknowledgement" : "Your Response"}>
                <TaskAcknowledgeSection
                  task={activeTask!}
                  mode={mode}
                  projectId={projectId}
                  onAcknowledged={(updated) => {
                    setActiveTask(updated);
                    onUpdated?.(updated);
                  }}
                />
              </TaskPanelSection>
            ) : null}

            {taskId && !isNew ? (
              <TaskActivitySection
                taskId={taskId}
                mode={mode}
                createdAt={createdAt}
                updatedAt={updatedAt}
                updatedBy={updatedBy}
                refreshKey={updatedAt}
              />
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
