"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AppShell from "@/components/AppShell";
import ConfirmDialog from "@/components/ConfirmDialog";
import TaskExportToolbar from "@/components/tasks/TaskExportToolbar";
import TaskFormFields, {
  FieldSectionHeader,
} from "@/components/tasks/TaskFormFields";
import {
  CLIENT_ADD_FIELDS,
  CLIENT_EDIT_FIELDS,
  INTERNAL_ADD_FIELDS,
  INTERNAL_EDIT_FIELDS,
  PRIORITY_FILTER_OPTIONS,
  SB_STATUS_OPTIONS,
} from "@/lib/tasks/constants";
import {
  createTask,
  deleteTaskApi,
  fetchAppUsers,
  fetchTasks,
  updateTask,
} from "@/lib/tasks/api";
import type { AppUser, Task, TaskFilters, TaskViewMode } from "@/lib/tasks/types";
import {
  buildPayloadFromForm,
  fillFormFromTask,
  filterAndSortTasks,
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
  due: "",
  sort: "id",
};

const inputClass = ui.input;
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
  const editFields = isInternal ? INTERNAL_EDIT_FIELDS : CLIENT_EDIT_FIELDS;
  const addFields = isInternal ? INTERNAL_ADD_FIELDS : CLIENT_ADD_FIELDS;

  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [filters, setFilters] = useState<TaskFilters>(EMPTY_FILTERS);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [addMessage, setAddMessage] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [addSaving, setAddSaving] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editMessage, setEditMessage] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);

  const addFormRef = useRef<HTMLFormElement>(null);
  const editFormRef = useRef<HTMLFormElement>(null);
  const editSectionRef = useRef<HTMLElement>(null);

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

  const editingTask =
    editIndex !== null ? visibleTasks[editIndex] ?? null : null;

  function openEdit(taskId: number) {
    const index = visibleTasks.findIndex((t) => t.id === taskId);
    if (index < 0) return;
    setEditIndex(index);
    setEditMessage(null);
    setEditError(null);
    requestAnimationFrame(() => {
      editSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  useEffect(() => {
    if (editIndex === null || !editFormRef.current || !editingTask) return;
    fillFormFromTask(editFormRef.current, editingTask, editFields);
  }, [editIndex, editingTask, editFields]);

  async function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault();
    const form = addFormRef.current;
    if (!form) return;

    const issue = String(new FormData(form).get("Issue") ?? "").trim();
    if (!issue) {
      setAddError(`${fieldLabel("Issue")} is required.`);
      return;
    }

    setAddSaving(true);
    setAddError(null);
    setAddMessage(null);

    try {
      const payload = {
        Issue: issue,
        ...buildPayloadFromForm(form, addFields),
      };
      await createTask(mode, payload);
      form.reset();
      setAddMessage("Task added.");
      await loadTasks();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to add issue.");
    } finally {
      setAddSaving(false);
    }
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editingTask || !editFormRef.current) return;

    setEditSaving(true);
    setEditError(null);
    setEditMessage(null);

    try {
      const payload = buildPayloadFromForm(editFormRef.current, editFields);
      await updateTask(mode, editingTask._uuid, payload);
      setEditMessage("Changes saved.");
      await loadTasks();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setEditSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteSaving(true);
    try {
      await deleteTaskApi(mode, deleteTarget._uuid);
      if (editingTask?.id === deleteTarget.id) {
        setEditIndex(null);
      }
      setDeleteTarget(null);
      await loadTasks();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to delete.");
      setDeleteTarget(null);
    } finally {
      setDeleteSaving(false);
    }
  }

  function updateFilter<K extends keyof TaskFilters>(key: K, value: TaskFilters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
  }

  return (
    <>
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete task?"
        description={
          deleteTarget
            ? `Delete task #${deleteTarget.id}: "${deleteTarget.Issue ?? ""}"?`
            : ""
        }
        confirmLabel="Delete"
        variant="danger"
        loading={deleteSaving}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <AppShell
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

        {/* Add issue */}
        <section className={`no-print ${ui.cardSection}`}>
          <h2 className={ui.sectionTitle}>Add task</h2>
          <form ref={addFormRef} onSubmit={handleAddSubmit} className="mt-4 grid gap-4 sm:grid-cols-2">
            <FieldSectionHeader title="Client fields" first />
            <label className={`${labelClass} sm:col-span-2`}>
              {fieldLabel("Issue")} <span className="text-red-500">*</span>
              <input
                name="Issue"
                required
                className={inputClass}
                placeholder="Describe the task"
              />
            </label>
            <TaskFormFields
              mode={mode}
              users={users}
              omitIssue
              suppressClientHeader
            />

            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={addSaving}
                className={`${ui.btnPrimary} px-5 disabled:opacity-50`}
              >
                {addSaving ? "Saving…" : "Add task"}
              </button>
              {addMessage ? <p className="mt-2 text-sm text-accent-dark">{addMessage}</p> : null}
              {addError ? <p className="mt-2 text-sm text-red-600">{addError}</p> : null}
            </div>
          </form>
        </section>

        {/* Edit panel */}
        {editIndex !== null && editingTask ? (
          <section
            ref={editSectionRef}
            className="no-print rounded-lg border border-accent/30 bg-accent/5 p-6 shadow-card"
          >
            <h2 className={ui.sectionTitle}>
              Edit task #{editingTask.id}
            </h2>
            <form ref={editFormRef} onSubmit={handleEditSave} className="mt-4 grid gap-4 sm:grid-cols-2">
              <TaskFormFields mode={mode} users={users} />
              <div className="flex flex-wrap gap-3 sm:col-span-2">
                <button
                  type="button"
                  disabled={editIndex <= 0}
                  onClick={() => setEditIndex((i) => Math.max(0, (i ?? 0) - 1))}
                  className={ui.btnSecondary}
                >
                  Backward
                </button>
                <button
                  type="button"
                  disabled={editIndex >= visibleTasks.length - 1}
                  onClick={() =>
                    setEditIndex((i) =>
                      Math.min(visibleTasks.length - 1, (i ?? 0) + 1)
                    )
                  }
                  className={ui.btnSecondary}
                >
                  Forward
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className={`${ui.btnPrimary} disabled:opacity-50`}
                >
                  {editSaving ? "Saving…" : "Save record"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditIndex(null)}
                  className={ui.btnSecondary}
                >
                  Cancel
                </button>
              </div>
              {editMessage ? <p className="sm:col-span-2 text-sm text-accent-dark">{editMessage}</p> : null}
              {editError ? <p className="sm:col-span-2 text-sm text-red-600">{editError}</p> : null}
            </form>
          </section>
        ) : null}

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

          <div className="overflow-x-auto">
            <table className={ui.table}>
              <thead className={`${ui.tableHead} print:bg-white`}>
                <tr>
                  {idColumn ? (
                    <th
                      className={`${ui.tableHeadCell} print:text-black ${idColumn.headerClass ?? ""}`}
                    >
                      {idColumn.label}
                    </th>
                  ) : null}
                  <th className={`no-print ${ui.tableHeadCell}`}>Actions</th>
                  {dataColumns.map((col) => (
                    <th
                      key={col.id}
                      className={`${ui.tableHeadCell} print:text-black ${col.headerClass ?? ""}`}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={colSpan} className="px-4 py-8 text-center text-muted">
                      Loading tasks…
                    </td>
                  </tr>
                ) : visibleTasks.length === 0 ? (
                  <tr>
                    <td colSpan={colSpan} className="px-4 py-8 text-center text-muted">
                      {allTasks.length === 0
                        ? "No tasks yet. Add one above."
                        : "No tasks match the current filters."}
                    </td>
                  </tr>
                ) : (
                  visibleTasks.map((task) => {
                    const selected = editingTask?.id === task.id;
                    return (
                      <tr
                        key={task.id}
                        className={selected ? ui.tableRowSelected : ui.tableRow}
                      >
                        {idColumn ? (
                          <td
                            className={`${ui.tableCell} whitespace-nowrap ${idColumn.cellClass ?? ""}`}
                          >
                            {idColumn.getValue(task)}
                          </td>
                        ) : null}
                        <td className={`no-print ${ui.tableCell} whitespace-nowrap`}>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => openEdit(task.id)}
                              className={`${ui.btnPrimary} px-2.5 py-1.5 text-xs`}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(task)}
                              className={ui.btnDanger}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                        {dataColumns.map((col) => (
                          <td
                            key={col.id}
                            className={`${ui.tableCell} ${col.cellClass ?? "whitespace-nowrap"}`}
                          >
                            {col.getValue(task)}
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
