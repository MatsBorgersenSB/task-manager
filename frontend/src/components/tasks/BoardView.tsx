"use client";

import { useMemo, useState } from "react";
import {
  boardGroupByOptions,
  buildBoardBuckets,
  persistBoardGroupBy,
  persistBoardSubtaskMode,
  readBoardGroupBy,
  readBoardSubtaskMode,
  resolveBoardTasksForSubtaskMode,
  type BoardGroupBy,
  type BoardSubtaskDisplayMode,
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
  getDescendantTasks,
  getParentTask,
  getSubtaskProgressForTask,
  isSubtaskComplete,
  subtaskProgressLabel,
  taskDisplayId,
} from "@/lib/tasks/subtasks";
import { getTaskDueStatus } from "@/lib/tasks/taskDates";
import {
  formatBlockedBySummary,
  getEffectiveBlockingPredecessors,
} from "@/lib/tasks/dependencies";
import { normalizeDateInput, parseSbOwners } from "@/lib/tasks/utils";
import type { Task, TaskViewMode } from "@/lib/tasks/types";
import type { TaskDependency } from "@/lib/templates/types";
import { ui } from "@/lib/ui/classes";

export type { BoardSubtaskDisplayMode } from "@/lib/tasks/boardBuckets";

type BoardViewProps = {
  tasks: Task[];
  allTasks: Task[];
  dependencies?: TaskDependency[];
  mode: TaskViewMode;
  isProjectShared?: boolean;
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
  onToggleSubtaskComplete?: (subtask: Task) => Promise<void>;
  onCreateSubtask?: (parentTask: Task) => Promise<void>;
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
  dependencies,
  labels,
  canEdit,
  subtaskMode,
  isSubtaskExpanded,
  onToggleExpandSubtasks,
  onSelect,
  onSelectSubtask,
  onToggleSubtaskComplete,
  onCreateSubtask,
  onDragStart,
  onToggleLabel,
}: {
  task: Task;
  allTasks: Task[];
  dependencies: TaskDependency[];
  labels: ProjectBoardLabel[];
  canEdit: boolean;
  subtaskMode: BoardSubtaskDisplayMode;
  isSubtaskExpanded: boolean;
  onToggleExpandSubtasks: () => void;
  onSelect: () => void;
  onSelectSubtask: (subtask: Task) => void;
  onToggleSubtaskComplete?: (subtask: Task) => Promise<void>;
  onCreateSubtask?: (parentTask: Task) => Promise<void>;
  onDragStart: (event: React.DragEvent, task: Task) => void;
  onToggleLabel?: (labelId: string) => void;
}) {
  const displayId = taskDisplayId(task, allTasks);
  const title = (task.Issue ?? "").trim() || `Task #${displayId}`;
  const comment = (task["CE Comments"] ?? "").trim();
  const progress = getSubtaskProgressForTask(task._uuid, allTasks);
  const descendants = useMemo(
    () => (progress ? getDescendantTasks(allTasks, task._uuid) : []),
    [allTasks, progress, task._uuid]
  );
  const parentTask = useMemo(
    () => (task.parent_task_id ? getParentTask(allTasks, task) : undefined),
    [allTasks, task]
  );
  const blockers = useMemo(
    () => getEffectiveBlockingPredecessors(task, allTasks, dependencies),
    [allTasks, dependencies, task]
  );
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
  const progressPct =
    progress && progress.total > 0
      ? Math.round((progress.completed / progress.total) * 100)
      : 0;

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

      {/* Top identity bar: #ID + Area + Parent Breadcrumb when in separate card mode */}
      <div className="mb-1 flex flex-wrap items-center justify-between gap-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-primary/80">
            #{displayId}
          </span>
          {parentTask ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onSelectSubtask(parentTask);
              }}
              className="truncate rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent hover:bg-accent/20"
              title={`Subtask of #${taskDisplayId(parentTask, allTasks)}: ${parentTask.Issue ?? ""}`}
            >
              ↳ #{taskDisplayId(parentTask, allTasks)}
            </button>
          ) : null}
        </div>
        {area ? (
          <span className="rounded border border-border/60 bg-slate-50 px-1.5 py-0.2 text-[10px] font-semibold uppercase tracking-wide text-muted">
            {area}
          </span>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onSelect}
        className="w-full text-left focus:outline-none"
      >
        <p className="text-sm font-semibold text-primary">{title}</p>
        {comment ? (
          <p className="mt-1 line-clamp-2 text-xs text-muted">{comment}</p>
        ) : null}
      </button>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {blockers.length > 0 ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onSelectSubtask(blockers[0].predecessor);
              }}
              className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900 hover:bg-amber-100"
              title="Cannot start until predecessor is completed — click to open"
            >
              <span aria-hidden>🔒</span>
              <span>{formatBlockedBySummary(blockers, allTasks)}</span>
            </button>
          ) : null}

          {dateLabel ? (
            <span
              className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${dateChipClass(dueStatus)}`}
            >
              <span aria-hidden>📅</span>
              {dateLabel}
            </span>
          ) : null}

          {progress && subtaskMode !== "hidden" ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onToggleExpandSubtasks();
              }}
              aria-expanded={isSubtaskExpanded}
              title={
                isSubtaskExpanded
                  ? "Collapse subtasks checklist"
                  : "Expand subtasks checklist on card"
              }
              className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold transition ${
                isSubtaskExpanded
                  ? "bg-accent text-white shadow-sm"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              <span aria-hidden>{isSubtaskExpanded ? "▼" : "▶"}</span>
              <span>✓ {subtaskProgressLabel(progress)}</span>
            </button>
          ) : null}
        </div>

        {people.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1">
            {people.slice(0, 3).map((person) => (
              <span
                key={person}
                title={person}
                className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-200 px-1 text-[10px] font-semibold text-slate-700"
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

      {/* Inline Expandable Subtask Checklist Drawer */}
      {isSubtaskExpanded && descendants.length > 0 && subtaskMode !== "hidden" ? (
        <div className="mt-2.5 space-y-1.5 rounded-md border border-border/70 bg-slate-50/90 p-2">
          <div className="space-y-1 pb-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                Subtasks ({progress?.completed ?? 0}/{progress?.total ?? descendants.length})
              </span>
              {canEdit && onCreateSubtask ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    void onCreateSubtask(task);
                  }}
                  className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-accent hover:bg-accent/10"
                >
                  + Subtask
                </button>
              ) : null}
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {descendants.map((sub) => {
            const subDone = isSubtaskComplete(sub);
            const subId = taskDisplayId(sub, allTasks);
            const subTitle = (sub.Issue ?? "").trim() || `Subtask #${subId}`;
            const subStatus = (sub["SB Status"] ?? sub.status ?? "").trim();

            return (
              <div
                key={sub._uuid}
                className="flex items-start gap-1.5 rounded px-1.5 py-1 text-xs transition hover:bg-white"
              >
                {canEdit && onToggleSubtaskComplete ? (
                  <input
                    type="checkbox"
                    checked={subDone}
                    onChange={(event) => {
                      event.stopPropagation();
                      void onToggleSubtaskComplete(sub);
                    }}
                    aria-label={`Mark ${subTitle} complete`}
                    className="mt-0.5 rounded border-border text-accent focus:ring-accent/20"
                  />
                ) : (
                  <span
                    aria-hidden
                    className={`mt-0.5 text-[11px] font-bold ${
                      subDone ? "text-emerald-600" : "text-muted"
                    }`}
                  >
                    {subDone ? "✓" : "○"}
                  </span>
                )}
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelectSubtask(sub);
                  }}
                  className="flex min-w-0 flex-1 items-baseline justify-between gap-1.5 text-left"
                >
                  <span
                    className={`truncate font-medium ${
                      subDone ? "line-through text-muted" : "text-primary hover:text-accent"
                    }`}
                  >
                    <span className="mr-1 font-mono text-[10px] text-muted">
                      #{subId}
                    </span>
                    {subTitle}
                  </span>
                  {subStatus ? (
                    <span className="shrink-0 rounded bg-slate-200/75 px-1 py-px text-[9px] font-medium text-slate-700">
                      {subStatus}
                    </span>
                  ) : null}
                </button>
              </div>
            );
          })}
        </div>
      ) : null}

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
  dependencies = [],
  mode,
  isProjectShared = true,
  canEdit = false,
  buckets,
  labels,
  onSelectTask,
  onMoveTask,
  onQuickAdd,
  onCreateBucket,
  onToggleTaskLabel,
  onToggleSubtaskComplete,
  onCreateSubtask,
}: BoardViewProps) {
  const [groupBy, setGroupBy] = useState<BoardGroupBy>(() => {
    const saved = readBoardGroupBy(mode);
    if (saved === "custom" && buckets.length === 0) {
      return mode === "internal" ? "sb_status" : "status";
    }
    return saved;
  });
  const [subtaskMode, setSubtaskMode] = useState<BoardSubtaskDisplayMode>(() =>
    readBoardSubtaskMode(mode)
  );
  const [expandedCardIds, setExpandedCardIds] = useState<Set<string>>(
    () => new Set()
  );
  const [memberFilter, setMemberFilter] = useState<string[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropBucketId, setDropBucketId] = useState<string | null>(null);
  const [addingBucketId, setAddingBucketId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [newBucketName, setNewBucketName] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const groupOptions = useMemo(
    () =>
      boardGroupByOptions(
        mode,
        buckets.length > 0 || Boolean(onCreateBucket),
        { isProjectShared }
      ),
    [mode, buckets.length, onCreateBucket, isProjectShared]
  );

  const boardSourceTasks = useMemo(
    () => resolveBoardTasksForSubtaskMode(tasks, allTasks, subtaskMode),
    [tasks, allTasks, subtaskMode]
  );

  const members = useMemo(
    () => collectBoardMembers(boardSourceTasks),
    [boardSourceTasks]
  );

  const filteredTasks = useMemo(
    () =>
      boardSourceTasks.filter((task) =>
        taskMatchesMemberFilter(task, memberFilter)
      ),
    [boardSourceTasks, memberFilter]
  );

  const boardBuckets = useMemo(
    () => buildBoardBuckets(filteredTasks, groupBy, buckets),
    [filteredTasks, groupBy, buckets]
  );

  const parentCardsWithSubtasksIds = useMemo(
    () =>
      filteredTasks
        .filter((t) => Boolean(getSubtaskProgressForTask(t._uuid, allTasks)))
        .map((t) => t._uuid),
    [filteredTasks, allTasks]
  );

  const allSubtasksExpanded =
    parentCardsWithSubtasksIds.length > 0 &&
    parentCardsWithSubtasksIds.every((id) => expandedCardIds.has(id));

  function toggleCardSubtasks(taskUuid: string) {
    setExpandedCardIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskUuid)) {
        next.delete(taskUuid);
      } else {
        next.add(taskUuid);
      }
      return next;
    });
  }

  function toggleExpandAllSubtasks() {
    if (allSubtasksExpanded) {
      setExpandedCardIds(new Set());
    } else {
      setExpandedCardIds(new Set(parentCardsWithSubtasksIds));
    }
  }

  function changeGroupBy(next: BoardGroupBy) {
    setGroupBy(next);
    persistBoardGroupBy(mode, next);
  }

  function changeSubtaskMode(next: BoardSubtaskDisplayMode) {
    setSubtaskMode(next);
    persistBoardSubtaskMode(mode, next);
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
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-2.5 sm:px-5">
        <div>
          <p className="text-sm font-semibold text-primary">Board</p>
          <p className="text-xs text-muted">
            Drag cards · expand subtasks inline or view as separate cards
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-primary/80">
            <span className="font-semibold">Subtasks</span>
            <select
              value={subtaskMode}
              onChange={(event) =>
                changeSubtaskMode(
                  event.target.value as BoardSubtaskDisplayMode
                )
              }
              className={ui.filterToolbarSelectSm}
              aria-label="Board subtask display mode"
            >
              <option value="nested">Nested in parent card</option>
              <option value="separate">Separate board cards</option>
              <option value="hidden">Hidden</option>
            </select>
          </label>

          {subtaskMode !== "hidden" && parentCardsWithSubtasksIds.length > 0 ? (
            <button
              type="button"
              onClick={toggleExpandAllSubtasks}
              className={ui.btnUtilitySm}
            >
              {allSubtasksExpanded
                ? "Collapse all subtasks"
                : "Expand all subtasks"}
            </button>
          ) : null}

          <label className="flex items-center gap-1.5 text-xs text-primary/80">
            <span className="font-semibold">Group by</span>
            <select
              value={groupBy}
              onChange={(event) =>
                changeGroupBy(event.target.value as BoardGroupBy)
              }
              className={ui.filterToolbarSelectSm}
              aria-label="Board group by"
            >
              {groupOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          {canEdit && onCreateBucket && groupBy !== "custom" ? (
            <button
              type="button"
              onClick={() => changeGroupBy("custom")}
              className="text-[11px] font-medium text-accent hover:underline"
              title="Switch to custom Bucket view to create or reorder custom columns"
            >
              Switch to Bucket view to add columns
            </button>
          ) : null}
        </div>
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
                      dependencies={dependencies}
                      labels={labels}
                      canEdit={canEdit}
                      subtaskMode={subtaskMode}
                      isSubtaskExpanded={expandedCardIds.has(task._uuid)}
                      onToggleExpandSubtasks={() =>
                        toggleCardSubtasks(task._uuid)
                      }
                      onSelect={() => onSelectTask(task)}
                      onSelectSubtask={(sub) => onSelectTask(sub)}
                      onToggleSubtaskComplete={onToggleSubtaskComplete}
                      onCreateSubtask={onCreateSubtask}
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
