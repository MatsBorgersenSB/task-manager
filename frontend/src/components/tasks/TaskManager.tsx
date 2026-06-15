"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import TaskExportToolbar from "@/components/tasks/TaskExportToolbar";
import TaskPanel from "@/components/tasks/TaskPanel";
import {
  PRIORITY_FILTER_OPTIONS,
  SB_PRIORITY_OPTIONS,
  SB_STATUS_OPTIONS,
} from "@/lib/tasks/constants";
import {
  fetchAppUsers,
  fetchTasks,
} from "@/lib/tasks/api";
import type { AppUser, Task, TaskFilters, TaskViewMode } from "@/lib/tasks/types";
import {
  filterAndSortTasks,
  priorityBadgeClass,
  sbPriorityBadgeClass,
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
  priority: "",
  status: "",
  sbStatus: "",
  sbPriority: "",
  due: "",
  sort: "id",
};

const labelClass = ui.label;
const selectClass = ui.input;

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
  const [users, setUsers] = useState<AppUser[]>([]);
  const [filters, setFilters] = useState<TaskFilters>(EMPTY_FILTERS);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [panelTask, setPanelTask] = useState<Task | null | undefined>(undefined);

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

  const statusOptions = useMemo(() => uniqueStatuses(allTasks), [allTasks]);

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

  function updateFilter<K extends keyof TaskFilters>(key: K, value: TaskFilters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
  }

  return (
    <>
      {panelTask !== undefined ? (
        <TaskPanel
          task={panelTask}
          mode={mode}
          users={users}
          onClose={closePanel}
          onUpdated={handlePanelUpdated}
          onCreated={handlePanelCreated}
          onDeleted={handlePanelDeleted}
        />
      ) : null}

      <AppShell
        fullWidth
        pageTitle={title}
        pageDescription={subtitle}
        userEmail={userEmail}
        userRole={userRole}
        headerActions={
          <Link href={backHref} className={ui.btnHeader}>
            Back to dashboard
          </Link>
        }
      >
        {loadError ? (
          <div className={`no-print ${ui.alertError}`}>{loadError}</div>
        ) : null}

        <div className="no-print">
          <button
            type="button"
            onClick={openNewPanel}
            className={ui.btnPrimary}
          >
            + New Task
          </button>
        </div>

        {/* Filters */}
        <section className={`no-print ${ui.cardSection}`}>
          <h2 className={ui.sectionTitle}>Filter &amp; sort</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {isInternal ? (
              <label className={labelClass}>
                {fieldLabel("Priority")}
                <select
                  value={filters.priority}
                  onChange={(e) => updateFilter("priority", e.target.value)}
                  className={selectClass}
                >
                  <option value="">All priorities</option>
                  {PRIORITY_FILTER_OPTIONS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className={labelClass}>
              {filterStatusLabel()}
              <select
                value={filters.status}
                onChange={(e) => updateFilter("status", e.target.value)}
                className={selectClass}
              >
                <option value="">All client statuses</option>
                {statusOptions.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
            {isInternal ? (
              <label className={labelClass}>
                {fieldLabel("SB Status")}
                <select
                  value={filters.sbStatus}
                  onChange={(e) => updateFilter("sbStatus", e.target.value)}
                  className={selectClass}
                >
                  <option value="">All SB statuses</option>
                  {SB_STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>
            ) : null}
            {isInternal ? (
              <label className={labelClass}>
                {fieldLabel("SB Priority")}
                <select
                  value={filters.sbPriority}
                  onChange={(e) => updateFilter("sbPriority", e.target.value)}
                  className={selectClass}
                >
                  <option value="">All SB priorities</option>
                  {SB_PRIORITY_OPTIONS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className={labelClass}>
              Due date
              <select
                value={filters.due}
                onChange={(e) => updateFilter("due", e.target.value)}
                className={selectClass}
              >
                <option value="">All due dates</option>
                <option value="overdue">Overdue</option>
                <option value="has">Has due date</option>
                <option value="none">No due date</option>
              </select>
            </label>
            <label className={labelClass}>
              Sort by
              <select
                value={filters.sort}
                onChange={(e) => updateFilter("sort", e.target.value)}
                className={selectClass}
              >
                <option value="id">ID (default)</option>
                <option value="due-asc">Due date (earliest)</option>
                <option value="due-desc">Due date (latest)</option>
                {isInternal ? <option value="priority">{fieldLabel("Priority")}</option> : null}
                <option value="status">{fieldLabel("status")}</option>
                {isInternal ? (
                  <option value="sb-status">{fieldLabel("SB Status")}</option>
                ) : null}
              </select>
            </label>
            <div className="flex items-end">
              <button
                type="button"
                onClick={clearFilters}
                className={ui.btnSecondary}
              >
                Clear filters
              </button>
            </div>
          </div>
          <p className="mt-2 text-sm text-muted">
            {loading
              ? "Loading…"
              : `Showing ${visibleTasks.length} of ${allTasks.length} tasks`}
          </p>
        </section>

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

          <div className={ui.tableScroll}>
            <table className={ui.table}>
              <thead className={`${ui.tableHead} print:bg-white`}>
                <tr>
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
                    <td colSpan={colSpan} className={`${ui.tableCell} py-8 pl-6 pr-6 text-center text-muted`}>
                      Loading tasks…
                    </td>
                  </tr>
                ) : visibleTasks.length === 0 ? (
                  <tr className="border-b border-slate-200 last:border-b-0">
                    <td colSpan={colSpan} className={`${ui.tableCell} py-8 pl-6 pr-6 text-center text-muted`}>
                      {allTasks.length === 0
                        ? "No tasks yet. Add one above."
                        : "No tasks match the current filters."}
                    </td>
                  </tr>
                ) : (
                  visibleTasks.map((task) => {
                    const selected =
                      panelTask != null && panelTask.id === task.id;
                    return (
                      <tr
                        key={task.id}
                        onClick={() => openPanel(task)}
                        className={selected ? ui.tableRowSelected : ui.tableRow}
                      >
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
                              col.id === "priority" || col.id === "sb_priority"
                                ? "align-middle"
                                : "align-top"
                            } ${
                              columnIndex === dataColumns.length - 1 ? "pl-4 pr-6" : ""
                            } ${col.cellClass ?? ""}`}
                          >
                            {col.id === "priority" ? (
                              (task.Priority ?? "").trim() ? (
                                <span className={priorityBadgeClass(task.Priority)}>
                                  {task.Priority}
                                </span>
                              ) : (
                                "—"
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
