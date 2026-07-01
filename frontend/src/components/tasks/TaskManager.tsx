"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import AppShell from "@/components/AppShell";
import {
  InlineEditableDate,
  InlineEditableSelect,
  InlineEditableText,
  type SyncStatus,
} from "@/components/tasks/InlineEditableCell";
import SbOwnerPills from "@/components/tasks/SbOwnerPills";
import TaskImportModal from "@/components/tasks/TaskImportModal";
import TaskLinksCell from "@/components/tasks/TaskLinksCell";
import LinksEditorModal from "@/components/shared/LinksEditorModal";
import TaskTableHeader, { cycleColumnSort } from "@/components/tasks/TaskTableHeader";
import TaskWorkspaceToolbar from "@/components/tasks/TaskWorkspaceToolbar";
import CalendarView, {
  CALENDAR_DATE_MODE_LABELS,
  type CalendarDateMode,
} from "@/components/tasks/CalendarView";
import GanttView from "@/components/GanttView";
import ClampedComment from "@/components/tasks/ClampedComment";
import TaskPanel from "@/components/tasks/TaskPanel";
import ParentTaskPickerModal, {
  type ParentTaskPickerMode,
} from "@/components/tasks/ParentTaskPickerModal";
import HierarchyUndoToast from "@/components/tasks/HierarchyUndoToast";
import TaskRowContextMenu, {
  type TaskRowContextMenuState,
} from "@/components/tasks/TaskRowContextMenu";
import ConfirmDialog from "@/components/ConfirmDialog";
import ProjectToolbar from "@/components/projects/ProjectToolbar";
import ProjectBlueprintView from "@/components/projects/ProjectBlueprintView";
import CreateProjectWizard from "@/components/projects/CreateProjectWizard";
import ProjectWorkspaceBar from "@/components/projects/ProjectWorkspaceBar";
import ArchivedReadOnlyBanner from "@/components/projects/ArchivedReadOnlyBanner";
import ProjectKpiBar from "@/components/projects/ProjectKpiBar";
import ProjectDetailsPanel from "@/components/projects/ProjectDetailsPanel";
import ViewModeSwitch from "@/components/tasks/ViewModeSwitch";
import {
  ClientViewModeBanner,
  DueDateLegend,
  NoProjectSelectedState,
  NoTasksYetState,
  ProjectWorkflowBanner,
  SummaryFilterBanner,
} from "@/components/tasks/TaskManagerGuidance";
import { useProjectManagement } from "@/hooks/useProjectManagement";
import {
  CLIENT_STATUS_OPTIONS,
  PRIORITY_FILTER_OPTIONS,
  SB_PRIORITY_OPTIONS,
  SB_STATUS_OPTIONS,
} from "@/lib/tasks/constants";
import {
  areaFilterSummaryLabel,
  formatAreaTableTooltip,
  formatAreaCodeOnly,
  type Area,
} from "@/lib/tasks/areas";
import { fetchAreas } from "@/lib/tasks/areasApi";
import {
  BULK_UPDATE_CHUNK_SIZE,
  createTask,
  fetchAppUsers,
  fetchTasks,
  updateTask,
  updateTasksBulk,
} from "@/lib/tasks/api";
import { logSingleTaskFieldChange, logTaskEvent } from "@/lib/tasks/activityLogging";
import type {
  AppUser,
  Task,
  TaskFilters,
  TaskLink,
  TaskPayload,
  TaskViewMode,
} from "@/lib/tasks/types";
import {
  extractSbOwners,
  filterAndSortTasks,
  normalizeDateInput,
  parseSbOwners,
  priorityBadgeClass,
  sbPriorityBadgeClass,
  visibilityBadgeClass,
  visibilityBadgeLabel,
  uniqueStatuses,
} from "@/lib/tasks/utils";
import { buildFilterSummary } from "@/lib/tasks/export";
import {
  isRecentTask,
} from "@/lib/tasks/recentTasks";
import {
  getSubtaskProgressForTask,
  getSubtasksForParent,
  isSubtaskComplete,
  subtaskProgressBarClass,
  subtaskProgressColorClass,
  subtaskProgressLabel,
  subtaskProgressPercent,
  validateAssignParent,
  canMoveTaskToSubtask,
  listParentTaskCandidates,
  taskHierarchyLabel,
} from "@/lib/tasks/subtasks";
import {
  mainTaskTitleClass,
  milestoneBadgeClass,
  subtaskIndentClass,
  subtaskTitleClass,
  subtaskTreeMarker,
} from "@/lib/tasks/hierarchyDisplay";
import {
  undoMessageBulk,
  undoMessageConvert,
  undoMessagePromote,
  undoMessageReparent,
} from "@/lib/tasks/hierarchyUndoMessages";
import {
  dueStatusClassName,
  dueStatusIcon,
  getTaskDueStatus,
  taskRowHighlightClass,
  todayIso,
} from "@/lib/tasks/taskDates";
import { computeProjectTaskStats, isClientActivityTask, isTaskComplete } from "@/lib/tasks/projectStats";
import { computeAttentionStats, taskNeedsAttention } from "@/lib/tasks/attentionStats";
import { fetchWaitingForResponseTaskIds } from "@/lib/tasks/commentAttention";
import {
  currentUserHandle,
  filterTasksForUser,
} from "@/lib/tasks/myTasks";
import { scanDueDateNotifications } from "@/lib/tasks/notifications";
import { notifyTaskFieldChange, notifyProjectFeedEvent } from "@/lib/tasks/taskNotifications";
import {
  summaryFilterPatch,
  type SummaryFilterKey,
} from "@/lib/tasks/summaryFilters";
import {
  fieldLabel,
  getTableColumns,
  tableColumnCount,
  type TableColumnDef,
} from "@/lib/tasks/labels";
import {
  readShowOptionalColumns,
  persistShowOptionalColumns,
} from "@/lib/tasks/tableColumnOptions";
import { updateProjectLinks } from "@/lib/projects/api";
import { useTableScrollMaxHeight } from "@/hooks/useTableScrollMaxHeight";
import { useTaskTableColumnWidths } from "@/hooks/useTaskTableColumnWidths";
import { useFullscreen } from "@/hooks/useFullscreen";
import { useHierarchyUndo } from "@/hooks/useHierarchyUndo";
import { useTaskFocusMode, isEditableTarget } from "@/lib/tasks/taskFocusMode";
import { ui } from "@/lib/ui/classes";
import {
  isAdmin as userIsAdmin,
  isInternal as userHasInternalRole,
} from "@/lib/roles";
import { isProjectReadOnly } from "@/lib/projects/lifecycle";
import { viewModeDescription, viewModeLabel } from "@/lib/viewAccess";
import { taskTableColumnStorageKey } from "@/lib/tasks/tableColumnWidths";

type TaskManagerProps = {
  mode: TaskViewMode;
  title?: string;
  subtitle?: string;
  userEmail?: string;
  userRole?: string;
  backHref?: string;
  initialProjectId?: string;
  initialTaskId?: string;
};

const EMPTY_FILTERS: TaskFilters = {
  columnFilters: {},
  priority: "",
  status: "",
  sbStatus: "",
  sbPriority: "",
  sbOwners: [],
  area: "ALL",
  visibilityScope: "",
  due: "",
  risk: "",
  sort: "id",
};

const SEARCH_DEBOUNCE_MS = 300;
const SB_OWNERS_FILTER_STORAGE_KEY = "task-filter-sb-owners";

function readStoredSbOwners(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SB_OWNERS_FILTER_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

const TABLE_WRAP_TEXT_STYLE = { lineHeight: "1.4" } as const;

function renderWrapTextCell(value: string) {
  return (
    <span
      className="block whitespace-normal break-words"
      style={TABLE_WRAP_TEXT_STYLE}
    >
      {value}
    </span>
  );
}

const INLINE_EDIT_IDS = new Set(["issue", "sb_status", "priority", "date_due"]);

function inlineSaveKey(taskId: string, field: string): string {
  return `${taskId}-${field}`;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

type TaskDisplayLayout = "table" | "calendar" | "gantt" | "blueprint";

export default function TaskManager({
  mode,
  title: titleProp,
  subtitle,
  userEmail,
  userRole,
  backHref,
  initialProjectId,
  initialTaskId,
}: TaskManagerProps) {
  const isInternalMode = mode === "internal";
  const canUseInternalTools = userHasInternalRole(userRole);
  const showInternalAdmin = canUseInternalTools && isInternalMode;
  const userAdmin = userIsAdmin(userRole);
  const projectScopeInternal = isInternalMode && canUseInternalTools;

  const {
    projects,
    selectedProject,
    selectedProjectId,
    projectsLoading,
    projectActionError,
    createProjectOpen,
    setCreateProjectOpen,
    createProjectLoading,
    createProjectError,
    handleCreateFromWizard,
    setProjectActionError,
    loadProjects,
    handleSelectProject,
    handleShareProject,
    shareProjectLoading,
    handleInviteUser,
    inviteProjectLoading,
    updateProjectInList,
  } = useProjectManagement({
    isInternal: projectScopeInternal,
    initialProjectId,
    repairOrphans: showInternalAdmin,
    autoLoad: false,
    createDefaultIfEmpty: false,
  });

  const projectReadOnly = isProjectReadOnly(selectedProject?.project_status);

  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [expandedParentIds, setExpandedParentIds] = useState<Set<string>>(
    () => new Set()
  );
  const [areas, setAreas] = useState<Area[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [filters, setFilters] = useState<TaskFilters>(() => ({
    ...EMPTY_FILTERS,
    sbOwners: readStoredSbOwners(),
  }));
  const [columnFilterDrafts, setColumnFilterDrafts] = useState<
    Record<string, string>
  >({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [panelTask, setPanelTask] = useState<Task | null | undefined>(undefined);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkStatusValue, setBulkStatusValue] = useState("");
  const [bulkPriorityValue, setBulkPriorityValue] = useState("");
  const [bulkApplying, setBulkApplying] = useState(false);
  const [bulkProgressCompleted, setBulkProgressCompleted] = useState(0);
  const [bulkProgressTotal, setBulkProgressTotal] = useState(0);
  const [hoveredOwner, setHoveredOwner] = useState<string | null>(null);
  const [lockedOwner, setLockedOwner] = useState<string | null>(null);
  const [linkModalTask, setLinkModalTask] = useState<Task | null>(null);
  const [linksSaving, setLinksSaving] = useState(false);
  const [projectLinksModalOpen, setProjectLinksModalOpen] = useState(false);
  const [projectLinksSaving, setProjectLinksSaving] = useState(false);
  const [showOptionalColumns, setShowOptionalColumns] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<TaskDisplayLayout>("table");
  const [calendarDateMode, setCalendarDateMode] =
    useState<CalendarDateMode>("due");
  const [showRecentOnly, setShowRecentOnly] = useState(false);
  const [clientActivityOnly, setClientActivityOnly] = useState(false);
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [waitingOnly, setWaitingOnly] = useState(false);
  const [myTasksOnly, setMyTasksOnly] = useState(false);
  const [waitingTaskIds, setWaitingTaskIds] = useState<Set<string>>(() => new Set());
  const [summaryFilter, setSummaryFilter] = useState<SummaryFilterKey | null>(
    null
  );
  const [contextMenu, setContextMenu] = useState<TaskRowContextMenuState>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<ParentTaskPickerMode>("convert");
  const [pickerTask, setPickerTask] = useState<Task | null>(null);
  const [pickerTasks, setPickerTasks] = useState<Task[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [dragConfirm, setDragConfirm] = useState<{
    task: Task;
    parent: Task;
  } | null>(null);
  const draggedTaskRef = useRef<Task | null>(null);
  const [savingMap, setSavingMap] = useState<Record<string, SyncStatus>>({});
  const updateVersionRef = useRef<Record<string, number>>({});
  const saveStatusTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const selectAllRef = useRef<HTMLInputElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const fullscreenRef = useRef<HTMLElement>(null);
  const { focusMode, setFocusMode, toggleFocusMode } = useTaskFocusMode();
  const { action: undoAction, pushUndo, dismiss: dismissUndo } = useHierarchyUndo();
  const [undoing, setUndoing] = useState(false);
  const { isFullscreen, exitFullscreen, toggleFullscreen } =
    useFullscreen(fullscreenRef);
  const userHandle = useMemo(() => currentUserHandle(userEmail), [userEmail]);
  const dueAlertsScannedRef = useRef<string | null>(null);

  useEffect(() => {
    setShowOptionalColumns(readShowOptionalColumns());
  }, []);

  useEffect(() => {
    return () => {
      for (const timer of Object.values(saveStatusTimersRef.current)) {
        clearTimeout(timer);
      }
    };
  }, []);

  const scheduleInlineSaveStatusClear = useCallback((key: string, delay = 1000) => {
    const existing = saveStatusTimersRef.current[key];
    if (existing) clearTimeout(existing);
    saveStatusTimersRef.current[key] = setTimeout(() => {
      setSavingMap((prev) => {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
      delete saveStatusTimersRef.current[key];
    }, delay);
  }, []);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const tasks = await fetchTasks(mode);
      setAllTasks(tasks);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load tasks.");
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    async function loadAreas() {
      try {
        const data = await fetchAreas();
        setAreas(data || []);
      } catch (err) {
        console.error("Failed to load areas:", err);
        setAreas([]);
      }
    }
    void loadAreas();
  }, []);

  const loadUsers = useCallback(async () => {
    if (!isInternalMode) return;
    try {
      setUsers(await fetchAppUsers());
    } catch {
      setUsers([]);
    }
  }, [isInternalMode]);

  useEffect(() => {
    async function init() {
      await loadProjects();
      await loadTasks();
      void loadUsers();
    }

    void init();
  }, [loadProjects, loadTasks, loadUsers]);

  useEffect(() => {
    if (!selectedProjectId || isInternalMode) return;
    void notifyProjectFeedEvent({
      projectId: selectedProjectId,
      eventType: "client_project_viewed",
      summary: "Client viewed project",
      clientVisible: true,
      users,
    });
  }, [selectedProjectId, isInternalMode, users]);

  const canCreateTasks =
    Boolean(selectedProjectId) && !projectsLoading && !projectReadOnly;

  useEffect(() => {
    if (!isInternalMode) return;
    window.localStorage.setItem(
      SB_OWNERS_FILTER_STORAGE_KEY,
      JSON.stringify(filters.sbOwners)
    );
  }, [filters.sbOwners, isInternalMode]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const nextFilters: Record<string, string> = {};
      for (const [key, value] of Object.entries(columnFilterDrafts)) {
        const trimmed = value.trim();
        if (trimmed) nextFilters[key] = trimmed;
      }
      setFilters((prev) => {
        const prevJson = JSON.stringify(prev.columnFilters);
        const nextJson = JSON.stringify(nextFilters);
        if (prevJson === nextJson) return prev;
        setSummaryFilter(null);
        return { ...prev, columnFilters: nextFilters };
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [columnFilterDrafts]);

  const statusOptions = useMemo(() => uniqueStatuses(allTasks), [allTasks]);

  const sbOwnerOptions = useMemo(
    () => (isInternalMode ? extractSbOwners(allTasks) : []),
    [allTasks, isInternalMode]
  );

  const legacyClientTaskView =
    !isInternalMode && projects.length === 0 && !projectsLoading;

  const projectTasks = useMemo(() => {
    if (legacyClientTaskView) {
      return allTasks;
    }
    if (!selectedProjectId) return [];
    return allTasks.filter((task) => task.project_id === selectedProjectId);
  }, [allTasks, selectedProjectId, legacyClientTaskView]);

  const mainTasks = useMemo(
    () => projectTasks.filter((task) => !task.parent_task_id),
    [projectTasks]
  );

  const projectStats = useMemo(
    () => computeProjectTaskStats(projectTasks),
    [projectTasks]
  );

  const attentionStats = useMemo(
    () => computeAttentionStats(projectTasks, waitingTaskIds),
    [projectTasks, waitingTaskIds]
  );

  useEffect(() => {
    if (!selectedProjectId || !isInternalMode) {
      setWaitingTaskIds(new Set());
      return;
    }

    const taskIds = projectTasks.map((task) => task._uuid);
    void fetchWaitingForResponseTaskIds(taskIds).then(setWaitingTaskIds);
  }, [selectedProjectId, isInternalMode, projectTasks]);

  useEffect(() => {
    if (!selectedProjectId || !isInternalMode || users.length === 0 || loading) {
      return;
    }
    if (dueAlertsScannedRef.current === selectedProjectId) {
      return;
    }
    dueAlertsScannedRef.current = selectedProjectId;
    void scanDueDateNotifications({
      projectId: selectedProjectId,
      tasks: projectTasks,
      users,
    });
  }, [selectedProjectId, isInternalMode, users, loading, projectTasks]);

  useEffect(() => {
    if (!initialTaskId || loading || allTasks.length === 0) return;
    const match = allTasks.find((task) => task._uuid === initialTaskId);
    if (match) {
      setPanelTask(match);
    }
  }, [initialTaskId, loading, allTasks]);

  const refreshWaitingTaskIds = useCallback(async () => {
    if (!selectedProjectId || !isInternalMode) return;
    const taskIds = projectTasks.map((task) => task._uuid);
    setWaitingTaskIds(await fetchWaitingForResponseTaskIds(taskIds));
  }, [selectedProjectId, isInternalMode, projectTasks]);

  const tableTasks = mainTasks;

  const hasActiveProject = Boolean(selectedProjectId) || legacyClientTaskView;
  const canEditTasks =
    hasActiveProject && !projectsLoading && !loading && !projectReadOnly;
  const showTaskWorkspace =
    hasActiveProject && !projectsLoading && (loading || projectTasks.length > 0);
  const tableScrollMaxHeight = useTableScrollMaxHeight(
    tableScrollRef,
    showTaskWorkspace && viewMode === "table",
    focusMode
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;

      if (event.key === "f" || event.key === "F") {
        if (event.metaKey || event.ctrlKey || event.altKey) return;
        event.preventDefault();
        toggleFocusMode();
        return;
      }

      if (event.key === "Escape") {
        if (focusMode) {
          event.preventDefault();
          setFocusMode(false);
        }
        if (isFullscreen) {
          void exitFullscreen();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    focusMode,
    isFullscreen,
    toggleFocusMode,
    setFocusMode,
    exitFullscreen,
  ]);

  const tableColumns = useMemo(
    () => getTableColumns(mode, { showOptionalColumns }),
    [mode, showOptionalColumns]
  );

  const columnWidthStorageKey = useMemo(
    () => taskTableColumnStorageKey(mode, showOptionalColumns),
    [mode, showOptionalColumns]
  );

  const {
    getWidth: getColumnWidth,
    tableMinWidth,
    startColumnResize,
    resetColumnWidth,
  } = useTaskTableColumnWidths({
    columns: tableColumns,
    storageKey: columnWidthStorageKey,
  });

  const columnFilterContext = useMemo(
    () => ({
      columns: tableColumns,
      subtaskSearchText: (task: Task) =>
        subtaskProgressLabel(
          getSubtaskProgressForTask(task._uuid, projectTasks)
        ),
    }),
    [tableColumns, projectTasks]
  );

  const filteredMainTasks = useMemo(
    () => filterAndSortTasks(tableTasks, filters, columnFilterContext),
    [tableTasks, filters, columnFilterContext]
  );

  const recentMainTasks = useMemo(
    () => filteredMainTasks.filter(isRecentTask),
    [filteredMainTasks]
  );

  const clientActivityMainTasks = useMemo(
    () => filteredMainTasks.filter(isClientActivityTask),
    [filteredMainTasks]
  );

  const attentionMainTasks = useMemo(
    () =>
      filteredMainTasks.filter((task) =>
        taskNeedsAttention(task, waitingTaskIds)
      ),
    [filteredMainTasks, waitingTaskIds]
  );

  const myMainTasks = useMemo(
    () => filterTasksForUser(filteredMainTasks, userHandle),
    [filteredMainTasks, userHandle]
  );

  const waitingMainTasks = useMemo(
    () =>
      filteredMainTasks.filter(
        (task) => waitingTaskIds.has(task._uuid) && !isTaskComplete(task)
      ),
    [filteredMainTasks, waitingTaskIds]
  );

  const filteredMainTasksForView = useMemo(() => {
    if (showRecentOnly) return recentMainTasks;
    if (clientActivityOnly) return clientActivityMainTasks;
    if (attentionOnly) return attentionMainTasks;
    if (waitingOnly) return waitingMainTasks;
    if (myTasksOnly) return myMainTasks;
    return filteredMainTasks;
  }, [
    showRecentOnly,
    clientActivityOnly,
    attentionOnly,
    waitingOnly,
    myTasksOnly,
    recentMainTasks,
    clientActivityMainTasks,
    attentionMainTasks,
    waitingMainTasks,
    myMainTasks,
    filteredMainTasks,
  ]);

  const visibleTasks = useMemo(() => {
    const rows: Task[] = [];
    for (const main of filteredMainTasksForView) {
      rows.push(main);
      if (expandedParentIds.has(main._uuid)) {
        rows.push(...getSubtasksForParent(projectTasks, main._uuid));
      }
    }
    return rows;
  }, [filteredMainTasksForView, expandedParentIds, projectTasks]);

  const toggleParentExpanded = useCallback((parentUuid: string) => {
    setExpandedParentIds((prev) => {
      const next = new Set(prev);
      if (next.has(parentUuid)) next.delete(parentUuid);
      else next.add(parentUuid);
      return next;
    });
  }, []);

  const areaFilterLabel = useMemo(
    () => areaFilterSummaryLabel(filters.area, areas),
    [filters.area, areas]
  );

  const filterSummary = useMemo(
    () =>
      buildFilterSummary(
        filters,
        visibleTasks.length,
        tableTasks.length,
        mode
      ),
    [filters, visibleTasks.length, tableTasks.length, mode]
  );

  const [printDate, setPrintDate] = useState("");

  useEffect(() => {
    setPrintDate(
      new Date().toLocaleString("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    );
  }, []);

  const colSpan = tableColumnCount(mode, { showOptionalColumns });
  const tableColSpan = colSpan + 1;

  const allVisibleSelected =
    visibleTasks.length > 0 &&
    visibleTasks.every((task) => selectedIds.has(task._uuid));
  const someVisibleSelected = visibleTasks.some((task) =>
    selectedIds.has(task._uuid)
  );

  const bulkStatusOptions = isInternalMode
    ? SB_STATUS_OPTIONS
    : CLIENT_STATUS_OPTIONS;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate =
        someVisibleSelected && !allVisibleSelected;
    }
  }, [someVisibleSelected, allVisibleSelected]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAllVisible = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const task of visibleTasks) next.delete(task._uuid);
      } else {
        for (const task of visibleTasks) next.add(task._uuid);
      }
      return next;
    });
  }, [allVisibleSelected, visibleTasks]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setBulkStatusValue("");
    setBulkPriorityValue("");
  }, []);

  const bulkHierarchyCandidates = useMemo(() => {
    return [...selectedIds]
      .map((id) => projectTasks.find((task) => task._uuid === id))
      .filter((task): task is Task => Boolean(task))
      .filter((task) => canMoveTaskToSubtask(task, projectTasks));
  }, [projectTasks, selectedIds]);

  function openPanel(task: Task) {
    if (!hasActiveProject) return;
    setPanelTask(task);
    if (!isInternalMode && selectedProjectId) {
      void notifyProjectFeedEvent({
        projectId: selectedProjectId,
        task,
        eventType: "client_task_opened",
        summary: `Client opened task #${task.id} ${(task.Issue ?? "").trim() || "Untitled"}`,
        clientVisible: true,
        users,
      });
    }
  }

  function openNewPanel() {
    if (!selectedProjectId) {
      setProjectActionError(
        "Select or create a project before adding tasks."
      );
      return;
    }
    setPanelTask(null);
  }

  function closePanel() {
    setPanelTask(undefined);
  }

  const handlePanelUpdated = useCallback((updated: Task) => {
    setAllTasks((prev) =>
      prev.map((task) => (task._uuid === updated._uuid ? updated : task))
    );
    setPanelTask(updated);
  }, []);

  const handlePanelCreated = useCallback((created: Task) => {
    setAllTasks((prev) =>
      [...prev, created].sort((a, b) => a.id - b.id)
    );
    setPanelTask(created);
  }, []);

  const handlePanelDeleted = useCallback((deleted: Task) => {
    setAllTasks((prev) => prev.filter((task) => task._uuid !== deleted._uuid));
    setPanelTask(undefined);
  }, []);

  const handleInlineFieldUpdate = useCallback(
    async (task: Task, fieldName: keyof Task, value: string) => {
      if (!selectedProjectId && !legacyClientTaskView) {
        setProjectActionError("Select a project before editing tasks.");
        return;
      }

      const taskId = task._uuid;
      const saveKey = inlineSaveKey(taskId, String(fieldName));
      const version = (updateVersionRef.current[taskId] ?? 0) + 1;
      updateVersionRef.current[taskId] = version;
      const currentVersion = version;

      const payload = { [fieldName]: value } as TaskPayload;
      const previousTask = task;
      const optimisticTask: Task = { ...task, [fieldName]: value };

      setAllTasks((prev) =>
        prev.map((row) => (row._uuid === taskId ? optimisticTask : row))
      );
      setPanelTask((prev) =>
        prev != null && prev._uuid === taskId ? optimisticTask : prev
      );

      setSavingMap((prev) => ({ ...prev, [saveKey]: "saving" }));

      try {
        const updated = await updateTask(mode, taskId, payload);

        if (updateVersionRef.current[taskId] !== currentVersion) {
          return;
        }

        setAllTasks((prev) =>
          prev.map((row) => (row._uuid === updated._uuid ? updated : row))
        );
        setPanelTask((prev) =>
          prev != null && prev._uuid === updated._uuid ? updated : prev
        );
        setSavingMap((prev) => ({ ...prev, [saveKey]: "saved" }));
        scheduleInlineSaveStatusClear(saveKey);

        if (isInternalMode) {
          try {
            const previousValue = previousTask[fieldName];
            const oldValue =
              previousValue == null || String(previousValue).trim() === ""
                ? null
                : String(previousValue).trim();
            const newValue = value.trim() === "" ? null : value.trim();
            await logSingleTaskFieldChange(
              taskId,
              String(fieldName),
              oldValue,
              newValue
            );
          } catch {
            // Activity logging must not block inline saves.
          }

          if (selectedProjectId) {
            void notifyTaskFieldChange({
              previous: previousTask,
              updated,
              fieldName,
              projectId: selectedProjectId,
              users,
            });
          }
        }
      } catch (err) {
        if (updateVersionRef.current[taskId] !== currentVersion) {
          return;
        }
        setAllTasks((prev) =>
          prev.map((row) =>
            row._uuid === previousTask._uuid ? previousTask : row
          )
        );
        setPanelTask((prev) =>
          prev != null && prev._uuid === previousTask._uuid
            ? previousTask
            : prev
        );
        setSavingMap((prev) => ({ ...prev, [saveKey]: "error" }));
        scheduleInlineSaveStatusClear(saveKey);
        console.warn(
          "Failed to save inline edit:",
          err instanceof Error ? err.message : err
        );
        throw err;
      }
    },
    [isInternalMode, mode, scheduleInlineSaveStatusClear, selectedProjectId, legacyClientTaskView, setProjectActionError, users]
  );

  const applyBulkField = useCallback(
    async (fieldName: keyof Task, value: string) => {
      if (selectedIds.size === 0 || !value) return;

      const taskIds = Array.from(selectedIds);
      const tasksToUpdate = taskIds
        .map((id) => allTasks.find((task) => task._uuid === id))
        .filter((task): task is Task => task != null);

      if (tasksToUpdate.length === 0) return;

      const total = taskIds.length;
      setBulkProgressTotal(total);
      setBulkProgressCompleted(0);

      const payload = { [fieldName]: value } as TaskPayload;
      const fieldKey = String(fieldName);
      const bulkVersions = new Map<string, number>();
      const previousTasks = new Map(
        tasksToUpdate.map((task) => [task._uuid, task] as const)
      );

      setBulkApplying(true);

      for (const task of tasksToUpdate) {
        const taskId = task._uuid;
        const version = (updateVersionRef.current[taskId] ?? 0) + 1;
        updateVersionRef.current[taskId] = version;
        bulkVersions.set(taskId, version);

        const saveKey = inlineSaveKey(taskId, fieldKey);
        setSavingMap((prev) => ({ ...prev, [saveKey]: "saving" }));
      }

      setAllTasks((prev) =>
        prev.map((row) =>
          bulkVersions.has(row._uuid)
            ? { ...row, [fieldName]: value }
            : row
        )
      );
      setPanelTask((prev) => {
        if (prev == null || !bulkVersions.has(prev._uuid)) return prev;
        return { ...prev, [fieldName]: value };
      });

      const mergeChunkResults = (updated: Task[], chunkIds: string[]) => {
        const updatedById = new Map(updated.map((task) => [task._uuid, task]));

        setBulkProgressCompleted((prev) => prev + chunkIds.length);

        setAllTasks((prev) =>
          prev.map((row) => {
            const version = bulkVersions.get(row._uuid);
            if (version == null) return row;
            if (updateVersionRef.current[row._uuid] !== version) return row;
            return updatedById.get(row._uuid) ?? row;
          })
        );
        setPanelTask((prev) => {
          if (prev == null || !bulkVersions.has(prev._uuid)) return prev;
          const version = bulkVersions.get(prev._uuid);
          if (
            version == null ||
            updateVersionRef.current[prev._uuid] !== version
          ) {
            return prev;
          }
          return updatedById.get(prev._uuid) ?? prev;
        });

        for (const task of updated) {
          const taskId = task._uuid;
          const version = bulkVersions.get(taskId);
          if (version == null || updateVersionRef.current[taskId] !== version) {
            continue;
          }
          const saveKey = inlineSaveKey(taskId, fieldKey);
          setSavingMap((prev) => ({ ...prev, [saveKey]: "saved" }));
          scheduleInlineSaveStatusClear(saveKey);
        }
      };

      const revertBulkOptimistic = (onlyTaskIds?: Set<string>) => {
        setAllTasks((prev) =>
          prev.map((row) => {
            if (onlyTaskIds && !onlyTaskIds.has(row._uuid)) return row;
            const version = bulkVersions.get(row._uuid);
            if (version == null) return row;
            if (updateVersionRef.current[row._uuid] !== version) return row;
            return previousTasks.get(row._uuid) ?? row;
          })
        );
        setPanelTask((prev) => {
          if (prev == null || !bulkVersions.has(prev._uuid)) return prev;
          if (onlyTaskIds && !onlyTaskIds.has(prev._uuid)) return prev;
          const version = bulkVersions.get(prev._uuid);
          if (version == null || updateVersionRef.current[prev._uuid] !== version) {
            return prev;
          }
          return previousTasks.get(prev._uuid) ?? prev;
        });
        for (const [taskId, version] of bulkVersions) {
          if (onlyTaskIds && !onlyTaskIds.has(taskId)) continue;
          if (updateVersionRef.current[taskId] !== version) continue;
          const saveKey = inlineSaveKey(taskId, fieldKey);
          setSavingMap((prev) => ({ ...prev, [saveKey]: "error" }));
          scheduleInlineSaveStatusClear(saveKey);
        }
      };

      try {
        const chunks = chunkArray(taskIds, BULK_UPDATE_CHUNK_SIZE);
        const chunkOutcomes = await Promise.all(
          chunks.map(async (chunkIds) => {
            try {
              const results = await updateTasksBulk(mode, chunkIds, payload);
              mergeChunkResults(results, chunkIds);
              return { ok: true as const, chunkIds };
            } catch (err) {
              return {
                ok: false as const,
                chunkIds,
                err,
              };
            }
          })
        );

        const failedChunks = chunkOutcomes.filter((outcome) => !outcome.ok);
        if (failedChunks.length === 0) {
          clearSelection();
          return;
        }

        console.warn(
          "Bulk update failed for one or more chunks, falling back to per-task updates:",
          failedChunks.map((chunk) =>
            chunk.err instanceof Error ? chunk.err.message : chunk.err
          )
        );

        const failedIds = new Set(
          failedChunks.flatMap((chunk) => chunk.chunkIds)
        );
        const tasksForFallback = tasksToUpdate.filter((task) =>
          failedIds.has(task._uuid)
        );

        for (const task of tasksForFallback) {
          const taskId = task._uuid;
          const version = bulkVersions.get(taskId);
          if (version != null && updateVersionRef.current[taskId] === version) {
            updateVersionRef.current[taskId] = version - 1;
          }
        }

        const results = await Promise.allSettled(
          tasksForFallback.map((task) =>
            handleInlineFieldUpdate(task, fieldName, value)
          )
        );

        if (
          tasksForFallback.length > 0 &&
          results.every((result) => result.status === "rejected")
        ) {
          revertBulkOptimistic(failedIds);
        }

        clearSelection();
      } catch (bulkErr) {
        console.warn(
          "Bulk update failed, falling back to per-task updates:",
          bulkErr instanceof Error ? bulkErr.message : bulkErr
        );

        for (const [taskId, version] of bulkVersions) {
          if (updateVersionRef.current[taskId] === version) {
            updateVersionRef.current[taskId] = version - 1;
          }
        }

        const results = await Promise.allSettled(
          tasksToUpdate.map((task) =>
            handleInlineFieldUpdate(task, fieldName, value)
          )
        );

        if (results.every((result) => result.status === "rejected")) {
          revertBulkOptimistic();
        }

        clearSelection();
      } finally {
        setBulkApplying(false);
        setBulkProgressCompleted(0);
        setBulkProgressTotal(0);
      }
    },
    [
      selectedIds,
      allTasks,
      mode,
      handleInlineFieldUpdate,
      clearSelection,
      scheduleInlineSaveStatusClear,
    ]
  );

  function inlineCellStatus(taskId: string, field: string): SyncStatus | undefined {
    return savingMap[inlineSaveKey(taskId, field)];
  }

  function renderDueDateDisplay(task: Task, editable: boolean) {
    const dueValue = normalizeDateInput(task["Date Due"]) ?? "";
    const dueStatus = getTaskDueStatus(task);
    const prefix = dueStatusIcon(dueStatus);
    const statusClass = dueStatusClassName(dueStatus);

    if (editable) {
      return (
        <InlineEditableDate
          value={dueValue}
          onSave={(value) =>
            handleInlineFieldUpdate(task, "Date Due", value)
          }
          status={inlineCellStatus(task._uuid, "Date Due")}
          className={statusClass}
          prefix={prefix}
        />
      );
    }

    const shown = dueValue || "—";
    return (
      <span className={statusClass}>
        {prefix}
        {shown}
      </span>
    );
  }

  function renderIssueDisplay(task: Task, editable: boolean) {
    const isMain = !task.parent_task_id;
    const progress = getSubtaskProgressForTask(task._uuid, projectTasks);
    const hasSubtasks = Boolean(progress);
    const expanded = expandedParentIds.has(task._uuid);
    const title = (task.Issue ?? "").trim() || "—";
    const treePrefix = subtaskTreeMarker(task, visibleTasks);

    return (
      <div className={`flex items-start gap-1 ${subtaskIndentClass(isMain)}`}>
        {isMain && hasSubtasks ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              toggleParentExpanded(task._uuid);
            }}
            className="shrink-0 pt-0.5 text-xs font-semibold text-muted hover:text-primary"
            aria-expanded={expanded}
            aria-label={expanded ? "Collapse subtasks" : "Expand subtasks"}
          >
            {expanded ? "▼" : "▶"}
          </button>
        ) : !isMain ? (
          <span
            className="shrink-0 w-5 pt-0.5 font-mono text-[11px] leading-tight text-muted/80"
            aria-hidden
          >
            {treePrefix}
          </span>
        ) : (
          <span className="w-5 shrink-0" aria-hidden />
        )}
        {editable ? (
          <InlineEditableText
            value={task.Issue ?? ""}
            onSave={(value) => handleInlineFieldUpdate(task, "Issue", value)}
            status={inlineCellStatus(task._uuid, "Issue")}
            className={isMain ? mainTaskTitleClass() : subtaskTitleClass()}
          />
        ) : (
          <span className={isMain ? mainTaskTitleClass() : subtaskTitleClass()}>
            {title}
          </span>
        )}
        {isInternalMode && waitingTaskIds.has(task._uuid) ? (
          <span
            className="ml-2 inline-flex shrink-0 items-center rounded-full border border-violet-200 bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-900"
            title="Waiting for internal response to latest client comment"
          >
            💬 Waiting
          </span>
        ) : null}
        {task.is_milestone ? (
          <span className={milestoneBadgeClass()} title="Milestone">
            Milestone
          </span>
        ) : null}
      </div>
    );
  }

  function renderInlineCell(task: Task, colId: string) {
    if (!canEditTasks) return null;

    const taskId = task._uuid;
    switch (colId) {
      case "issue":
        return renderIssueDisplay(task, true);
      case "sb_status":
        return (
          <InlineEditableSelect
            value={(task["SB Status"] ?? "").trim()}
            options={SB_STATUS_OPTIONS}
            onSave={(value) =>
              handleInlineFieldUpdate(task, "SB Status", value)
            }
            status={inlineCellStatus(taskId, "SB Status")}
          />
        );
      case "priority": {
        const priority = (task.Priority ?? "").trim();
        return (
          <InlineEditableSelect
            value={priority}
            options={PRIORITY_FILTER_OPTIONS}
            onSave={(value) =>
              handleInlineFieldUpdate(task, "Priority", value)
            }
            status={inlineCellStatus(taskId, "Priority")}
            display={
              priority ? (
                <span className={priorityBadgeClass(task.Priority)}>
                  {task.Priority}
                </span>
              ) : (
                <span>—</span>
              )
            }
          />
        );
      }
      case "date_due":
        return renderDueDateDisplay(task, true);
      default:
        return null;
    }
  }

  function renderTableCell(task: Task, col: TableColumnDef) {
    if (col.id === "id") {
      return col.getValue(task);
    }

    if (INLINE_EDIT_IDS.has(col.id)) {
      if (canEditTasks) {
        const content = renderInlineCell(task, col.id);
        if (col.wrapContent) {
          return (
            <div className={`${ui.tableCellWrap} ${col.innerClass ?? ""}`}>
              {content}
            </div>
          );
        }
        return content;
      }

      if (col.id === "date_due") {
        return renderDueDateDisplay(task, false);
      }
      if (col.id === "priority") {
        const priority = (task.Priority ?? "").trim();
        return priority ? (
          <span className={priorityBadgeClass(task.Priority)}>{priority}</span>
        ) : (
          "—"
        );
      }
      if (col.id === "issue") {
        const content = renderIssueDisplay(task, false);
        if (col.wrapContent) {
          return (
            <div className={`${ui.tableCellWrap} ${col.innerClass ?? ""}`}>
              {content}
            </div>
          );
        }
        return content;
      }
      if (col.id === "sb_status") {
        return (task["SB Status"] ?? "").trim() || "—";
      }
    }

    if (col.id === "sb_priority") {
      return (task["SB Priority"] ?? "").trim() ? (
        <span className={sbPriorityBadgeClass(task["SB Priority"])}>
          {task["SB Priority"]}
        </span>
      ) : (
        "—"
      );
    }

    if (isInternalMode && col.id === "sb_owner") {
      return (
        <SbOwnerPills
          owners={parseSbOwners(task["SB Owner"])}
          selectedOwners={filters.sbOwners}
          onToggle={toggleOwnerFilter}
          onHoverOwner={handleOwnerHover}
          onHoverEnd={handleOwnerHoverEnd}
        />
      );
    }

    if (isInternalMode && col.id === "visibility") {
      return (
        <span className={visibilityBadgeClass(task.visibility_scope)}>
          {visibilityBadgeLabel(task.visibility_scope)}
        </span>
      );
    }

    if (col.id === "links") {
      return (
        <TaskLinksCell
          task={task}
          readOnly={!isInternalMode}
          onManageLinks={openLinkModal}
        />
      );
    }

    if (col.id === "subtasks") {
      const progress = getSubtaskProgressForTask(task._uuid, projectTasks);
      const label = subtaskProgressLabel(progress);
      if (!label) return "—";
      const percent = subtaskProgressPercent(progress);
      const colorClass = subtaskProgressColorClass(progress);
      const barClass = subtaskProgressBarClass(progress);
      return (
        <div className="flex flex-col items-center gap-1">
          <span
            className={`text-xs font-semibold tabular-nums ${colorClass}`}
          >
            {label}
          </span>
          <div
            className="h-1 w-full min-w-[2.5rem] rounded-full bg-slate-200"
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Subtasks ${label} complete`}
          >
            <div
              className={`h-full rounded-full transition-[width] ${barClass}`}
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      );
    }

    if (col.id === "area") {
      const tooltip = formatAreaTableTooltip(task.areaName, task.areaCode);
      return (
        <span title={tooltip} className="whitespace-nowrap">
          {formatAreaCodeOnly(task.areaCode)}
        </span>
      );
    }

    if (col.wrapTextCell) {
      return renderWrapTextCell(col.getValue(task));
    }

    if (col.clampedComment) {
      return <ClampedComment text={col.getValue(task)} />;
    }

    if (col.wrapContent) {
      return (
        <div className={`${ui.tableCellWrap} ${col.innerClass ?? ""}`}>
          {col.getValue(task)}
        </div>
      );
    }

    return col.getValue(task);
  }

  function tableColumnPaddingClass(
    col: TableColumnDef,
    columnIndex: number,
    totalColumns: number
  ): string {
    if (col.id === "id") return "pl-3 pr-2";
    if (columnIndex === totalColumns - 1) return "pl-4 pr-6";
    return "";
  }

  function tableCellAlignClass(col: TableColumnDef): string {
    if (
      col.id === "priority" ||
      col.id === "sb_priority" ||
      col.id === "sb_owner" ||
      col.id === "visibility" ||
      col.id === "links" ||
      col.id === "subtasks"
    ) {
      return "align-middle";
    }
    return "align-top";
  }

  function updateFilter<K extends keyof TaskFilters>(key: K, value: TaskFilters[K]) {
    setSummaryFilter(null);
    if (key === "status" || key === "due") {
      setShowRecentOnly(false);
      setClientActivityOnly(false);
    }
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  const toggleOwnerFilter = useCallback((owner: string) => {
    setSummaryFilter(null);
    setFilters((prev) => ({
      ...prev,
      sbOwners: prev.sbOwners.includes(owner)
        ? prev.sbOwners.filter((value) => value !== owner)
        : [...prev.sbOwners, owner],
    }));
  }, []);

  const handleOwnerHover = useCallback((owner: string, event: MouseEvent) => {
    const normalized = owner.toLowerCase();
    if (event.shiftKey) {
      setLockedOwner(normalized);
    } else {
      setHoveredOwner(normalized);
    }
  }, []);

  const handleOwnerHoverEnd = useCallback(() => {
    setHoveredOwner(null);
  }, []);

  const activeOwner = lockedOwner || hoveredOwner;

  const openLinkModal = useCallback((task: Task) => {
    setLinkModalTask(task);
  }, []);

  const closeLinkModal = useCallback(() => {
    if (linksSaving) return;
    setLinkModalTask(null);
  }, [linksSaving]);

  const closeProjectLinksModal = useCallback(() => {
    if (projectLinksSaving) return;
    setProjectLinksModalOpen(false);
  }, [projectLinksSaving]);

  const handleSaveLinks = useCallback(
    async (links: TaskLink[]) => {
      if (!linkModalTask || !isInternalMode) return;

      setLinksSaving(true);
      try {
        const updated = await updateTask("internal", linkModalTask._uuid, {
          links,
        });
        setAllTasks((prev) =>
          prev.map((row) => (row._uuid === updated._uuid ? updated : row))
        );
        if (panelTask?._uuid === updated._uuid) {
          setPanelTask(updated);
        }
        const added = links.filter(
          (link) =>
            !(linkModalTask.links ?? []).some((existing) => existing.id === link.id)
        );
        for (const link of added) {
          try {
            await logTaskEvent(
              updated._uuid,
              "link_added",
              "Link Added",
              null,
              link.name || link.url
            );
          } catch {
            /* history is best-effort */
          }
        }
        setLinkModalTask(null);
      } finally {
        setLinksSaving(false);
      }
    },
    [isInternalMode, linkModalTask, panelTask]
  );

  const handleSaveProjectLinks = useCallback(
    async (links: TaskLink[]) => {
      if (!selectedProjectId || !showInternalAdmin) return;

      setProjectLinksSaving(true);
      try {
        const updated = await updateProjectLinks(selectedProjectId, links);
        updateProjectInList(updated);
        setProjectLinksModalOpen(false);
      } finally {
        setProjectLinksSaving(false);
      }
    },
    [selectedProjectId, showInternalAdmin, updateProjectInList]
  );

  const mergeTaskIntoList = useCallback((updated: Task) => {
    setAllTasks((prev) => {
      const exists = prev.some((row) => row._uuid === updated._uuid);
      const next = exists
        ? prev.map((row) => (row._uuid === updated._uuid ? updated : row))
        : [...prev, updated];
      return next.sort((a, b) => a.id - b.id);
    });
  }, []);

  const handleCreateSubtask = useCallback(
    async (parent: Task) => {
      const projectId = parent.project_id ?? selectedProjectId;
      if (!projectId) {
        throw new Error("Select a project before adding subtasks.");
      }

      const payload: TaskPayload = {
        Issue: "New Subtask",
        parent_task_id: parent._uuid,
        project_id: projectId,
        areaName: parent.areaName ?? undefined,
        areaCode: parent.areaCode ?? undefined,
        Responsible: parent.Responsible ?? undefined,
        status: parent.status ?? "Pending",
      };
      if (isInternalMode && parent.visibility_scope) {
        payload.visibility_scope = parent.visibility_scope;
      }
      const created = await createTask(mode, payload);
      mergeTaskIntoList(created);
      setExpandedParentIds((prev) => new Set(prev).add(parent._uuid));
      try {
        await logTaskEvent(
          parent._uuid,
          "subtask_created",
          "Subtask Created",
          null,
          created.Issue ?? "New Subtask"
        );
      } catch {
        /* history is best-effort */
      }
    },
    [isInternalMode, mergeTaskIntoList, mode, selectedProjectId]
  );

  const handlePromoteSubtask = useCallback(
    async (subtask: Task) => {
      const previousParentId = subtask.parent_task_id ?? null;
      const oldParent = previousParentId
        ? projectTasks.find((row) => row._uuid === previousParentId)
        : null;
      const updated = await updateTask(mode, subtask._uuid, {
        parent_task_id: null,
      });
      mergeTaskIntoList(updated);
      setPanelTask((prev) =>
        prev != null && prev._uuid === updated._uuid ? updated : prev
      );
      try {
        await logTaskEvent(
          updated._uuid,
          "promoted_to_main",
          "Promoted to Main Task",
          oldParent ? taskHierarchyLabel(oldParent) : null,
          null
        );
      } catch {
        /* history is best-effort */
      }
      pushUndo({
        message: undoMessagePromote(subtask),
        entries: [{ taskUuid: subtask._uuid, previousParentId }],
      });
    },
    [mergeTaskIntoList, mode, projectTasks, pushUndo]
  );

  const handleMoveToSubtask = useCallback(
    async (task: Task, parentTaskId: string) => {
      validateAssignParent(task, parentTaskId, projectTasks);
      const previousParentId = task.parent_task_id ?? null;
      const parent = projectTasks.find((row) => row._uuid === parentTaskId);
      const oldParent = previousParentId
        ? projectTasks.find((row) => row._uuid === previousParentId)
        : null;
      const isReparent =
        Boolean(previousParentId) && previousParentId !== parentTaskId;
      const updated = await updateTask(mode, task._uuid, {
        parent_task_id: parentTaskId,
      });
      mergeTaskIntoList(updated);
      setPanelTask((prev) =>
        prev != null && prev._uuid === updated._uuid ? updated : prev
      );
      setExpandedParentIds((prev) => new Set(prev).add(parentTaskId));
      try {
        if (isReparent) {
          await logTaskEvent(
            updated._uuid,
            "moved_subtask",
            "Moved Subtask",
            oldParent ? taskHierarchyLabel(oldParent) : null,
            parent ? taskHierarchyLabel(parent) : null
          );
        } else {
          await logTaskEvent(
            updated._uuid,
            "converted_to_subtask",
            "Converted to Subtask",
            null,
            parent ? taskHierarchyLabel(parent) : null
          );
        }
      } catch {
        /* history is best-effort */
      }
      if (parent) {
        const message =
          isReparent && oldParent
            ? undoMessageReparent(task, parent, oldParent)
            : undoMessageConvert(task, parent);
        pushUndo({
          message,
          entries: [{ taskUuid: task._uuid, previousParentId }],
        });
      }
    },
    [mergeTaskIntoList, mode, projectTasks, pushUndo]
  );

  const openParentPicker = useCallback(
    (mode: ParentTaskPickerMode, task: Task | null, tasks: Task[] = []) => {
      setPickerMode(mode);
      setPickerTask(task);
      setPickerTasks(tasks);
      setPickerError(null);
      setPickerOpen(true);
    },
    []
  );

  const pickerCandidates = useMemo(() => {
    if (pickerMode === "bulk" && pickerTasks.length > 0) {
      const excludeIds = new Set(pickerTasks.map((task) => task._uuid));
      return projectTasks
        .filter((task) => !task.parent_task_id && !excludeIds.has(task._uuid))
        .sort((a, b) => a.id - b.id);
    }
    if (!pickerTask) return [];
    return listParentTaskCandidates(projectTasks, pickerTask, {
      excludeParentId:
        pickerMode === "reparent" ? pickerTask.parent_task_id : null,
    });
  }, [pickerMode, pickerTask, pickerTasks, projectTasks]);

  const handleConfirmParentPicker = useCallback(
    async (parentTaskId: string) => {
      setPickerLoading(true);
      setPickerError(null);
      try {
        if (pickerMode === "bulk") {
          const undoEntries = pickerTasks.map((task) => ({
            taskUuid: task._uuid,
            previousParentId: task.parent_task_id ?? null,
          }));
          for (const task of pickerTasks) {
            validateAssignParent(task, parentTaskId, projectTasks);
          }
          const updatedRows = await updateTasksBulk(
            mode,
            pickerTasks.map((task) => task._uuid),
            { parent_task_id: parentTaskId }
          );
          const parent = projectTasks.find((row) => row._uuid === parentTaskId);
          for (const updated of updatedRows) {
            mergeTaskIntoList(updated);
            try {
              await logTaskEvent(
                updated._uuid,
                "converted_to_subtask",
                "Converted to Subtask",
                null,
                parent ? taskHierarchyLabel(parent) : null
              );
            } catch {
              /* best-effort */
            }
          }
          setExpandedParentIds((prev) => new Set(prev).add(parentTaskId));
          if (parent) {
            pushUndo({
              message: undoMessageBulk(pickerTasks.length, parent),
              entries: undoEntries,
            });
          }
          clearSelection();
        } else if (pickerTask) {
          await handleMoveToSubtask(pickerTask, parentTaskId);
        }
        setPickerOpen(false);
      } catch (err) {
        setPickerError(
          err instanceof Error ? err.message : "Hierarchy update failed."
        );
      } finally {
        setPickerLoading(false);
      }
    },
    [
      clearSelection,
      handleMoveToSubtask,
      mergeTaskIntoList,
      mode,
      pickerMode,
      pickerTask,
      pickerTasks,
      projectTasks,
      pushUndo,
    ]
  );

  const handleHierarchyUndo = useCallback(async () => {
    if (!undoAction) return;
    setUndoing(true);
    try {
      for (const entry of undoAction.entries) {
        const updated = await updateTask(mode, entry.taskUuid, {
          parent_task_id: entry.previousParentId,
        });
        mergeTaskIntoList(updated);
        setPanelTask((prev) =>
          prev != null && prev._uuid === updated._uuid ? updated : prev
        );
        if (entry.previousParentId) {
          setExpandedParentIds((prev) =>
            new Set(prev).add(entry.previousParentId!)
          );
        }
      }
      dismissUndo();
    } catch (err) {
      setPickerError(
        err instanceof Error ? err.message : "Could not undo hierarchy change."
      );
    } finally {
      setUndoing(false);
    }
  }, [dismissUndo, mergeTaskIntoList, mode, undoAction]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      if (!canEditTasks || !isInternalMode || !panelTask) return;

      const key = event.key.toLowerCase();
      if (key === "m" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        if (panelTask.parent_task_id) {
          openParentPicker("reparent", panelTask);
        } else if (canMoveTaskToSubtask(panelTask, projectTasks)) {
          openParentPicker("convert", panelTask);
        }
        return;
      }

      if (key === "p" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        if (panelTask.parent_task_id) {
          event.preventDefault();
          void handlePromoteSubtask(panelTask);
        }
        return;
      }

      if (key === "s" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        if (!panelTask.parent_task_id) {
          event.preventDefault();
          void handleCreateSubtask(panelTask);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    canEditTasks,
    handleCreateSubtask,
    handlePromoteSubtask,
    isInternalMode,
    openParentPicker,
    panelTask,
    projectTasks,
  ]);

  const handleDragDropConfirm = useCallback(async () => {
    if (!dragConfirm) return;
    try {
      await handleMoveToSubtask(dragConfirm.task, dragConfirm.parent._uuid);
      setDragConfirm(null);
    } catch (err) {
      setPickerError(
        err instanceof Error ? err.message : "Could not move task."
      );
      setDragConfirm(null);
    }
  }, [dragConfirm, handleMoveToSubtask]);

  const handleToggleSubtaskComplete = useCallback(
    async (subtask: Task) => {
      const complete = isSubtaskComplete(subtask);
      const updated = await updateTask(mode, subtask._uuid, {
        status: complete ? "Pending" : "Complete",
        "Date Completed": complete ? "" : todayIso(),
      });
      mergeTaskIntoList(updated);
      setPanelTask((prev) =>
        prev != null && prev._uuid === updated._uuid ? updated : prev
      );
    },
    [mergeTaskIntoList, mode]
  );

  const handleOpenSubtask = useCallback((task: Task) => {
    setPanelTask(task);
  }, []);

  const handleImportedTasks = useCallback((created: Task[]) => {
    setAllTasks((prev) =>
      [...prev, ...created].sort((a, b) => a.id - b.id)
    );
  }, []);

  const applySummaryFilter = useCallback((key: SummaryFilterKey) => {
    const {
      filters: patch,
      showRecentOnly: recent,
      clientActivityOnly: clientOnly,
      attentionOnly: attention,
      waitingOnly: waiting,
      myTasksOnly: mine,
    } = summaryFilterPatch(key);
    setColumnFilterDrafts({});
    setShowRecentOnly(recent);
    setClientActivityOnly(Boolean(clientOnly));
    setAttentionOnly(Boolean(attention));
    setWaitingOnly(Boolean(waiting));
    setMyTasksOnly(Boolean(mine));
    setSummaryFilter(key);
    setFilters({
      ...EMPTY_FILTERS,
      sbOwners: [],
      ...patch,
    });
  }, []);

  const handleSummaryFilterClick = useCallback(
    (key: SummaryFilterKey) => {
      if (summaryFilter === key) {
        setSummaryFilter(null);
        setShowRecentOnly(false);
        setClientActivityOnly(false);
        setAttentionOnly(false);
        setWaitingOnly(false);
        setMyTasksOnly(false);
        setColumnFilterDrafts({});
        setFilters({ ...EMPTY_FILTERS, sbOwners: [] });
        return;
      }
      applySummaryFilter(key);
    },
    [summaryFilter, applySummaryFilter]
  );

  function clearFilters() {
    setColumnFilterDrafts({});
    setShowRecentOnly(false);
    setClientActivityOnly(false);
    setAttentionOnly(false);
    setWaitingOnly(false);
    setMyTasksOnly(false);
    setSummaryFilter(null);
    setFilters({ ...EMPTY_FILTERS, sbOwners: [] });
  }

  const handleColumnFilterDraftChange = useCallback(
    (columnId: string, value: string) => {
      setColumnFilterDrafts((prev) => ({ ...prev, [columnId]: value }));
    },
    []
  );

  const clearSummaryFilter = useCallback(() => {
    if (!summaryFilter) return;
    setSummaryFilter(null);
    setShowRecentOnly(false);
    setClientActivityOnly(false);
    setAttentionOnly(false);
    setWaitingOnly(false);
    setMyTasksOnly(false);
    setColumnFilterDrafts({});
    setFilters({ ...EMPTY_FILTERS, sbOwners: [] });
  }, [summaryFilter]);

  const handleHeaderSort = useCallback((columnId: string) => {
    setFilters((prev) => ({
      ...prev,
      sort: cycleColumnSort(columnId, prev.sort || "id"),
    }));
  }, []);

  const headerTitle = useMemo(() => viewModeLabel(mode), [mode]);

  return (
    <>
      {panelTask !== undefined ? (
        <TaskPanel
          task={panelTask}
          allTasks={projectTasks}
          areas={areas}
          onAreasChange={setAreas}
          mode={mode}
          users={users}
          onClose={closePanel}
          onUpdated={handlePanelUpdated}
          onCreated={handlePanelCreated}
          onDeleted={handlePanelDeleted}
          onOpenSubtask={handleOpenSubtask}
          onCreateSubtask={handleCreateSubtask}
          onPromoteSubtask={handlePromoteSubtask}
          onMoveToSubtask={handleMoveToSubtask}
          onToggleSubtaskComplete={handleToggleSubtaskComplete}
          onManageLinks={openLinkModal}
          projectId={selectedProjectId}
          onCommentsChanged={() => void refreshWaitingTaskIds()}
          readOnly={projectReadOnly}
        />
      ) : null}

      <LinksEditorModal
        open={linkModalTask != null}
        title={
          linkModalTask
            ? `Task links — ${linkModalTask.Issue || `Task #${linkModalTask.id}`}`
            : "Task links"
        }
        links={linkModalTask?.links ?? []}
        readOnly={!isInternalMode}
        saving={linksSaving}
        onClose={closeLinkModal}
        onSave={handleSaveLinks}
      />

      <LinksEditorModal
        open={projectLinksModalOpen && selectedProject != null}
        title={
          selectedProject
            ? `Project links — ${selectedProject.name}`
            : "Project links"
        }
        links={selectedProject?.links ?? []}
        readOnly={!showInternalAdmin}
        saving={projectLinksSaving}
        onClose={closeProjectLinksModal}
        onSave={handleSaveProjectLinks}
      />

      {showInternalAdmin ? (
        <TaskImportModal
          open={importModalOpen}
          projectId={selectedProjectId}
          onClose={() => setImportModalOpen(false)}
          onImported={handleImportedTasks}
        />
      ) : null}

      <AppShell
        fullWidth
        pageTitle={headerTitle}
        pageDescription={subtitle ?? viewModeDescription(mode)}
        userEmail={userEmail}
        userRole={userRole}
        headerToolbar={
          <div className="flex flex-wrap items-center gap-2">
            {!selectedProject ? (
              <ViewModeSwitch
                currentMode={mode}
                userRole={userRole}
                projectId={selectedProjectId}
              />
            ) : null}
            {isInternalMode ? (
              <Link href="/today" className={ui.btnHeader}>
                Today
              </Link>
            ) : null}
          </div>
        }
        headerActions={
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={openNewPanel}
              disabled={!canCreateTasks}
              className={ui.btnHeaderPrimary}
              title={
                canCreateTasks
                  ? undefined
                  : "Select a project before creating tasks"
              }
            >
              + New Task
            </button>
            {showInternalAdmin ? (
              <button
                type="button"
                onClick={() => {
                  if (!selectedProjectId) {
                    setProjectActionError(
                      "Select or create a project before importing tasks."
                    );
                    return;
                  }
                  setImportModalOpen(true);
                }}
                disabled={!canCreateTasks}
                className={ui.btnHeader}
              >
                Import CSV/Excel
              </button>
            ) : null}
            {backHref ? (
              <Link href={backHref} className={ui.btnHeader}>
                Back to dashboard
              </Link>
            ) : null}
          </div>
        }
      >
        {loadError ? (
          <div className={`no-print ${ui.alertError}`}>{loadError}</div>
        ) : null}

        {mode === "client" && canUseInternalTools ? (
          <ClientViewModeBanner
            mode={mode}
            isPreview
          />
        ) : null}

        <ProjectToolbar
          projects={projects}
          selectedProjectId={selectedProjectId}
          readOnly={projectReadOnly}
          loading={projectsLoading}
          isInternal={showInternalAdmin}
          shareLoading={shareProjectLoading}
          inviteLoading={inviteProjectLoading}
          actionError={projectActionError}
          onSelectProject={handleSelectProject}
          onCreateProject={
            showInternalAdmin ? () => setCreateProjectOpen(true) : undefined
          }
          onShareProject={
            showInternalAdmin ? () => void handleShareProject() : undefined
          }
          onInviteUser={
            showInternalAdmin
              ? (email) => void handleInviteUser(email)
              : undefined
          }
        />

        {selectedProject ? (
          <ProjectWorkspaceBar
            project={selectedProject}
            stats={projectStats}
            loading={loading}
            showHomeLink={isInternalMode}
            viewToggle={
              <ViewModeSwitch
                currentMode={mode}
                userRole={userRole}
                projectId={selectedProjectId}
              />
            }
          />
        ) : null}

        {projectReadOnly ? <ArchivedReadOnlyBanner /> : null}

        {selectedProject ? (
          <div className={focusMode ? "hidden" : "mb-2"}>
            <ProjectKpiBar
              stats={projectStats}
              waitingCount={attentionStats?.unansweredComments ?? 0}
              loading={loading}
              activeFilter={summaryFilter}
              onFilterClick={handleSummaryFilterClick}
            />
          </div>
        ) : null}

        {!hasActiveProject && !projectsLoading ? (
          <NoProjectSelectedState
            isInternal={showInternalAdmin}
            hasProjects={projects.length > 0}
            dashboardHref={backHref ?? "/dashboard"}
          />
        ) : null}

        {hasActiveProject &&
        !projectsLoading &&
        !loading &&
        projectTasks.length === 0 ? (
          <NoTasksYetState
            onAddTask={openNewPanel}
            disabled={!canCreateTasks}
          />
        ) : null}

        {summaryFilter ? (
          <div className="mb-2">
            <SummaryFilterBanner
              filterKey={summaryFilter}
              onClear={clearSummaryFilter}
            />
          </div>
        ) : null}

        {showTaskWorkspace ? (
          <>
        {/* Table + export/print (uses visibleTasks only — no refetch) */}
        <section
          ref={fullscreenRef}
          id="print-area"
          className={ui.card}
        >
          <div className="hidden print:block print-header px-6 pb-4 pt-6">
            <h1 className="text-xl font-bold text-black">
              {selectedProject?.name ?? titleProp ?? viewModeLabel(mode)}
            </h1>
            <p className="mt-1 text-sm text-black">
              {subtitle ||
                (userEmail
                  ? `Signed in as ${userEmail}${userRole ? ` (${userRole})` : ""}`
                  : "")}
            </p>
            <p className="mt-2 text-sm text-black">{filterSummary}</p>
            <p className="mt-1 text-xs text-black">Printed {printDate || ""}</p>
          </div>

          <TaskWorkspaceToolbar
            mode={mode}
            visibleTasks={visibleTasks}
            disabled={loading}
            focusMode={focusMode}
            isFullscreen={isFullscreen}
            onToggleFocus={toggleFocusMode}
            onToggleFullscreen={() => void toggleFullscreen()}
            onPrint={() => window.print()}
            onClearFilters={clearFilters}
          />

          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-1.5 sm:px-5 print:hidden">
            <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`${ui.btnSecondarySm}${
                viewMode === "table"
                  ? " border-accent bg-accent/10 text-accent"
                  : ""
              }`}
              aria-pressed={viewMode === "table"}
            >
              Table View
            </button>
            <button
              type="button"
              onClick={() => setViewMode("calendar")}
              className={`${ui.btnSecondarySm}${
                viewMode === "calendar"
                  ? " border-accent bg-accent/10 text-accent"
                  : ""
              }`}
              aria-pressed={viewMode === "calendar"}
            >
              Calendar View
            </button>
            <button
              type="button"
              onClick={() => setViewMode("gantt")}
              className={`${ui.btnSecondarySm}${
                viewMode === "gantt"
                  ? " border-accent bg-accent/10 text-accent"
                  : ""
              }`}
              aria-pressed={viewMode === "gantt"}
            >
              Gantt View
            </button>
            {isInternalMode ? (
              <button
                type="button"
                onClick={() => setViewMode("blueprint")}
                className={`${ui.btnSecondarySm}${
                  viewMode === "blueprint"
                    ? " border-accent bg-accent/10 text-accent"
                    : ""
                }`}
                aria-pressed={viewMode === "blueprint"}
              >
                Blueprint
              </button>
            ) : null}
            {viewMode === "table" && isInternalMode ? (
              <label
                className={`${ui.filterToggle} ml-1 cursor-pointer text-xs`}
              >
                <input
                  type="checkbox"
                  checked={showOptionalColumns}
                  onChange={(event) => {
                    const next = event.target.checked;
                    setShowOptionalColumns(next);
                    persistShowOptionalColumns(next);
                  }}
                  className="rounded border-border text-accent focus:ring-accent/30"
                />
                Show optional columns
              </label>
            ) : null}
            </div>
            <DueDateLegend />
          </div>

          {viewMode === "blueprint" ? (
            <ProjectBlueprintView
              project={selectedProject}
              tasks={projectTasks}
              loading={loading}
            />
          ) : viewMode === "gantt" ? (
            loading ? (
              <p className="px-6 py-12 text-center text-sm text-muted print:hidden">
                Loading tasks…
              </p>
            ) : (
              <GanttView tasks={visibleTasks} onSelectTask={openPanel} />
            )
          ) : viewMode === "calendar" ? (
            loading ? (
              <p className="px-6 py-12 text-center text-sm text-muted print:hidden">
                Loading tasks…
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-3 border-b border-border px-6 py-3 print:hidden">
                  <label className="flex items-center gap-2 text-sm text-primary/80">
                    <span className="font-medium">Calendar dates</span>
                    <select
                      value={calendarDateMode}
                      onChange={(event) =>
                        setCalendarDateMode(event.target.value as CalendarDateMode)
                      }
                      className={ui.filterToolbarSelect}
                      aria-label="Calendar date type"
                    >
                      <option value="due">Due Date</option>
                      <option value="intervention">Intervention Date</option>
                      <option value="completed">Completed Date</option>
                    </select>
                  </label>
                  <span className="text-sm text-muted">
                    Showing: {CALENDAR_DATE_MODE_LABELS[calendarDateMode]} dates
                  </span>
                </div>
                <CalendarView
                  tasks={visibleTasks}
                  dateMode={calendarDateMode}
                  onSelectTask={openPanel}
                />
              </>
            )
          ) : (
            <>
          {selectedIds.size > 0 ? (
            <div className="sticky top-0 z-30 mx-6 mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 shadow-sm print:hidden">
              <span className="text-sm font-medium text-primary">
                {selectedIds.size} selected
              </span>
              {bulkApplying && bulkProgressTotal > 0 ? (
                <span className="ml-2 text-sm text-muted">
                  {bulkProgressCompleted}/{bulkProgressTotal}
                </span>
              ) : null}

              <select
                value={bulkStatusValue}
                onChange={(event) => setBulkStatusValue(event.target.value)}
                className={ui.filterToolbarSelect}
                aria-label="Bulk status"
                disabled={bulkApplying}
              >
                <option value="">
                  {isInternalMode ? "Choose SB status…" : "Choose status…"}
                </option>
                {bulkStatusOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() =>
                  void applyBulkField(
                    isInternalMode ? "SB Status" : "status",
                    bulkStatusValue
                  )
                }
                disabled={!bulkStatusValue || bulkApplying}
                className={ui.btnSecondarySm}
              >
                Set Status
              </button>

              {isInternalMode ? (
                <>
                  <select
                    value={bulkPriorityValue}
                    onChange={(event) =>
                      setBulkPriorityValue(event.target.value)
                    }
                    className={ui.filterToolbarSelect}
                    aria-label="Bulk priority"
                    disabled={bulkApplying}
                  >
                    <option value="">Choose priority…</option>
                    {PRIORITY_FILTER_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() =>
                      void applyBulkField("Priority", bulkPriorityValue)
                    }
                    disabled={!bulkPriorityValue || bulkApplying}
                    className={ui.btnSecondarySm}
                  >
                    Set Priority
                  </button>
                </>
              ) : null}

              {isInternalMode && bulkHierarchyCandidates.length > 0 ? (
                <button
                  type="button"
                  onClick={() =>
                    openParentPicker("bulk", null, bulkHierarchyCandidates)
                  }
                  disabled={bulkApplying}
                  className={ui.btnSecondarySm}
                >
                  ↳ Move Under Task…
                </button>
              ) : null}

              <button
                type="button"
                onClick={clearSelection}
                disabled={bulkApplying}
                className={ui.filterToolbarClear}
              >
                Clear
              </button>
            </div>
          ) : null}

          <div
            ref={tableScrollRef}
            className={ui.tableScroll}
            style={
              tableScrollMaxHeight != null
                ? { maxHeight: `${tableScrollMaxHeight}px` }
                : undefined
            }
          >
            <table
              className="w-full table-fixed border-separate border-spacing-0 text-xs"
              style={{ minWidth: `${tableMinWidth}px` }}
            >
              <colgroup>
                <col style={{ width: "40px" }} />
                {tableColumns.map((col) => (
                  <col
                    key={col.id}
                    style={{ width: `${getColumnWidth(col.id)}px` }}
                  />
                ))}
              </colgroup>
              <thead className={`${ui.tableHead} task-table-sticky-header print:bg-white`}>
                <TaskTableHeader
                  tableColumns={tableColumns}
                  isInternal={isInternalMode}
                  filters={filters}
                  columnFilterDrafts={columnFilterDrafts}
                  areas={areas}
                  statusOptions={statusOptions}
                  sbOwnerOptions={sbOwnerOptions}
                  allVisibleSelected={allVisibleSelected}
                  selectAllRef={selectAllRef}
                  onToggleSelectAll={toggleSelectAllVisible}
                  onColumnFilterDraftChange={handleColumnFilterDraftChange}
                  onUpdateFilter={updateFilter}
                  onToggleSort={handleHeaderSort}
                  getColumnWidth={getColumnWidth}
                  onStartColumnResize={startColumnResize}
                  onResetColumnWidth={resetColumnWidth}
                  tableColumnPaddingClass={tableColumnPaddingClass}
                />
              </thead>
              <tbody>
                {loading || projectsLoading ? (
                  <tr className="border-b border-slate-200 last:border-b-0">
                    <td colSpan={tableColSpan} className={`${ui.tableCell} py-8 pl-6 pr-6 text-center text-muted`}>
                      Loading tasks…
                    </td>
                  </tr>
                ) : visibleTasks.length === 0 ? (
                  <tr className="border-b border-slate-200 last:border-b-0">
                    <td colSpan={tableColSpan} className={`${ui.tableCell} py-8 pl-6 pr-6 text-center text-muted`}>
                      No tasks match the current filters.
                    </td>
                  </tr>
                ) : (
                  visibleTasks.map((task) => {
                    const panelSelected =
                      panelTask != null && panelTask.id === task.id;
                    const bulkSelected = selectedIds.has(task._uuid);
                    const taskRecentlyUpdated = isRecentTask(task);
                    const rowHighlight = taskRowHighlightClass(
                      task,
                      taskRecentlyUpdated
                    );
                    const taskOwners = parseSbOwners(task["SB Owner"]).map(
                      (owner) => owner.toLowerCase()
                    );
                    const isOwnerHovered =
                      activeOwner != null && taskOwners.includes(activeOwner);
                    const isDropTarget =
                      dropTargetId === task._uuid &&
                      !task.parent_task_id &&
                      draggedTaskRef.current != null &&
                      draggedTaskRef.current._uuid !== task._uuid;
                    const isSubtaskRow = Boolean(task.parent_task_id);
                    return (
                      <tr
                        key={task.id}
                        draggable={
                          canEditTasks &&
                          isInternalMode &&
                          (canMoveTaskToSubtask(task, projectTasks) ||
                            Boolean(task.parent_task_id))
                        }
                        onDragStart={(event) => {
                          if (!canEditTasks || !isInternalMode) return;
                          draggedTaskRef.current = task;
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData(
                            "text/plain",
                            task._uuid
                          );
                        }}
                        onDragEnd={() => {
                          draggedTaskRef.current = null;
                          setDropTargetId(null);
                        }}
                        onDragOver={(event) => {
                          if (
                            !canEditTasks ||
                            !isInternalMode ||
                            task.parent_task_id ||
                            !draggedTaskRef.current ||
                            draggedTaskRef.current._uuid === task._uuid
                          ) {
                            return;
                          }
                          event.preventDefault();
                          setDropTargetId(task._uuid);
                        }}
                        onDragLeave={() => {
                          if (dropTargetId === task._uuid) {
                            setDropTargetId(null);
                          }
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          const dragged = draggedTaskRef.current;
                          setDropTargetId(null);
                          draggedTaskRef.current = null;
                          if (
                            !dragged ||
                            task.parent_task_id ||
                            dragged._uuid === task._uuid
                          ) {
                            return;
                          }
                          try {
                            validateAssignParent(
                              dragged,
                              task._uuid,
                              projectTasks
                            );
                            setDragConfirm({ task: dragged, parent: task });
                          } catch (err) {
                            setPickerError(
                              err instanceof Error
                                ? err.message
                                : "Invalid drop target."
                            );
                          }
                        }}
                        onContextMenu={(event) => {
                          if (!canEditTasks || !isInternalMode) return;
                          event.preventDefault();
                          setContextMenu({
                            task,
                            x: event.clientX,
                            y: event.clientY,
                          });
                        }}
                        onClick={() => openPanel(task)}
                        className={`${ui.tableRowTransition} ${
                          isDropTarget
                            ? "bg-accent/15 ring-2 ring-inset ring-accent/40"
                            : panelSelected
                            ? ui.tableRowSelected
                            : bulkSelected
                              ? "cursor-pointer border-b border-slate-200 bg-accent/5 last:border-b-0 hover:bg-accent/10"
                              : isOwnerHovered
                                ? "cursor-pointer border-b border-slate-200 bg-yellow-50 last:border-b-0 hover:bg-yellow-100"
                                : rowHighlight
                                  ? `cursor-pointer border-b border-slate-200 last:border-b-0 ${rowHighlight}`
                                  : isSubtaskRow
                                    ? "cursor-pointer border-b border-slate-200/80 bg-slate-50/40 last:border-b-0 hover:bg-slate-100/80"
                                    : ui.tableRow
                        }`}
                      >
                        <td
                          className={`${ui.tableCell} !py-1 w-10 align-top pl-3 pr-2 print:hidden`}
                          onClick={(event) => event.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={bulkSelected}
                            onChange={() => toggleSelect(task._uuid)}
                            aria-label={`Select task ${task.id}`}
                            className="rounded border-border text-accent focus:ring-accent/20"
                          />
                        </td>
                        {tableColumns.map((col, columnIndex) => (
                          <td
                            key={col.id}
                            className={`${ui.tableCell} !py-1 ${tableCellAlignClass(col)} ${tableColumnPaddingClass(
                              col,
                              columnIndex,
                              tableColumns.length
                            )} ${col.wrapTextCell ? "whitespace-normal break-words align-top" : ""} ${
                              col.clampedComment ? "overflow-visible align-top" : ""
                            } ${col.cellClass ?? ""}`}
                          >
                            {renderTableCell(task, col)}
                          </td>
                        ))}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
            </>
          )}
        </section>
          </>
        ) : null}

        {selectedProject ? (
          <div className={focusMode ? "hidden" : undefined}>
            <ProjectDetailsPanel
              project={selectedProject}
              stats={projectStats}
              loading={loading}
              mode={mode}
              canEditProjectLinks={showInternalAdmin && !projectReadOnly}
              onManageProjectLinks={() => setProjectLinksModalOpen(true)}
              workflowBanner={
                showInternalAdmin && !projectReadOnly ? (
                  <ProjectWorkflowBanner
                    project={selectedProject}
                    shareLoading={shareProjectLoading}
                    onShareProject={() => void handleShareProject()}
                  />
                ) : undefined
              }
            />
          </div>
        ) : null}
      </AppShell>

      <TaskRowContextMenu
        menu={contextMenu}
        allTasks={projectTasks}
        canEdit={canEditTasks && isInternalMode}
        onClose={() => setContextMenu(null)}
        onOpenTask={openPanel}
        onCreateSubtask={(task) => void handleCreateSubtask(task)}
        onConvertToSubtask={(task) => openParentPicker("convert", task)}
        onPromoteToMain={(task) => void handlePromoteSubtask(task)}
        onMoveToParent={(task) => openParentPicker("reparent", task)}
      />

      <ParentTaskPickerModal
        open={pickerOpen}
        mode={pickerMode}
        task={pickerTask}
        tasks={pickerTasks}
        candidates={pickerCandidates}
        currentParentId={pickerTask?.parent_task_id}
        allTasks={projectTasks}
        loading={pickerLoading}
        error={pickerError}
        onConfirm={(parentId) => void handleConfirmParentPicker(parentId)}
        onClose={() => {
          if (!pickerLoading) setPickerOpen(false);
        }}
      />

      <ConfirmDialog
        open={dragConfirm != null}
        title="Move task under parent?"
        description={
          dragConfirm
            ? `Attach ${taskHierarchyLabel(dragConfirm.task)} under ${taskHierarchyLabel(dragConfirm.parent)}?`
            : ""
        }
        confirmLabel="Move task"
        onConfirm={() => void handleDragDropConfirm()}
        onCancel={() => setDragConfirm(null)}
        layerClassName="z-[75]"
      />

      <HierarchyUndoToast
        action={undoAction}
        undoing={undoing}
        onUndo={() => void handleHierarchyUndo()}
        onDismiss={dismissUndo}
      />

      <CreateProjectWizard
        open={createProjectOpen}
        loading={createProjectLoading}
        error={createProjectError}
        onClose={() => {
          if (!createProjectLoading) setCreateProjectOpen(false);
        }}
        onCreated={(project) => {
          handleCreateFromWizard(project);
          void loadProjects().then(() => void loadTasks());
        }}
      />
    </>
  );
}
