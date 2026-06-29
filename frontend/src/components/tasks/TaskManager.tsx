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
import TaskLinksModal from "@/components/tasks/TaskLinksModal";
import TaskTableHeader, { cycleColumnSort } from "@/components/tasks/TaskTableHeader";
import TaskExportToolbar from "@/components/tasks/TaskExportToolbar";
import CalendarView, {
  CALENDAR_DATE_MODE_LABELS,
  type CalendarDateMode,
} from "@/components/tasks/CalendarView";
import ClampedComment from "@/components/tasks/ClampedComment";
import TaskPanel from "@/components/tasks/TaskPanel";
import ProjectToolbar from "@/components/projects/ProjectToolbar";
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
import { logSingleTaskFieldChange } from "@/lib/tasks/activityLogging";
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
  RECENT_WINDOW_MINUTES,
} from "@/lib/tasks/recentTasks";
import {
  getSubtaskProgressForTask,
  isSubtaskComplete,
  subtaskProgressLabel,
  subtaskProgressPercent,
  validateMoveToSubtask,
} from "@/lib/tasks/subtasks";
import { dueStatusClassName, getDueStatus, todayIso } from "@/lib/tasks/taskDates";
import {
  fieldLabel,
  getTableColumns,
  tableColumnCount,
  type TableColumnDef,
} from "@/lib/tasks/labels";
import { ui } from "@/lib/ui/classes";

type TaskManagerProps = {
  mode: TaskViewMode;
  title: string;
  subtitle?: string;
  userEmail?: string;
  userRole?: string;
  backHref?: string;
  initialProjectId?: string;
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

type TaskDisplayLayout = "table" | "calendar";

export default function TaskManager({
  mode,
  title,
  subtitle,
  userEmail,
  userRole,
  backHref,
  initialProjectId,
}: TaskManagerProps) {
  const isInternal = mode === "internal";

  const {
    projects,
    selectedProjectId,
    projectsLoading,
    projectActionError,
    setProjectActionError,
    loadProjects,
    handleSelectProject,
  } = useProjectManagement({
    isInternal,
    initialProjectId,
    repairOrphans: isInternal,
    autoLoad: false,
  });

  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [showSubtasksInTable, setShowSubtasksInTable] = useState(false);
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
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<TaskDisplayLayout>("table");
  const [calendarDateMode, setCalendarDateMode] =
    useState<CalendarDateMode>("due");
  const [showRecentOnly, setShowRecentOnly] = useState(false);
  const [savingMap, setSavingMap] = useState<Record<string, SyncStatus>>({});
  const updateVersionRef = useRef<Record<string, number>>({});
  const saveStatusTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const selectAllRef = useRef<HTMLInputElement>(null);

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
    if (!isInternal) return;
    try {
      setUsers(await fetchAppUsers());
    } catch {
      setUsers([]);
    }
  }, [isInternal]);

  useEffect(() => {
    async function init() {
      await loadProjects();
      await loadTasks();
      void loadUsers();
    }

    void init();
  }, [loadProjects, loadTasks, loadUsers]);

  const canCreateTasks = Boolean(selectedProjectId) && !projectsLoading;

  useEffect(() => {
    if (!isInternal) return;
    window.localStorage.setItem(
      SB_OWNERS_FILTER_STORAGE_KEY,
      JSON.stringify(filters.sbOwners)
    );
  }, [filters.sbOwners, isInternal]);

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
        return { ...prev, columnFilters: nextFilters };
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [columnFilterDrafts]);

  const statusOptions = useMemo(() => uniqueStatuses(allTasks), [allTasks]);

  const sbOwnerOptions = useMemo(
    () => (isInternal ? extractSbOwners(allTasks) : []),
    [allTasks, isInternal]
  );

  const legacyClientTaskView =
    !isInternal && projects.length === 0 && !projectsLoading;

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

  const tableTasks = useMemo(
    () => (showSubtasksInTable ? projectTasks : mainTasks),
    [projectTasks, mainTasks, showSubtasksInTable]
  );

  const tableColumns = useMemo(() => getTableColumns(mode), [mode]);

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

  const filteredTasks = useMemo(
    () => filterAndSortTasks(tableTasks, filters, columnFilterContext),
    [tableTasks, filters, columnFilterContext]
  );

  const recentTasks = useMemo(
    () => filteredTasks.filter(isRecentTask),
    [filteredTasks]
  );

  const visibleTasks = useMemo(
    () => (showRecentOnly ? recentTasks : filteredTasks),
    [showRecentOnly, recentTasks, filteredTasks]
  );

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

  const colSpan = tableColumnCount(mode);
  const tableColSpan = colSpan + 1;

  const allVisibleSelected =
    visibleTasks.length > 0 &&
    visibleTasks.every((task) => selectedIds.has(task._uuid));
  const someVisibleSelected = visibleTasks.some((task) =>
    selectedIds.has(task._uuid)
  );

  const bulkStatusOptions = isInternal
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

  function openPanel(task: Task) {
    setPanelTask(task);
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

        if (isInternal) {
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
    [isInternal, mode, scheduleInlineSaveStatusClear]
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

  function renderInlineCell(task: Task, colId: string) {
    const taskId = task._uuid;
    switch (colId) {
      case "issue": {
        const progress = getSubtaskProgressForTask(task._uuid, projectTasks);
        const progressLabel = subtaskProgressLabel(progress);
        return (
          <div className="flex items-start gap-2">
            {progressLabel ? (
              <span
                className="shrink-0 pt-0.5 text-xs font-semibold tabular-nums text-muted"
                title={`${progressLabel} subtasks complete`}
              >
                ▸ {progressLabel}
              </span>
            ) : null}
            <InlineEditableText
              value={task.Issue ?? ""}
              onSave={(value) => handleInlineFieldUpdate(task, "Issue", value)}
              status={inlineCellStatus(taskId, "Issue")}
              className="font-medium"
            />
          </div>
        );
      }
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
      case "date_due": {
        const dueValue = normalizeDateInput(task["Date Due"]) ?? "";
        const dueStatus = getDueStatus(task["Date Due"]);
        return (
          <InlineEditableDate
            value={dueValue}
            onSave={(value) =>
              handleInlineFieldUpdate(task, "Date Due", value)
            }
            status={inlineCellStatus(taskId, "Date Due")}
            className={dueStatusClassName(dueStatus)}
          />
        );
      }
      default:
        return null;
    }
  }

  function renderTableCell(task: Task, col: TableColumnDef) {
    if (col.id === "id") {
      return col.getValue(task);
    }

    if (INLINE_EDIT_IDS.has(col.id)) {
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

    if (col.id === "sb_priority") {
      return (task["SB Priority"] ?? "").trim() ? (
        <span className={sbPriorityBadgeClass(task["SB Priority"])}>
          {task["SB Priority"]}
        </span>
      ) : (
        "—"
      );
    }

    if (isInternal && col.id === "sb_owner") {
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

    if (isInternal && col.id === "visibility") {
      return (
        <span className={visibilityBadgeClass(task.visibility_scope)}>
          {visibilityBadgeLabel(task.visibility_scope)}
        </span>
      );
    }

    if (isInternal && col.id === "links") {
      return <TaskLinksCell task={task} onManageLinks={openLinkModal} />;
    }

    if (col.id === "subtasks") {
      const progress = getSubtaskProgressForTask(task._uuid, projectTasks);
      const label = subtaskProgressLabel(progress);
      if (!label) return "—";
      const percent = subtaskProgressPercent(progress);
      return (
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs font-semibold tabular-nums text-primary">
            ▸ {label}
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
              className="h-full rounded-full bg-accent transition-[width]"
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
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  const toggleOwnerFilter = useCallback((owner: string) => {
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

  const openLinkModal = useCallback(
    (task: Task) => {
      if (!isInternal) return;
      setLinkModalTask(task);
    },
    [isInternal]
  );

  const closeLinkModal = useCallback(() => {
    if (linksSaving) return;
    setLinkModalTask(null);
  }, [linksSaving]);

  const handleSaveLinks = useCallback(
    async (task: Task, links: TaskLink[]) => {
      if (!isInternal) return;

      setLinksSaving(true);
      try {
        const updated = await updateTask("internal", task._uuid, { links });
        setAllTasks((prev) =>
          prev.map((row) => (row._uuid === updated._uuid ? updated : row))
        );
        if (panelTask?._uuid === updated._uuid) {
          setPanelTask(updated);
        }
        setLinkModalTask(null);
      } finally {
        setLinksSaving(false);
      }
    },
    [isInternal, panelTask]
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
        Issue: "New subtask",
        parent_task_id: parent._uuid,
        project_id: projectId,
        areaName: parent.areaName ?? undefined,
        areaCode: parent.areaCode ?? undefined,
        Priority: parent.Priority ?? undefined,
        Responsible: parent.Responsible ?? undefined,
        status: parent.status ?? "Pending",
      };
      if (isInternal && parent.visibility_scope) {
        payload.visibility_scope = parent.visibility_scope;
      }
      const created = await createTask(mode, payload);
      mergeTaskIntoList(created);
    },
    [isInternal, mergeTaskIntoList, mode, selectedProjectId]
  );

  const handlePromoteSubtask = useCallback(
    async (subtask: Task) => {
      const updated = await updateTask(mode, subtask._uuid, {
        parent_task_id: null,
      });
      mergeTaskIntoList(updated);
      setPanelTask((prev) =>
        prev != null && prev._uuid === updated._uuid ? updated : prev
      );
    },
    [mergeTaskIntoList, mode]
  );

  const handleMoveToSubtask = useCallback(
    async (task: Task, parentTaskId: string) => {
      validateMoveToSubtask(task, parentTaskId, projectTasks);
      const updated = await updateTask(mode, task._uuid, {
        parent_task_id: parentTaskId,
      });
      mergeTaskIntoList(updated);
      setPanelTask((prev) =>
        prev != null && prev._uuid === updated._uuid ? updated : prev
      );
    },
    [mergeTaskIntoList, mode, projectTasks]
  );

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

  function clearFilters() {
    setColumnFilterDrafts({});
    setFilters({ ...EMPTY_FILTERS, sbOwners: [] });
  }

  const handleColumnFilterDraftChange = useCallback(
    (columnId: string, value: string) => {
      setColumnFilterDrafts((prev) => ({ ...prev, [columnId]: value }));
    },
    []
  );

  const handleHeaderSort = useCallback((columnId: string) => {
    setFilters((prev) => ({
      ...prev,
      sort: cycleColumnSort(columnId, prev.sort || "id"),
    }));
  }, []);

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
          projectId={selectedProjectId}
        />
      ) : null}

      <TaskLinksModal
        open={isInternal && linkModalTask != null}
        task={linkModalTask}
        saving={linksSaving}
        onClose={closeLinkModal}
        onSave={handleSaveLinks}
      />

      {isInternal ? (
        <TaskImportModal
          open={importModalOpen}
          projectId={selectedProjectId}
          onClose={() => setImportModalOpen(false)}
          onImported={handleImportedTasks}
        />
      ) : null}

      <AppShell
        fullWidth
        pageTitle={title}
        pageDescription={subtitle}
        userEmail={userEmail}
        userRole={userRole}
        headerToolbar={
          <button
            type="button"
            onClick={() => setShowRecentOnly((prev) => !prev)}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
              showRecentOnly
                ? "border-white/40 bg-white/15 text-white ring-2 ring-white/35"
                : "border-white/20 bg-white/5 text-white/90 hover:bg-white/10"
            }`}
            aria-pressed={showRecentOnly}
            aria-label={
              recentTasks.length > 0
                ? `Recent updates (${recentTasks.length})`
                : "Recent updates"
            }
            title={`Show tasks updated in the last ${RECENT_WINDOW_MINUTES} minutes`}
          >
            <span aria-hidden>🔔</span>
            <span>Recent updates</span>
            {recentTasks.length > 0 ? (
              <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[11px] font-bold leading-none text-white">
                {recentTasks.length}
              </span>
            ) : null}
          </button>
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
            {isInternal ? (
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

        {isInternal ? (
          <p className="no-print mb-3 text-sm text-muted">
            Create projects, share with clients, and invite users from the{" "}
            <Link href="/dashboard" className="font-semibold text-accent hover:underline">
              dashboard
            </Link>
            .
          </p>
        ) : null}

        <ProjectToolbar
          projects={projects}
          selectedProjectId={selectedProjectId}
          loading={projectsLoading}
          isInternal={false}
          actionError={projectActionError}
          onSelectProject={handleSelectProject}
        />

        <div className="no-print mb-2">
          <p className="text-xs text-muted">
            Sort and filter from the column headers below.
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {loading
              ? "Loading…"
              : `Showing ${visibleTasks.length} of ${tableTasks.length} ${showSubtasksInTable ? "tasks" : "main tasks"} · Area: ${areaFilterLabel}`}
          </p>
          {showRecentOnly ? (
            <p className="mt-0.5 text-xs font-medium text-blue-600">
              Filtering: recent updates (last {RECENT_WINDOW_MINUTES} minutes)
            </p>
          ) : null}
        </div>

        {/* Table + export/print (uses visibleTasks only — no refetch) */}
        <section
          id="print-area"
          className={ui.card}
        >
          <div className="hidden print:block print-header px-6 pb-4 pt-6">
            <h1 className="text-xl font-bold text-black">{title}</h1>
            <p className="mt-1 text-sm text-black">
              {subtitle ||
                (userEmail
                  ? `Signed in as ${userEmail}${userRole ? ` (${userRole})` : ""}`
                  : "")}
            </p>
            <p className="mt-2 text-sm text-black">{filterSummary}</p>
            <p className="mt-1 text-xs text-black">Printed {printDate || ""}</p>
          </div>

          <TaskExportToolbar
            mode={mode}
            title="Export & print"
            visibleTasks={visibleTasks}
            totalCount={tableTasks.length}
            filters={filters}
            disabled={loading}
            onPrint={() => window.print()}
            onClearFilters={clearFilters}
          />

          <div className="flex flex-wrap items-center gap-2 border-b border-border px-6 py-2 print:hidden">
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
            {viewMode === "table" ? (
              <label
                className={`${ui.filterToggle} ml-1 cursor-pointer text-xs`}
              >
                <input
                  type="checkbox"
                  checked={showSubtasksInTable}
                  onChange={(event) =>
                    setShowSubtasksInTable(event.target.checked)
                  }
                  className="rounded border-border text-accent focus:ring-accent/30"
                />
                Show subtasks in table
              </label>
            ) : null}
          </div>

          {viewMode === "calendar" ? (
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
            <div className="sticky top-[100px] z-30 mx-6 mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 shadow-sm print:hidden">
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
                  {isInternal ? "Choose SB status…" : "Choose status…"}
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
                    isInternal ? "SB Status" : "status",
                    bulkStatusValue
                  )
                }
                disabled={!bulkStatusValue || bulkApplying}
                className={ui.btnSecondarySm}
              >
                Set Status
              </button>

              <select
                value={bulkPriorityValue}
                onChange={(event) => setBulkPriorityValue(event.target.value)}
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

          <div className={ui.tableScroll}>
            <table className="min-w-[1400px] w-full table-fixed border-separate border-spacing-0 text-xs">
              <colgroup>
                <col style={{ width: "40px" }} />
                {tableColumns.map((col) => (
                  <col key={col.id} style={{ width: col.colWidth ?? "160px" }} />
                ))}
              </colgroup>
              <thead className={`${ui.tableHead} print:bg-white`}>
                <TaskTableHeader
                  tableColumns={tableColumns}
                  isInternal={isInternal}
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
                ) : !selectedProjectId && !legacyClientTaskView ? (
                  <tr className="border-b border-slate-200 last:border-b-0">
                    <td colSpan={tableColSpan} className={`${ui.tableCell} py-8 pl-6 pr-6 text-center text-muted`}>
                      {projects.length === 0
                        ? isInternal
                          ? "Create a project to start adding tasks."
                          : "No shared projects are available for your account."
                        : "Select a project to view tasks."}
                    </td>
                  </tr>
                ) : visibleTasks.length === 0 ? (
                  <tr className="border-b border-slate-200 last:border-b-0">
                    <td colSpan={tableColSpan} className={`${ui.tableCell} py-8 pl-6 pr-6 text-center text-muted`}>
                      {allTasks.length === 0
                        ? "No tasks yet. Use + New Task in the header."
                        : "No tasks match the current filters."}
                    </td>
                  </tr>
                ) : (
                  visibleTasks.map((task) => {
                    const panelSelected =
                      panelTask != null && panelTask.id === task.id;
                    const bulkSelected = selectedIds.has(task._uuid);
                    const taskOwners = parseSbOwners(task["SB Owner"]).map(
                      (owner) => owner.toLowerCase()
                    );
                    const isOwnerHovered =
                      activeOwner != null && taskOwners.includes(activeOwner);
                    return (
                      <tr
                        key={task.id}
                        onClick={() => openPanel(task)}
                        className={`${ui.tableRowTransition} ${
                          panelSelected
                            ? ui.tableRowSelected
                            : bulkSelected
                              ? "cursor-pointer border-b border-slate-200 bg-accent/5 last:border-b-0 hover:bg-accent/10"
                              : isOwnerHovered
                                ? "cursor-pointer border-b border-slate-200 bg-yellow-50 last:border-b-0 hover:bg-yellow-100"
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
      </AppShell>
    </>
  );
}
