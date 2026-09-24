"use client";

import { useMemo, useState } from "react";
import {
  boardGroupByOptions,
  buildBoardBuckets,
  persistBoardGroupBy,
  readBoardGroupBy,
  type BoardGroupBy,
} from "@/lib/tasks/boardBuckets";
import { formatAreaCodeOnly } from "@/lib/tasks/areas";
import {
  getSubtaskProgressForTask,
  subtaskProgressLabel,
} from "@/lib/tasks/subtasks";
import { getTaskDueStatus } from "@/lib/tasks/taskDates";
import { normalizeDateInput, parseSbOwners } from "@/lib/tasks/utils";
import type { Task, TaskViewMode } from "@/lib/tasks/types";
import { ui } from "@/lib/ui/classes";

type BoardViewProps = {
  tasks: Task[];
  allTasks: Task[];
  mode: TaskViewMode;
  canEdit?: boolean;
  onSelectTask: (task: Task) => void;
  onMoveTask: (
    task: Task,
    groupBy: BoardGroupBy,
    bucketId: string
  ) => void | Promise<void>;
  onQuickAdd: (title: string, bucketId: string, groupBy: BoardGroupBy) => Promise<void>;
};

function formatCardDate(value: string | null | undefined): string | null {
  const iso = normalizeDateInput(value);
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map((part) => Number.parseInt(part, 10));
  if ([y, m, d].some((part) => Number.isNaN(part))) return null;
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

function priorityDotClass(priority: string | null | undefined): string {
  switch ((priority ?? "").trim().toLowerCase()) {
    case "critical":
    case "urgent":
      return "bg-red-500";
    case "high":
      return "bg-orange-500";
    case "medium":
      return "bg-amber-400";
    case "low":
      return "bg-emerald-500";
    default:
      return "bg-slate-300";
  }
}

function dateChipClass(status: ReturnType<typeof getTaskDueStatus>): string {
  switch (status) {
    case "overdue":
      return "bg-red-100 text-red-800";
    case "soon":
      return "bg-amber-100 text-amber-900";
    case "completed":
      return "bg-emerald-100 text-emerald-800";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function BoardCard({
  task,
  allTasks,
  canEdit,
  onSelect,
  onDragStart,
}: {
  task: Task;
  allTasks: Task[];
  canEdit: boolean;
  onSelect: () => void;
  onDragStart: (event: React.DragEvent, task: Task) => void;
}) {
  const title = (task.Issue ?? "").trim() || `Task #${task.id}`;
  const comment = (task["CE Comments"] ?? "").trim();
  const progress = getSubtaskProgressForTask(task._uuid, allTasks);
  const dueStatus = getTaskDueStatus(task);
  const fromLabel = formatCardDate(
    task["Intervention Date"] ?? task.intervention_date
  );
  const toLabel = formatCardDate(task["Date Due"]);
  const dateLabel =
    fromLabel && toLabel
      ? `${fromLabel} – ${toLabel}`
      : toLabel
        ? toLabel
        : fromLabel;
  const area = formatAreaCodeOnly(task.areaCode);
  const owners = parseSbOwners(task["SB Owner"]);
  const responsible = (task.Responsible ?? "").trim();
  const people = owners.length > 0 ? owners : responsible ? [responsible] : [];

  return (
    <button
      type="button"
      draggable={canEdit}
      onDragStart={(event) => onDragStart(event, task)}
      onClick={onSelect}
      className="w-full rounded-lg border border-border/80 bg-white p-3 text-left shadow-sm transition hover:border-accent/40 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-accent/25"
    >
      <div className="flex items-start gap-2">
        <span
          className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${priorityDotClass(task.Priority ?? task["SB Priority"])}`}
          title={task.Priority || task["SB Priority"] || "No priority"}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-primary">{title}</p>
          {comment ? (
            <p className="mt-1 line-clamp-2 text-xs text-muted">{comment}</p>
          ) : null}
          {area ? (
            <p className="mt-1.5 text-[10px] font-medium uppercase tracking-wide text-muted">
              {area}
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {dateLabel ? (
              <span
                className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${dateChipClass(dueStatus)}`}
              >
                <span aria-hidden>📅</span>
                {dateLabel}
              </span>
            ) : null}
            {progress ? (
              <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700">
                <span aria-hidden>✓</span>
                {subtaskProgressLabel(progress)}
              </span>
            ) : null}
          </div>
          {people.length > 0 ? (
            <div className="mt-2 flex flex-wrap items-center gap-1">
              {people.slice(0, 3).map((person) => (
                <span
                  key={person}
                  title={person}
                  className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-200 px-1 text-[10px] font-semibold text-slate-700"
                >
                  {initials(person)}
                </span>
              ))}
              {people.length > 3 ? (
                <span className="text-[10px] text-muted">+{people.length - 3}</span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </button>
  );
}

export default function BoardView({
  tasks,
  allTasks,
  mode,
  canEdit = false,
  onSelectTask,
  onMoveTask,
  onQuickAdd,
}: BoardViewProps) {
  const [groupBy, setGroupBy] = useState<BoardGroupBy>(() =>
    readBoardGroupBy(mode)
  );
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropBucketId, setDropBucketId] = useState<string | null>(null);
  const [addingBucketId, setAddingBucketId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const groupOptions = useMemo(() => boardGroupByOptions(mode), [mode]);
  const buckets = useMemo(
    () => buildBoardBuckets(tasks, groupBy),
    [tasks, groupBy]
  );

  function changeGroupBy(next: BoardGroupBy) {
    setGroupBy(next);
    persistBoardGroupBy(mode, next);
  }

  function handleDragStart(event: React.DragEvent, task: Task) {
    if (!canEdit) return;
    event.dataTransfer.setData("text/task-uuid", task._uuid);
    event.dataTransfer.effectAllowed = "move";
    setDraggingId(task._uuid);
    setError(null);
  }

  async function handleDrop(bucketId: string) {
    if (!canEdit || !draggingId) return;
    const task = allTasks.find((row) => row._uuid === draggingId);
    setDraggingId(null);
    setDropBucketId(null);
    if (!task) return;
    try {
      await onMoveTask(task, groupBy, bucketId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not move task.");
    }
  }

  async function submitQuickAdd(bucketId: string) {
    const title = draftTitle.trim();
    if (!title || adding) return;
    setAdding(true);
    setError(null);
    try {
      await onQuickAdd(title, bucketId, groupBy);
      setDraftTitle("");
      setAddingBucketId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create task.");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="flex h-full min-h-[28rem] flex-col print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-3 sm:px-5">
        <div>
          <p className="text-sm font-semibold text-primary">Board</p>
          <p className="text-xs text-muted">
            Drag cards between buckets · click a card to open details
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-primary/80">
          <span className="font-medium">Group by</span>
          <select
            value={groupBy}
            onChange={(event) =>
              changeGroupBy(event.target.value as BoardGroupBy)
            }
            className={ui.filterToolbarSelect}
            aria-label="Board group by"
          >
            {groupOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? (
        <p className="px-4 pt-2 text-xs text-red-600 sm:px-5">{error}</p>
      ) : null}

      <div className="flex-1 overflow-x-auto overflow-y-hidden px-3 py-3 sm:px-4">
        <div className="flex h-full min-h-[24rem] items-stretch gap-3">
          {buckets.map((bucket) => {
            const isDropTarget = dropBucketId === bucket.id;
            return (
              <section
                key={bucket.id}
                className={`flex w-72 shrink-0 flex-col rounded-xl border bg-slate-50/90 ${
                  isDropTarget
                    ? "border-accent ring-2 ring-accent/20"
                    : "border-border/70"
                }`}
                onDragOver={(event) => {
                  if (!canEdit || !draggingId) return;
                  event.preventDefault();
                  setDropBucketId(bucket.id);
                }}
                onDragLeave={() => {
                  setDropBucketId((prev) =>
                    prev === bucket.id ? null : prev
                  );
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  void handleDrop(bucket.id);
                }}
              >
                <header className="flex items-center justify-between gap-2 border-b border-border/50 px-3 py-2.5">
                  <h3 className="truncate text-sm font-semibold text-primary">
                    {bucket.label}
                  </h3>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-muted shadow-sm">
                    {bucket.tasks.length}
                  </span>
                </header>

                <div className="flex-1 space-y-2 overflow-y-auto px-2 py-2">
                  {bucket.tasks.map((task) => (
                    <BoardCard
                      key={task._uuid}
                      task={task}
                      allTasks={allTasks}
                      canEdit={canEdit}
                      onSelect={() => onSelectTask(task)}
                      onDragStart={handleDragStart}
                    />
                  ))}
                  {bucket.tasks.length === 0 ? (
                    <p className="px-1 py-6 text-center text-xs text-muted">
                      {canEdit ? "Drop tasks here" : "No tasks"}
                    </p>
                  ) : null}
                </div>

                {canEdit ? (
                  <div className="border-t border-border/50 p-2">
                    {addingBucketId === bucket.id ? (
                      <form
                        className="space-y-2"
                        onSubmit={(event) => {
                          event.preventDefault();
                          void submitQuickAdd(bucket.id);
                        }}
                      >
                        <input
                          autoFocus
                          value={draftTitle}
                          onChange={(event) => setDraftTitle(event.target.value)}
                          placeholder="Task title"
                          className={ui.input}
                          disabled={adding}
                        />
                        <div className="flex gap-2">
                          <button
                            type="submit"
                            disabled={adding || !draftTitle.trim()}
                            className={ui.btnPrimarySm}
                          >
                            {adding ? "Adding…" : "Add"}
                          </button>
                          <button
                            type="button"
                            className={ui.btnUtilitySm}
                            disabled={adding}
                            onClick={() => {
                              setAddingBucketId(null);
                              setDraftTitle("");
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <button
                        type="button"
                        className={`${ui.btnGhost} w-full justify-start text-xs`}
                        onClick={() => {
                          setAddingBucketId(bucket.id);
                          setDraftTitle("");
                        }}
                      >
                        + Add a task
                      </button>
                    )}
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
