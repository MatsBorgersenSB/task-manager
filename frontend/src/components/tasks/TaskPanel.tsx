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
import TaskScheduleFields from "@/components/tasks/TaskScheduleFields";
import TaskSubtasksSection from "@/components/tasks/TaskSubtasksSection";
import TaskRelationshipsSection from "@/components/tasks/TaskRelationshipsSection";
import TaskDependenciesSection from "@/components/tasks/TaskDependenciesSection";
import TaskVisibilityField from "@/components/tasks/TaskVisibilityField";
import {
  canStartTaskWithDependencies,
  formatBlockedBySummary,
  getEffectiveBlockingPredecessors,
  isStartedOrCompletedStatus,
} from "@/lib/tasks/dependencies";
import type { TaskDependency } from "@/lib/templates/types";
import {
  boardLabelChipClass,
  taskLabelIds,
  type ProjectBoardLabel,
} from "@/lib/tasks/boardMeta";
import { deleteTaskApi, setTaskNumberApi } from "@/lib/tasks/api";
import { uiLayers } from "@/lib/ui/layers";
import {
  formatAreaCodeChangeMessage,
  AreaUpdateError,
  AREA_UPDATE_USER_MESSAGE,
} from "@/lib/tasks/areasApi";
import { useTaskComments } from "@/lib/tasks/comments";
import {
  buildPanelFieldSections,
  panelColumnsByGroup,
  persistShowClientPanelFields,
  readShowClientPanelFields,
} from "@/lib/tasks/panelFields";
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
  taskDisplayId,
} from "@/lib/tasks/subtasks";
import { ui } from "@/lib/ui/classes";

const PANEL_WIDTH_STORAGE_KEY = "task-panel-width";
const PANEL_DEFAULT_WIDTH = 480;
const MIN_WIDTH = 360;
const MAX_WIDTH = 860;
const MOBILE_PANEL_MAX_WIDTH = 767;
const PANEL_AUTO_SAVE_DEBOUNCE_MS = 900;

type PanelActiveTab = "overview" | "comments" | "activity";

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
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, newWidth));
}

function HierarchyIcon() {
  return (
    <svg
      width="14"
      height="14"
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

function MainTaskIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v5" />
      <path d="M7 20h10" />
      <path d="M12 12v8" />
      <path d="M7 20l5-8" />
      <path d="M17 20l-5-8" />
    </svg>
  );
}

function parentTaskDisplayLabel(task: Task, allTasks: Task[]): string {
  const title = (task.Issue ?? "").trim() || "Untitled";
  return `${title} (#${taskDisplayId(task, allTasks)})`;
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
  onNumberChanged?: (task: Task) => void | Promise<void>;
  onOpenSubtask?: (task: Task) => void;
  onCreateSubtask?: (parent: Task) => Promise<void>;
  onPromoteSubtask?: (subtask: Task) => Promise<void>;
  onMoveToSubtask?: (task: Task, parentTaskId: string) => Promise<void>;
  onToggleSubtaskComplete?: (subtask: Task) => Promise<void>;
  onManageLinks?: (task: Task) => void;
  projectId?: string | null;
  isProjectShared?: boolean;
  mode?: TaskViewMode;
  users?: AppUser[];
  onCommentsChanged?: () => void;
  readOnly?: boolean;
  /** When true, panel fills the browser fullscreen element (no app header offset). */
  fullscreenLayout?: boolean;
  boardLabels?: ProjectBoardLabel[];
  onToggleLabel?: (task: Task, labelId: string) => void | Promise<void>;
  dependencies?: TaskDependency[];
  onAddDependency?: (
    predecessorTaskId: string,
    successorTaskId: string
  ) => Promise<void>;
  onRemoveDependency?: (dependencyId: string) => Promise<void>;
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
  onNumberChanged,
  onOpenSubtask,
  onCreateSubtask,
  onPromoteSubtask,
  onMoveToSubtask,
  onToggleSubtaskComplete,
  onManageLinks,
  projectId = null,
  isProjectShared = true,
  mode = "internal",
  users = [],
  onCommentsChanged,
  readOnly = false,
  fullscreenLayout = false,
  boardLabels = [],
  onToggleLabel,
  dependencies = [],
  onAddDependency,
  onRemoveDependency,
}: TaskPanelProps) {
  const isInternal = mode === "internal";
  const canEditPanel = isInternal && !readOnly;

  const [activeTask, setActiveTask] = useState<Task | null>(task);
  const isNew = activeTask === null;
  const [activeTab, setActiveTab] = useState<PanelActiveTab>("overview");
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const [editingNumber, setEditingNumber] = useState(false);
  const actionsMenuRef = useRef<HTMLDivElement>(null);

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
  const [taskNumberDraft, setTaskNumberDraft] = useState(() =>
    task != null ? taskDisplayId(task, allTasks) : ""
  );
  const [numberSaving, setNumberSaving] = useState(false);
  const [numberError, setNumberError] = useState<string | null>(null);
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
  const latestDraftRef = useRef<TaskPanelDraft>(draft);
  latestDraftRef.current = draft;
  const createInFlightRef = useRef(false);
  const openTaskUuidRef = useRef<string | null>(task?._uuid ?? null);
  const [panelWidth, setPanelWidth] = useState(PANEL_DEFAULT_WIDTH);
  const [showClientFields, setShowClientFields] = useState(false);

  useEffect(() => {
    setShowClientFields(readShowClientPanelFields(false));
  }, []);

  const toggleClientFields = useCallback(() => {
    setShowClientFields((prev) => {
      const next = !prev;
      persistShowClientPanelFields(next);
      return next;
    });
  }, []);
  const [isDragging, setIsDragging] = useState(false);
  const [resizeHandleFlash, setResizeHandleFlash] = useState(false);
  const isMobile = useMobilePanelLayout();
  const isResizingRef = useRef(false);
  const resizeStartRef = useRef({ startX: 0, startWidth: PANEL_DEFAULT_WIDTH });

  useEffect(() => {
    setPanelWidth(readStoredPanelWidth());
  }, []);

  useEffect(() => {
    if (!actionsMenuOpen) return;
    function handleOutside(event: MouseEvent) {
      if (
        actionsMenuRef.current &&
        !actionsMenuRef.current.contains(event.target as Node)
      ) {
        setActionsMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [actionsMenuOpen]);

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

  const panelSections = useMemo(
    () =>
      buildPanelFieldSections(
        mode,
        [...clientColumns, ...internalColumns],
        {
          showClientFields: !isInternal || (isProjectShared && showClientFields),
          isProjectShared,
        }
      ),
    [
      mode,
      clientColumns,
      internalColumns,
      isInternal,
      isProjectShared,
      showClientFields,
    ]
  );

  const nonIssueTaskColumns = useMemo(
    () => panelSections.task.filter((col) => col.fieldName !== "Issue"),
    [panelSections.task]
  );

  const updateSchedule = useCallback(
    (next: { fromDate: string; toDate: string }) => {
      setDraft((prev) => ({
        ...prev,
        interventionDate: next.fromDate,
        dateDue: next.toDate,
      }));
    },
    []
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
  const isSubtask = Boolean(activeTask?.parent_task_id);
  const displayId = activeTask ? taskDisplayId(activeTask, allTasks) : "";
  const moveUnderParentEnabled =
    Boolean(onMoveToSubtask && activeTask) &&
    (isSubtask ? canReparent : canMoveToSubtask);

  const clientComments = commentsForType("client");
  const internalComments = commentsForType("internal");
  const totalCommentsCount =
    (isProjectShared ? clientComments.length : 0) +
    (isInternal ? internalComments.length : 0);

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
    const prevTaskUuid = openTaskUuidRef.current;
    const switchedTask = taskUuid !== prevTaskUuid;
    openTaskUuidRef.current = taskUuid;

    if (
      switchedTask &&
      prevTaskUuid &&
      !readOnly &&
      !panelDraftEquals(latestDraftRef.current, lastSavedRef.current)
    ) {
      const pendingDraft = latestDraftRef.current;
      const previousDraft = lastSavedRef.current;
      void saveTaskPanel(
        mode,
        prevTaskUuid,
        pendingDraft,
        areas,
        previousDraft,
        projectId
      )
        .then((res) => {
          onUpdated?.(res.task);
        })
        .catch(() => {
          // Best-effort background flush when switching rows rapidly
        });
    }

    setActiveTask(task);
    setCreatedAt(task?._createdAt);
    setUpdatedAt(task?._updatedAt);
    setUpdatedBy(task?._updatedBy);
    setError(null);

    if (switchedTask) {
      setDraft(next);
      lastSavedRef.current = next;
      setTaskNumberDraft(task != null ? taskDisplayId(task, allTasks) : "");
      setNumberError(null);
      setEditingNumber(false);
      setActionsMenuOpen(false);
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
  }, [task, areas, mode, onUpdated, projectId, readOnly]);

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

  const flushSaveNow = useCallback(async () => {
    if (readOnly) return;
    if (panelDraftEquals(latestDraftRef.current, lastSavedRef.current)) return;
    if (!taskId && !latestDraftRef.current.title.trim()) return;
    if (!taskId && createInFlightRef.current) return;

    const currentDraft = latestDraftRef.current;
    const previousDraft = lastSavedRef.current;
    const { isCustom, areaInput } = getAreaInputForSave(currentDraft, areas);
    if (isCustom && !areaInput) return;

    setSaving(true);
    const creating = taskId === null;
    if (creating) {
      createInFlightRef.current = true;
    }

    try {
      const result = await saveTaskPanel(
        mode,
        taskId,
        currentDraft,
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
    } catch {
      // Handled by inline error state if panel remains open
    } finally {
      setSaving(false);
      if (creating && createInFlightRef.current) {
        createInFlightRef.current = false;
      }
    }
  }, [
    areas,
    isInternal,
    mode,
    onAreasChange,
    onCreated,
    onUpdated,
    projectId,
    readOnly,
    taskId,
    users,
  ]);

  const handleClosePanel = useCallback(() => {
    void flushSaveNow();
    onClose();
  }, [flushSaveNow, onClose]);

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
      if (actionsMenuOpen) {
        setActionsMenuOpen(false);
        return;
      }
      handleClosePanel();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [actionsMenuOpen, deleteConfirmOpen, deleting, handleClosePanel, moveLoading, moveModalOpen]);

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

  const updateField = useCallback(
    (fieldName: string, value: string) => {
      if (activeTask && dependencies.length > 0) {
        const tryingToStartOrComplete =
          ((fieldName === "status" || fieldName === "SB Status") &&
            isStartedOrCompletedStatus(value)) ||
          (fieldName === "Date Completed" && Boolean(value.trim()));
        if (tryingToStartOrComplete) {
          const check = canStartTaskWithDependencies(
            activeTask,
            allTasks,
            dependencies
          );
          if (!check.allowed) {
            setError(
              check.reason ??
                "Cannot start or complete this task until its predecessor tasks are completed."
            );
            return;
          }
        }
      }
      setError(null);
      setDraft((prev) => setPanelDraftField(prev, fieldName, value));
    },
    [activeTask, allTasks, dependencies]
  );

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

  async function applyTaskNumberChange() {
    if (!activeTask) return;
    const parsed = Number.parseInt(taskNumberDraft.trim(), 10);
    if (!Number.isInteger(parsed) || parsed < 1) {
      setNumberError("Enter a whole number of 1 or greater.");
      return;
    }
    const currentDisplayNumber =
      Number.parseInt(displayId, 10) || activeTask.id;
    if (parsed === currentDisplayNumber && parsed === activeTask.id) {
      setNumberError(null);
      setEditingNumber(false);
      return;
    }

    setNumberSaving(true);
    setNumberError(null);
    try {
      const updated = await setTaskNumberApi(mode, activeTask._uuid, parsed);
      setActiveTask(updated);
      setTaskNumberDraft(String(parsed));
      setEditingNumber(false);
      onUpdated?.(updated);
      await onNumberChanged?.(updated);
    } catch (err) {
      setNumberError(
        err instanceof Error ? err.message : "Failed to change task number."
      );
    } finally {
      setNumberSaving(false);
    }
  }

  const surfaceBlocked = deleteConfirmOpen || moveModalOpen;
  const isDirty = !panelDraftEquals(draft, lastSavedRef.current);

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
          fullscreenLayout ? "top-0" : "top-[56px]"
        } ${surfaceBlocked ? "pointer-events-none" : ""}`}
        role="presentation"
        aria-hidden={surfaceBlocked}
      >
        <button
          type="button"
          className={`absolute inset-0 bg-primary/35 backdrop-blur-[1px] transition-opacity ${
            surfaceBlocked ? "opacity-0" : ""
          }`}
          aria-label="Close task panel"
          onClick={handleClosePanel}
          tabIndex={surfaceBlocked ? -1 : 0}
        />

        <aside
          className={`relative flex h-full shrink-0 flex-col overflow-visible border-l border-border bg-white shadow-2xl transition-[opacity,filter] duration-200 md:w-auto ${
            fullscreenLayout ? "max-h-full" : "max-h-[calc(100vh-56px)]"
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

          {/* Compact Modern Header */}
          <header className="shrink-0 border-b border-border/70 bg-slate-50/60 px-5 pt-3.5 pb-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                {!isNew ? (
                  !isSubtask && canEditPanel ? (
                    editingNumber ? (
                      <div className="inline-flex items-center gap-1 rounded border border-border bg-white px-1.5 py-0.5">
                        <span className="text-[11px] font-semibold text-muted">#</span>
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={taskNumberDraft}
                          onChange={(e) => {
                            setTaskNumberDraft(e.target.value);
                            setNumberError(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              void applyTaskNumberChange();
                            } else if (e.key === "Escape") {
                              setEditingNumber(false);
                              setTaskNumberDraft(displayId);
                            }
                          }}
                          className="w-14 rounded border border-border px-1 py-0.5 text-xs font-semibold text-primary focus:border-accent focus:outline-none"
                          aria-label="Task number"
                          autoFocus
                        />
                        <button
                          type="button"
                          disabled={numberSaving}
                          onClick={() => void applyTaskNumberChange()}
                          className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-white hover:bg-accent-dark"
                        >
                          {numberSaving ? "…" : "Save"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingNumber(false);
                            setTaskNumberDraft(displayId);
                            setNumberError(null);
                          }}
                          className="px-1 text-xs text-muted hover:text-primary"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setTaskNumberDraft(displayId);
                          setEditingNumber(true);
                        }}
                        title="Click to change task number (swaps if already used)"
                        className="inline-flex items-center gap-1 rounded border border-border/80 bg-white px-2 py-0.5 font-mono text-xs font-semibold text-primary shadow-sm transition hover:border-accent hover:text-accent"
                      >
                        <span>#{displayId}</span>
                        <span className="text-[10px] text-muted">✎</span>
                      </button>
                    )
                  ) : (
                    <span className="inline-flex items-center rounded border border-border/70 bg-white px-2 py-0.5 font-mono text-xs font-semibold text-primary">
                      #{displayId}
                    </span>
                  )
                ) : (
                  <span className="inline-flex items-center rounded bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent">
                    New Task
                  </span>
                )}

                {parentTask ? (
                  <button
                    type="button"
                    onClick={() => onOpenSubtask?.(parentTask)}
                    className="inline-flex max-w-[14rem] items-center gap-1 truncate rounded-full border border-border/70 bg-white px-2 py-0.5 text-[11px] font-medium text-muted transition hover:border-accent hover:text-accent"
                    title={`Parent task: ${parentTaskDisplayLabel(parentTask, allTasks)}`}
                  >
                    <span>↳</span>
                    <span className="truncate">
                      {parentTaskDisplayLabel(parentTask, allTasks)}
                    </span>
                  </button>
                ) : null}

                {subtasks.length > 0 ? (
                  <span className="inline-flex items-center rounded-full bg-slate-200/75 px-2 py-0.5 text-[11px] font-medium text-primary/80">
                    {subtasks.length} subtask{subtasks.length === 1 ? "" : "s"}
                  </span>
                ) : null}

                {activeTask &&
                getEffectiveBlockingPredecessors(
                  activeTask,
                  allTasks,
                  dependencies
                ).length > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      const first = getEffectiveBlockingPredecessors(
                        activeTask,
                        allTasks,
                        dependencies
                      )[0];
                      if (first) onOpenSubtask?.(first.predecessor);
                    }}
                    className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-900 transition hover:bg-amber-100"
                    title="Click to open blocking predecessor task"
                  >
                    <span>🔒</span>
                    <span>
                      {formatBlockedBySummary(
                        getEffectiveBlockingPredecessors(
                          activeTask,
                          allTasks,
                          dependencies
                        ),
                        allTasks
                      )}
                    </span>
                  </button>
                ) : null}
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                {!readOnly ? (
                  <button
                    type="button"
                    disabled={!isDirty || saving}
                    onClick={() => void flushSaveNow()}
                    title={
                      isDirty
                        ? "Click to save pending changes immediately"
                        : "All changes saved"
                    }
                    aria-live="polite"
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition ${
                      saving
                        ? "bg-amber-50 text-amber-800"
                        : isDirty
                          ? "cursor-pointer bg-amber-100/80 text-amber-900 hover:bg-amber-200/80"
                          : "bg-emerald-50 text-emerald-800"
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`h-1.5 w-1.5 rounded-full ${
                        saving
                          ? "animate-pulse bg-amber-500"
                          : isDirty
                            ? "bg-amber-600"
                            : "bg-emerald-500"
                      }`}
                    />
                    {saving ? "Saving…" : isDirty ? "Save now" : "Saved"}
                  </button>
                ) : null}

                {/* Compact Actions Dropdown Menu */}
                {!isNew && isInternal && canEditPanel ? (
                  <div ref={actionsMenuRef} className="relative">
                    <button
                      type="button"
                      onClick={() => setActionsMenuOpen((prev) => !prev)}
                      aria-expanded={actionsMenuOpen}
                      aria-label="More task actions"
                      title="Task actions (Move, Promote, Delete)"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-white text-sm font-bold text-primary transition hover:bg-slate-100"
                    >
                      ⋯
                    </button>

                    {actionsMenuOpen ? (
                      <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-lg border border-border bg-white py-1 shadow-xl">
                        {onMoveToSubtask ? (
                          <button
                            type="button"
                            disabled={
                              deleting ||
                              saving ||
                              moveLoading ||
                              !moveUnderParentEnabled
                            }
                            onClick={() => {
                              setActionsMenuOpen(false);
                              setMoveError(null);
                              setMoveModalMode(
                                isSubtask ? "reparent" : "convert"
                              );
                              setMoveModalOpen(true);
                            }}
                            className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium text-primary hover:bg-slate-50 disabled:opacity-40"
                          >
                            <span className="inline-flex items-center gap-2">
                              <HierarchyIcon />
                              {isSubtask
                                ? "Change Parent Task…"
                                : "Move Under Parent…"}
                            </span>
                            <kbd className="rounded border border-border bg-slate-100 px-1 py-px font-mono text-[10px] text-muted">
                              M
                            </kbd>
                          </button>
                        ) : null}

                        {isSubtask && onPromoteSubtask ? (
                          <button
                            type="button"
                            disabled={
                              deleting ||
                              saving ||
                              moveLoading ||
                              subtaskBusyId != null
                            }
                            onClick={() => {
                              setActionsMenuOpen(false);
                              void runSubtaskAction(activeTask!, () =>
                                onPromoteSubtask(activeTask!)
                              );
                            }}
                            className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium text-primary hover:bg-slate-50 disabled:opacity-40"
                          >
                            <span className="inline-flex items-center gap-2">
                              <MainTaskIcon />
                              Promote to Main Task
                            </span>
                            <kbd className="rounded border border-border bg-slate-100 px-1 py-px font-mono text-[10px] text-muted">
                              P
                            </kbd>
                          </button>
                        ) : null}

                        {!isSubtask ? (
                          <button
                            type="button"
                            onClick={() => {
                              setActionsMenuOpen(false);
                              setEditingNumber(true);
                            }}
                            className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium text-primary hover:bg-slate-50"
                          >
                            <span>✎ Change Task Number (#ID)</span>
                          </button>
                        ) : null}

                        <div className="my-1 border-t border-border/60" />

                        <button
                          type="button"
                          disabled={deleting || saving}
                          onClick={() => {
                            setActionsMenuOpen(false);
                            setDeleteConfirmOpen(true);
                          }}
                          className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40"
                        >
                          <span>Delete Task…</span>
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={handleClosePanel}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-white text-xs font-semibold text-primary transition hover:bg-slate-100"
                  aria-label="Close"
                  title="Close panel (Esc)"
                >
                  ✕
                </button>
              </div>
            </div>

            {numberError ? (
              <p className="mt-1 text-xs text-red-600">{numberError}</p>
            ) : null}
            {deleteError ? (
              <p className="mt-1 text-xs text-red-600">{deleteError}</p>
            ) : null}

            {/* Highlighted Editable Task Title Banner */}
            <div className="mt-2.5 rounded-lg border border-accent/35 bg-accent/10 px-3 py-2 shadow-sm transition focus-within:border-accent focus-within:bg-white focus-within:ring-2 focus-within:ring-accent/25">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="task-panel-title"
                  className="text-[10px] font-bold uppercase tracking-wider text-accent-dark"
                >
                  {isSubtask ? `Subtask #${displayId}` : isNew ? "New Task Title" : `Task #${displayId} — Issue Title`}
                </label>
                {!readOnly ? (
                  <span className="text-[10px] font-medium text-muted">
                    Click to edit
                  </span>
                ) : null}
              </div>
              <input
                id="task-panel-title"
                type="text"
                value={draft.title}
                onChange={(event) => updateField("Issue", event.target.value)}
                readOnly={readOnly}
                placeholder="Enter task / issue title…"
                className="mt-0.5 w-full bg-transparent text-base font-bold text-primary placeholder:text-muted/60 focus:outline-none"
              />
            </div>

            {/* Clean Navigation Tabs: Overview | Comments | Activity */}
            {!isNew ? (
              <div
                className="mt-3 flex items-center gap-1 border-t border-border/50 pt-2.5"
                role="tablist"
                aria-label="Task panel sections"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "overview"}
                  onClick={() => setActiveTab("overview")}
                  className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                    activeTab === "overview"
                      ? "bg-primary text-white shadow-sm"
                      : "text-muted hover:bg-white hover:text-primary"
                  }`}
                >
                  Overview
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "comments"}
                  onClick={() => setActiveTab("comments")}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition ${
                    activeTab === "comments"
                      ? "bg-primary text-white shadow-sm"
                      : "text-muted hover:bg-white hover:text-primary"
                  }`}
                >
                  <span>Comments</span>
                  {totalCommentsCount > 0 ? (
                    <span
                      className={`rounded-full px-1.5 py-px text-[10px] ${
                        activeTab === "comments"
                          ? "bg-white/20 text-white"
                          : "bg-accent/15 text-accent"
                      }`}
                    >
                      {totalCommentsCount}
                    </span>
                  ) : null}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "activity"}
                  onClick={() => setActiveTab("activity")}
                  className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                    activeTab === "activity"
                      ? "bg-primary text-white shadow-sm"
                      : "text-muted hover:bg-white hover:text-primary"
                  }`}
                >
                  Activity
                </button>
              </div>
            ) : null}
          </header>

          {/* Scrollable Body */}
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-visible px-5 py-4">
            {activeTab === "overview" || isNew ? (
              <div className="space-y-5">
                {/* Compact 2-Column Properties Grid */}
                <TaskPanelSection
                  title="Properties & Assignment"
                  first
                  action={
                    isInternal && isProjectShared ? (
                      <button
                        type="button"
                        onClick={toggleClientFields}
                        aria-pressed={showClientFields}
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition ${
                          showClientFields
                            ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                            : "border-border bg-white text-muted hover:border-accent/40 hover:text-primary"
                        }`}
                        title={
                          showClientFields
                            ? "Hide client fields (Client Status, Priority, Responsible, Client Comment)"
                            : "Show client fields (Client Status, Priority, Responsible, Client Comment)"
                        }
                      >
                        <span>{showClientFields ? "Hide client fields" : "Show client fields"}</span>
                      </button>
                    ) : null
                  }
                >
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {nonIssueTaskColumns.map((column) => (
                      <div key={column.id} className="sm:col-span-2">
                        <TaskPanelField
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
                      </div>
                    ))}

                    {panelSections.status.map((column) => {
                      const isFullWidth = column.fieldName === "SB Owner";
                      return (
                        <div
                          key={column.id}
                          className={isFullWidth ? "sm:col-span-2" : undefined}
                        >
                          <TaskPanelField
                            column={column}
                            mode={mode}
                            draft={draft}
                            users={users}
                            areas={areas}
                            onFieldChange={updateField}
                            onAreaChange={updateArea}
                            onAreaEditNameChange={updateAreaEditName}
                            onInterventionDurationChange={
                              updateInterventionDuration
                            }
                            onSbOwnerToggle={toggleSbOwner}
                          />
                        </div>
                      );
                    })}

                    {isInternal && isProjectShared ? (
                      <div className="sm:col-span-2">
                        <TaskVisibilityField
                          embedded
                          value={draft.visibilityScope}
                          onChange={(value) => updateField("Visibility", value)}
                        />
                      </div>
                    ) : null}
                  </div>

                  {boardLabels.length > 0 && activeTask ? (
                    <div className="space-y-1.5 pt-1">
                      <p className="text-xs font-medium text-muted">Labels</p>
                      <div className="flex flex-wrap gap-1.5">
                        {boardLabels.map((label) => {
                          const active = taskLabelIds(activeTask).includes(
                            label.id
                          );
                          return (
                            <button
                              key={label.id}
                              type="button"
                              disabled={!canEditPanel || !onToggleLabel}
                              onClick={() =>
                                void onToggleLabel?.(activeTask, label.id)
                              }
                              className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                                active
                                  ? boardLabelChipClass(label.color)
                                  : "bg-white text-muted ring-1 ring-border/70 hover:bg-slate-50"
                              } disabled:cursor-default disabled:opacity-70`}
                            >
                              {label.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </TaskPanelSection>

                {/* Schedule Section (No duplicate heading) */}
                <TaskPanelSection title="Schedule & Effort">
                  <TaskScheduleFields
                    fromDate={draft.interventionDate}
                    toDate={draft.dateDue}
                    readOnly={!canEditPanel}
                    onChange={updateSchedule}
                  />
                  {panelSections.scheduleExtra.length > 0 ? (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {panelSections.scheduleExtra.map((column) => (
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
                          onInterventionDurationChange={
                            updateInterventionDuration
                          }
                          onSbOwnerToggle={toggleSbOwner}
                        />
                      ))}
                    </div>
                  ) : null}
                </TaskPanelSection>

                {/* Subtasks & Hierarchy right in Overview */}
                {!isNew && activeTask ? (
                  <TaskPanelSection title="Subtasks & Dependencies">
                    {canEditPanel ? (
                      <TaskSubtasksSection
                        subtasks={subtasks}
                        allTasks={allTasks}
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
                    ) : (
                      <TaskRelationshipsSection
                        activeTask={activeTask}
                        parentTask={parentTask}
                        subtasks={subtasks}
                        allTasks={allTasks}
                        onOpenTask={(task) => onOpenSubtask?.(task)}
                      />
                    )}
                    <TaskDependenciesSection
                      activeTask={activeTask}
                      allTasks={allTasks}
                      dependencies={dependencies}
                      canEdit={canEditPanel}
                      onAddDependency={
                        onAddDependency
                          ? (predId) => onAddDependency(predId, activeTask._uuid)
                          : undefined
                      }
                      onRemoveDependency={onRemoveDependency}
                      onOpenTask={(t) => onOpenSubtask?.(t)}
                    />
                  </TaskPanelSection>
                ) : null}

                {/* Notes & Risk */}
                {panelSections.notes.length > 0 ||
                panelSections.other.length > 0 ? (
                  <TaskPanelSection
                    title="Notes & Risk Assessment"
                    action={
                      isInternal && isProjectShared ? (
                        <button
                          type="button"
                          onClick={toggleClientFields}
                          className="text-[11px] font-medium text-accent hover:underline"
                        >
                          {showClientFields
                            ? "Hide client notes"
                            : "Show client notes"}
                        </button>
                      ) : null
                    }
                  >
                    {[...panelSections.notes, ...panelSections.other].map(
                      (column) => (
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
                          onInterventionDurationChange={
                            updateInterventionDuration
                          }
                          onSbOwnerToggle={toggleSbOwner}
                        />
                      )
                    )}
                  </TaskPanelSection>
                ) : null}

                {/* Links & Files */}
                {!isNew && activeTask ? (
                  <TaskPanelSection title="Links & Files">
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

                {/* Acknowledgement */}
                {!isNew && taskId && isProjectShared ? (
                  <TaskPanelSection
                    title={isInternal ? "Acknowledgement" : "Your Response"}
                  >
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
              </div>
            ) : activeTab === "comments" ? (
              <div className="space-y-6">
                {isProjectShared ? (
                  <TaskCommentSection
                    title="Client Discussion"
                    type="client"
                    taskId={taskId!}
                    projectId={projectId}
                    taskLabel={(activeTask?.Issue ?? "").trim() || undefined}
                    taskNumber={activeTask?.id}
                    comments={clientComments}
                    loading={commentsLoading}
                    canPost={!readOnly}
                    embedded
                    onCommentAdded={() => {
                      void reloadComments();
                      onCommentsChanged?.();
                    }}
                  />
                ) : null}

                {isInternal ? (
                  <div
                    className={
                      isProjectShared ? "border-t border-border/60 pt-5" : undefined
                    }
                  >
                    <TaskCommentSection
                      title="Internal Discussion (SB Only)"
                      type="internal"
                      taskId={taskId!}
                      projectId={projectId}
                      taskLabel={(activeTask?.Issue ?? "").trim() || undefined}
                      taskNumber={activeTask?.id}
                      comments={internalComments}
                      loading={commentsLoading}
                      canPost={!readOnly}
                      embedded
                      onCommentAdded={() => {
                        void reloadComments();
                        onCommentsChanged?.();
                      }}
                    />
                  </div>
                ) : null}

                {commentsError ? (
                  <p className="text-xs text-red-600">{commentsError}</p>
                ) : null}
              </div>
            ) : (
              <TaskActivitySection
                taskId={taskId!}
                mode={mode}
                createdAt={createdAt}
                updatedAt={updatedAt}
                updatedBy={updatedBy}
                refreshKey={updatedAt}
              />
            )}
          </div>

          <footer className="shrink-0 border-t border-border bg-slate-50/70 px-5 py-2.5">
            {saving ? (
              <p className="text-xs font-medium text-accent-dark">
                {isNew ? "Creating…" : "Saving changes…"}
              </p>
            ) : error ? (
              <p className="text-xs text-red-600">{error}</p>
            ) : areaNotice ? (
              <p className="text-xs font-medium text-emerald-700">{areaNotice}</p>
            ) : isNew && !draft.title.trim() ? (
              <p className="text-xs text-muted">
                Enter a task title above to create the task.
              </p>
            ) : (
              <div className="flex items-center justify-between text-[11px] text-muted">
                <span>
                  {!panelDraftEquals(draft, lastSavedRef.current)
                    ? "Unsaved changes — auto-saving…"
                    : "✓ All changes saved automatically"}
                </span>
                {isInternal ? (
                  <span>
                    Shortcuts: <kbd className="font-mono">M</kbd> move ·{" "}
                    <kbd className="font-mono">S</kbd> subtask ·{" "}
                    <kbd className="font-mono">Esc</kbd> close
                  </span>
                ) : null}
              </div>
            )}
          </footer>
        </aside>
      </div>
    </>
  );
}
