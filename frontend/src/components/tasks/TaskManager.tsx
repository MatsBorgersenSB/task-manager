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
import SbOwnerMultiFilter from "@/components/tasks/SbOwnerMultiFilter";
import SbOwnerPills from "@/components/tasks/SbOwnerPills";
import TaskImportModal from "@/components/tasks/TaskImportModal";
import TaskLinksCell from "@/components/tasks/TaskLinksCell";
import TaskLinksModal from "@/components/tasks/TaskLinksModal";
import TaskExportToolbar from "@/components/tasks/TaskExportToolbar";
import TaskPanel from "@/components/tasks/TaskPanel";
import {
  CLIENT_STATUS_FILTER_ALL,
  CLIENT_STATUS_OPTIONS,
  PRIORITY_FILTER_OPTIONS,
  SB_PRIORITY_OPTIONS,
  SB_STATUS_OPTIONS,
} from "@/lib/tasks/constants";
import { buildAreaFilterOptions, type Area } from "@/lib/tasks/areas";
import { fetchAreas } from "@/lib/tasks/areasApi";
import {
  buildEquipmentTypeFilterOptions,
  type EquipmentType,
} from "@/lib/tasks/equipmentTypes";
import { fetchEquipmentTypes } from "@/lib/tasks/equipmentTypesApi";
import {
  BULK_UPDATE_CHUNK_SIZE,
  fetchAppUsers,
  fetchTasks,
  updateTask,
  updateTasksBulk,
} from "@/lib/tasks/api";
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
  fieldLabel,
  filterStatusLabel,
  getTableColumns,
  tableColumnCount,
} from "@/lib/tasks/labels";
import { ui } from "@/lib/ui/classes";

type TaskManagerProps = {
  mode: TaskViewMode;
  title: string;
  subtitle?: string;
  userEmail?: string;
  userRole?: string;
  backHref?: string;
};

const EMPTY_FILTERS: TaskFilters = {
  searchText: "",
  priority: "",
  status: "",
  sbStatus: "",
  sbPriority: "",
  sbOwners: [],
  area: "",
  equipmentType: "",
  visibilityScope: "",
  due: "",
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

export default function TaskManager({
  mode,
  title,
  subtitle,
  userEmail,
  userRole,
  backHref = "/dashboard",
}: TaskManagerProps) {
  const isInternal = mode === "internal";

  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [equipmentTypes, setEquipmentTypes] = useState<EquipmentType[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [filters, setFilters] = useState<TaskFilters>(() => ({
    ...EMPTY_FILTERS,
    sbOwners: readStoredSbOwners(),
  }));
  const [searchDraft, setSearchDraft] = useState("");
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

  useEffect(() => {
    async function loadEquipmentTypes() {
      try {
        const data = await fetchEquipmentTypes();
        setEquipmentTypes(data || []);
      } catch (err) {
        console.error("Failed to load equipment types:", err);
        setEquipmentTypes([]);
      }
    }
    void loadEquipmentTypes();
  }, []);

  useEffect(() => {
    console.log("Loaded areas:", areas);
  }, [areas]);

  const loadUsers = useCallback(async () => {
    if (!isInternal) return;
    try {
      setUsers(await fetchAppUsers());
    } catch {
      setUsers([]);
    }
  }, [isInternal]);

  useEffect(() => {
    void loadTasks();
    void loadUsers();
  }, [loadTasks, loadUsers]);

  useEffect(() => {
    if (!isInternal) return;
    window.localStorage.setItem(
      SB_OWNERS_FILTER_STORAGE_KEY,
      JSON.stringify(filters.sbOwners)
    );
  }, [filters.sbOwners, isInternal]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilters((prev) => {
        const nextSearch = searchDraft.trim();
        if (prev.searchText === nextSearch) return prev;
        return { ...prev, searchText: nextSearch };
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchDraft]);

  const statusOptions = useMemo(() => uniqueStatuses(allTasks), [allTasks]);

  const sbOwnerOptions = useMemo(
    () => (isInternal ? extractSbOwners(allTasks) : []),
    [allTasks, isInternal]
  );

  const areaFilterOptions = useMemo(
    () => buildAreaFilterOptions(allTasks, areas),
    [allTasks, areas]
  );

  const equipmentTypeFilterOptions = useMemo(
    () => buildEquipmentTypeFilterOptions(allTasks, equipmentTypes),
    [allTasks, equipmentTypes]
  );

  const visibleTasks = useMemo(
    () => filterAndSortTasks(allTasks, filters),
    [allTasks, filters]
  );

  const filterSummary = useMemo(
    () =>
      buildFilterSummary(
        filters,
        visibleTasks.length,
        allTasks.length,
        mode
      ),
    [filters, visibleTasks.length, allTasks.length, mode]
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

  const tableColumns = useMemo(() => getTableColumns(mode), [mode]);
  const idColumn = tableColumns[0];
  const dataColumns = tableColumns.slice(1);
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
    [mode, scheduleInlineSaveStatusClear]
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
      case "issue":
        return (
          <InlineEditableText
            value={task.Issue ?? ""}
            onSave={(value) => handleInlineFieldUpdate(task, "Issue", value)}
            status={inlineCellStatus(taskId, "Issue")}
            className="font-medium"
          />
        );
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
        return (
          <InlineEditableDate
            value={normalizeDateInput(task["Date Due"]) ?? ""}
            onSave={(value) =>
              handleInlineFieldUpdate(task, "Date Due", value)
            }
            status={inlineCellStatus(taskId, "Date Due")}
          />
        );
      default:
        return null;
    }
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

  const handleImportedTasks = useCallback((created: Task[]) => {
    setAllTasks((prev) =>
      [...prev, ...created].sort((a, b) => a.id - b.id)
    );
  }, []);

  function clearFilters() {
    setSearchDraft("");
    setFilters(EMPTY_FILTERS);
  }

  return (
    <>
      {panelTask !== undefined ? (
        <TaskPanel
          task={panelTask}
          areas={areas}
          onAreasChange={setAreas}
          equipmentTypes={equipmentTypes}
          onEquipmentTypesChange={setEquipmentTypes}
          mode={mode}
          users={users}
          onClose={closePanel}
          onUpdated={handlePanelUpdated}
          onCreated={handlePanelCreated}
          onDeleted={handlePanelDeleted}
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
        headerActions={
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={openNewPanel}
              className={ui.btnHeaderPrimary}
            >
              + New Task
            </button>
            {isInternal ? (
              <button
                type="button"
                onClick={() => setImportModalOpen(true)}
                className={ui.btnHeader}
              >
                Import CSV/Excel
              </button>
            ) : null}
            <Link href={backHref} className={ui.btnHeader}>
              Back to dashboard
            </Link>
          </div>
        }
      >
        {loadError ? (
          <div className={`no-print ${ui.alertError}`}>{loadError}</div>
        ) : null}

        <div className={ui.filterToolbarSticky}>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
            <input
              type="search"
              placeholder="Search tasks..."
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              className={ui.filterToolbarInput}
              aria-label="Search tasks"
            />
            {searchDraft ? (
              <button
                type="button"
                onClick={() => setSearchDraft("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-1 text-sm text-muted transition hover:text-primary"
                aria-label="Clear search"
              >
                ×
              </button>
            ) : null}
          </div>

          {isInternal ? (
            <select
              value={filters.priority}
              onChange={(e) => updateFilter("priority", e.target.value)}
              className={ui.filterToolbarSelect}
              aria-label={fieldLabel("Priority")}
            >
              <option value="">All priorities</option>
              {PRIORITY_FILTER_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          ) : null}

          {isInternal ? (
            <select
              value={filters.sbStatus}
              onChange={(e) => updateFilter("sbStatus", e.target.value)}
              className={ui.filterToolbarSelect}
              aria-label={fieldLabel("SB Status")}
            >
              <option value="">All SB statuses</option>
              {SB_STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          ) : null}

          <select
            value={filters.area}
            onChange={(e) => updateFilter("area", e.target.value)}
            className={ui.filterToolbarSelect}
            aria-label={fieldLabel("Area")}
          >
            <option value="">All areas</option>
            {areaFilterOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            value={filters.equipmentType}
            onChange={(e) => updateFilter("equipmentType", e.target.value)}
            className={ui.filterToolbarSelect}
            aria-label={fieldLabel("Equipment Type")}
          >
            <option value="">All equipment types</option>
            {equipmentTypeFilterOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            value={filters.status}
            onChange={(e) => updateFilter("status", e.target.value)}
            className={ui.filterToolbarSelect}
            aria-label={filterStatusLabel()}
          >
            <option value="">Active tasks (default)</option>
            <option value={CLIENT_STATUS_FILTER_ALL}>All client statuses</option>
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <label className="flex items-center gap-2 whitespace-nowrap text-sm text-primary/80">
            <input
              type="checkbox"
              checked={filters.status === CLIENT_STATUS_FILTER_ALL}
              onChange={(event) =>
                updateFilter(
                  "status",
                  event.target.checked ? CLIENT_STATUS_FILTER_ALL : ""
                )
              }
              className="rounded border-border text-accent focus:ring-accent/20"
              aria-label="Show completed client tasks"
            />
            Show completed
          </label>

          <select
            value={filters.due}
            onChange={(e) => updateFilter("due", e.target.value)}
            className={ui.filterToolbarSelect}
            aria-label="Due date"
          >
            <option value="">All due dates</option>
            <option value="overdue">Overdue</option>
            <option value="has">Has due date</option>
            <option value="none">No due date</option>
          </select>

          {isInternal ? (
            <select
              value={filters.visibilityScope}
              onChange={(e) => updateFilter("visibilityScope", e.target.value)}
              className={ui.filterToolbarSelect}
              aria-label={fieldLabel("Visibility")}
            >
              <option value="">All visibility</option>
              <option value="internal">Internal only</option>
              <option value="internal_client">Client visible</option>
            </select>
          ) : null}

          {isInternal ? (
            <select
              value={filters.sbPriority}
              onChange={(e) => updateFilter("sbPriority", e.target.value)}
              className={ui.filterToolbarSelect}
              aria-label={fieldLabel("SB Priority")}
            >
              <option value="">All SB priorities</option>
              {SB_PRIORITY_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          ) : null}

          {isInternal ? (
            <SbOwnerMultiFilter
              options={sbOwnerOptions}
              selected={filters.sbOwners}
              onChange={(owners) => updateFilter("sbOwners", owners)}
              label={fieldLabel("SB Owner")}
            />
          ) : null}

          <select
            value={filters.sort}
            onChange={(e) => updateFilter("sort", e.target.value)}
            className={ui.filterToolbarSelect}
            aria-label="Sort by"
          >
            <option value="id">Sort: ID</option>
            <option value="due-asc">Sort: Due (earliest)</option>
            <option value="due-desc">Sort: Due (latest)</option>
            {isInternal ? <option value="priority">Sort: {fieldLabel("Priority")}</option> : null}
            <option value="status">Sort: {fieldLabel("status")}</option>
            {isInternal ? (
              <>
                <option value="sb-status">Sort: {fieldLabel("SB Status")}</option>
                <option value="sb-owners-asc">
                  Sort: {fieldLabel("SB Owner")} (A–Z)
                </option>
                <option value="sb-owners-desc">
                  Sort: {fieldLabel("SB Owner")} (Z–A)
                </option>
              </>
            ) : null}
          </select>

          <button
            type="button"
            onClick={clearFilters}
            className={ui.filterToolbarClear}
          >
            Clear
          </button>
          </div>

          <p className="mt-2 text-sm text-muted">
            {loading
              ? "Loading…"
              : `Showing ${visibleTasks.length} of ${allTasks.length} tasks`}
          </p>
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
            totalCount={allTasks.length}
            filters={filters}
            disabled={loading}
            onPrint={() => window.print()}
          />

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
            <table className={ui.table}>
              <thead className={`${ui.tableHead} print:bg-white`}>
                <tr>
                  <th
                    className={`${ui.tableHeadCell} w-10 pl-6 pr-2 print:hidden`}
                  >
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAllVisible}
                      aria-label="Select all visible tasks"
                      className="rounded border-border text-accent focus:ring-accent/20"
                    />
                  </th>
                  {idColumn ? (
                    <th
                      className={`${ui.tableHeadCell} pl-6 pr-4 print:text-black ${idColumn.headerClass ?? ""}`}
                    >
                      {idColumn.label}
                    </th>
                  ) : null}
                  {dataColumns.map((col, columnIndex) => (
                    <th
                      key={col.id}
                      className={`${ui.tableHeadCell} print:text-black ${
                        columnIndex === dataColumns.length - 1 ? "pl-4 pr-6" : ""
                      } ${col.headerClass ?? ""}`}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr className="border-b border-slate-200 last:border-b-0">
                    <td colSpan={tableColSpan} className={`${ui.tableCell} py-8 pl-6 pr-6 text-center text-muted`}>
                      Loading tasks…
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
                          className={`${ui.tableCell} w-10 align-top pl-6 pr-2 print:hidden`}
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
                        {idColumn ? (
                          <td
                            className={`${ui.tableCell} align-top pl-6 pr-4 ${idColumn.cellClass ?? ""}`}
                          >
                            {idColumn.getValue(task)}
                          </td>
                        ) : null}
                        {dataColumns.map((col, columnIndex) => (
                          <td
                            key={col.id}
                            className={`${ui.tableCell} ${
                              col.id === "priority" ||
                              col.id === "sb_priority" ||
                              col.id === "sb_owner" ||
                              col.id === "visibility" ||
                              col.id === "links"
                                ? "align-middle"
                                : "align-top"
                            } ${
                              columnIndex === dataColumns.length - 1 ? "pl-4 pr-6" : ""
                            } ${col.cellClass ?? ""}`}
                          >
                            {INLINE_EDIT_IDS.has(col.id) ? (
                              col.wrapContent ? (
                                <div
                                  className={`${ui.tableCellWrap} ${col.innerClass ?? ""}`}
                                >
                                  {renderInlineCell(task, col.id)}
                                </div>
                              ) : (
                                renderInlineCell(task, col.id)
                              )
                            ) : col.id === "sb_priority" ? (
                              (task["SB Priority"] ?? "").trim() ? (
                                <span
                                  className={sbPriorityBadgeClass(task["SB Priority"])}
                                >
                                  {task["SB Priority"]}
                                </span>
                              ) : (
                                "—"
                              )
                            ) : isInternal && col.id === "sb_owner" ? (
                              <SbOwnerPills
                                owners={parseSbOwners(task["SB Owner"])}
                                selectedOwners={filters.sbOwners}
                                onToggle={toggleOwnerFilter}
                                onHoverOwner={handleOwnerHover}
                                onHoverEnd={handleOwnerHoverEnd}
                              />
                            ) : isInternal && col.id === "visibility" ? (
                              <span
                                className={visibilityBadgeClass(task.visibility_scope)}
                              >
                                {visibilityBadgeLabel(task.visibility_scope)}
                              </span>
                            ) : isInternal && col.id === "links" ? (
                              <TaskLinksCell
                                task={task}
                                onManageLinks={openLinkModal}
                              />
                            ) : col.wrapContent ? (
                              <div
                                className={`${ui.tableCellWrap} ${col.innerClass ?? ""}`}
                              >
                                {col.getValue(task)}
                              </div>
                            ) : (
                              col.getValue(task)
                            )}
                          </td>
                        ))}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </AppShell>
    </>
  );
}
