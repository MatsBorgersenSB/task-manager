"use client";

import { useMemo, useState } from "react";
import {
  boardGroupByOptions,
  buildBoardBuckets,
  persistBoardGroupBy,
  readBoardGroupBy,
  type BoardGroupBy,
} from "@/lib/tasks/boardBuckets";
import {
  boardLabelBarClass,
  boardLabelChipClass,
  collectBoardMembers,
  taskLabelIds,
  taskMatchesMemberFilter,
  type ProjectBoardLabel,
  type ProjectBucket,
} from "@/lib/tasks/boardMeta";
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
  buckets: ProjectBucket[];
  labels: ProjectBoardLabel[];
  onSelectTask: (task: Task) => void;
  onMoveTask: (
    task: Task,
    groupBy: BoardGroupBy,
    bucketId: string
  ) => void | Promise<void>;
  onQuickAdd: (
    title: string,
    bucketId: string,
    groupBy: BoardGroupBy
  ) => Promise<void>;
  onCreateBucket?: (name: string) => Promise<void>;
  onToggleTaskLabel?: (task: Task, labelId: string) => Promise<void>;
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
  labels,
  canEdit,
  onSelect,
  onDragStart,
  onToggleLabel,
}: {
  task: Task;
  allTasks: Task[];
  labels: ProjectBoardLabel[];
  canEdit: boolean;
  onSelect: () => void;
  onDragStart: (event: React.DragEvent, task: Task) => void;
  onToggleLabel?: (labelId: string) => void;
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
      : toLabel || fromLabel;
  const area = formatAreaCodeOnly(task.areaCode);
  const owners = parseSbOwners(task["SB Owner"]);
  const responsible = (task.Responsible ?? "").trim();
  const people = owners.length > 0 ? owners : responsible ? [responsible] : [];
  const activeLabelIds = new Set(taskLabelIds(task));
  const activeLabels = labels.filter((label) => activeLabelIds.has(label.id));

  return (
    <div
      draggable={canEdit}
      onDragStart={(event) => onDragStart(event, task)}
      className="rounded-lg border border-border/80 bg-white p-3 shadow-sm transition hover:border-accent/40 hover:shadow-md"
    >
      {activeLabels.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-1">
          {activeLabels.map((label) => (
            <span
              key={label.id}
              className={`h-1.5 w-6 rounded-full ${boardLabelBarClass(label.color)}`}
              title={label.name}
            />
          ))}
        </div>
      ) : null}

      <button
        type="button"
        onClick={onSelect}
        className="w-full text-left focus:outline-none"
      >
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
      </button>

      {canEdit && labels.length > 0 && onToggleLabel ? (
        <div className="mt-2 flex flex-wrap gap-1 border-t border-border/50 pt-2">
          {labels.map((label) => {
            const active = activeLabelIds.has(label.id);
            return (
              <button
                key={label.id}
                type="button"
                title={active ? `Remove ${label.name}` : `Add ${label.name}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleLabel(label.id);
                }}
                className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition ${
                  active
                    ? boardLabelChipClass(label.color)
                    : "bg-white text-muted ring-1 ring-border/70 hover:bg-slate-50"
                }`}
              >
                {label.name}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export default function BoardView({
  tasks,
  allTasks,
  mode,
  canEdit = false,
  buckets,
  labels,
  onSelectTask,
  onMoveTask,
  onQuickAdd,
  onCreateBucket,
  onToggleTaskLabel,
}: BoardViewProps) {
  const [groupBy, setGroupBy] = useState<BoardGroupBy>(() => {
    const saved = readBoardGroupBy(mode);
    if (saved === "custom" && buckets.length === 0) {
      return mode === "internal" ? "sb_status" : "status";
    }
    return saved;
  });
  const [memberFilter, setMemberFilter] = useState<string[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropBucketId, setDropBucketId] = useState<string | null>(null);
  const [addingBucketId, setAddingBucketId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [newBucketName, setNewBucketName] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const groupOptions = useMemo(
    () => boardGroupByOptions(mode, buckets.length > 0 || Boolean(onCreateBucket)),
    [mode, buckets.length, onCreateBucket]
  );

  const members = useMemo(() => collectBoardMembers(tasks), [tasks]);

  const filteredTasks = useMemo(
    () => tasks.filter((task) => taskMatchesMemberFilter(task, memberFilter)),
    [tasks, memberFilter]
  );

  const boardBuckets = useMemo(
    () => buildBoardBuckets(filteredTasks, groupBy, buckets),
    [filteredTasks, groupBy, buckets]
  );

  function changeGroupBy(next: BoardGroupBy) {
    setGroupBy(next);
    persistBoardGroupBy(mode, next);
  }

  function toggleMember(name: string) {
    setMemberFilter((prev) =>
      prev.includes(name)
        ? prev.filter((item) => item !== name)
        : [...prev, name]
    );
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

  async function submitNewBucket() {
    if (!onCreateBucket || !newBucketName.trim() || adding) return;
    setAdding(true);
    setError(null);
    try {
      await onCreateBucket(newBucketName.trim());
      setNewBucketName("");
      changeGroupBy("custom");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create bucket.");
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
            Drag cards · filter by member · tag with labels
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

      {members.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-border/50 px-4 py-2 sm:px-5">
          <span className="mr-1 text-xs font-medium text-muted">Members</span>
          <button
            type="button"
            onClick={() => setMemberFilter([])}
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              memberFilter.length === 0
                ? "bg-accent/15 text-accent"
                : "bg-slate-100 text-muted hover:bg-slate-200"
            }`}
          >
            All
          </button>
          {members.map((member) => {
            const active = memberFilter.includes(member);
            return (
              <button
                key={member}
                type="button"
                onClick={() => toggleMember(member)}
                className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium ${
                  active
                    ? "bg-accent/15 text-accent"
                    : "bg-slate-100 text-primary/80 hover:bg-slate-200"
                }`}
              >
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-semibold shadow-sm">
                  {initials(member)}
                </span>
                {member}
              </button>
            );
          })}
        </div>
      ) : null}

      {error ? (
        <p className="px-4 pt-2 text-xs text-red-600 sm:px-5">{error}</p>
      ) : null}

      <div className="flex-1 overflow-x-auto overflow-y-hidden px-3 py-3 sm:px-4">
        <div className="flex h-full min-h-[24rem] items-stretch gap-3">
          {boardBuckets.map((bucket) => {
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
                      labels={labels}
                      canEdit={canEdit}
                      onSelect={() => onSelectTask(task)}
                      onDragStart={handleDragStart}
                      onToggleLabel={
                        onToggleTaskLabel
                          ? (labelId) => void onToggleTaskLabel(task, labelId)
                          : undefined
                      }
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

          {canEdit && onCreateBucket && groupBy === "custom" ? (
            <section className="flex w-64 shrink-0 flex-col rounded-xl border border-dashed border-border/80 bg-white/60 p-3">
              <p className="text-sm font-semibold text-primary">New bucket</p>
              <form
                className="mt-3 space-y-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submitNewBucket();
                }}
              >
                <input
                  value={newBucketName}
                  onChange={(event) => setNewBucketName(event.target.value)}
                  placeholder="Bucket name"
                  className={ui.input}
                  disabled={adding}
                />
                <button
                  type="submit"
                  disabled={adding || !newBucketName.trim()}
                  className={ui.btnSecondarySm}
                >
                  Add bucket
                </button>
              </form>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
