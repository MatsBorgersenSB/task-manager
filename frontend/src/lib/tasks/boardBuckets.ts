import {
  CLIENT_STATUS_OPTIONS,
  PRIORITY_FILTER_OPTIONS,
  SB_STATUS_OPTIONS,
} from "@/lib/tasks/constants";
import { formatAreaCodeOnly } from "@/lib/tasks/areas";
import type { ProjectBucket } from "@/lib/tasks/boardMeta";
import type { Task, TaskViewMode } from "@/lib/tasks/types";

export type BoardGroupBy =
  | "custom"
  | "sb_status"
  | "status"
  | "area"
  | "priority"
  | "responsible";

export type BoardBucket = {
  id: string;
  label: string;
  tasks: Task[];
  custom?: boolean;
};

const UNASSIGNED_ID = "__unassigned__";

export function defaultBoardGroupBy(mode: TaskViewMode): BoardGroupBy {
  return mode === "internal" ? "custom" : "status";
}

export function boardGroupByOptions(
  mode: TaskViewMode,
  hasCustomBuckets: boolean
): { id: BoardGroupBy; label: string }[] {
  const customOption = hasCustomBuckets
    ? [{ id: "custom" as const, label: "Buckets" }]
    : [];

  if (mode === "client") {
    return [
      ...customOption,
      { id: "status", label: "Progress" },
      { id: "area", label: "Area" },
      { id: "priority", label: "Priority" },
      { id: "responsible", label: "Assigned to" },
    ];
  }
  return [
    ...customOption,
    { id: "sb_status", label: "SB Status" },
    { id: "status", label: "Client status" },
    { id: "area", label: "Area" },
    { id: "priority", label: "Priority" },
    { id: "responsible", label: "Assigned to" },
  ];
}

function normalizeBucketValue(value: string | null | undefined): string {
  return (value ?? "").trim();
}

export function taskBoardBucketId(
  task: Task,
  groupBy: BoardGroupBy
): string {
  switch (groupBy) {
    case "custom":
      return task.bucket_id?.trim() || UNASSIGNED_ID;
    case "sb_status": {
      const value = normalizeBucketValue(task["SB Status"]);
      return value || UNASSIGNED_ID;
    }
    case "status": {
      const value = normalizeBucketValue(task.status);
      return value || UNASSIGNED_ID;
    }
    case "area": {
      const code = formatAreaCodeOnly(task.areaCode);
      if (code) return `area:${code}`;
      const name = normalizeBucketValue(task.areaName);
      return name ? `area:${name}` : UNASSIGNED_ID;
    }
    case "priority": {
      const value = normalizeBucketValue(task.Priority);
      return value || UNASSIGNED_ID;
    }
    case "responsible": {
      const value = normalizeBucketValue(task.Responsible);
      return value || UNASSIGNED_ID;
    }
    default:
      return UNASSIGNED_ID;
  }
}

function labelForBucketId(groupBy: BoardGroupBy, id: string): string {
  if (id === UNASSIGNED_ID) return "Unassigned";
  if (groupBy === "area" && id.startsWith("area:")) {
    return id.slice("area:".length);
  }
  return id;
}

function fixedBucketOrder(groupBy: BoardGroupBy): string[] {
  switch (groupBy) {
    case "sb_status":
      return [...SB_STATUS_OPTIONS, UNASSIGNED_ID];
    case "status":
      return [...CLIENT_STATUS_OPTIONS, UNASSIGNED_ID];
    case "priority":
      return [...PRIORITY_FILTER_OPTIONS, UNASSIGNED_ID];
    default:
      return [];
  }
}

/** Payload fields to apply when dropping a card into a bucket. */
export function boardMovePayload(
  groupBy: BoardGroupBy,
  bucketId: string
): Record<string, string | null> {
  const value = bucketId === UNASSIGNED_ID ? "" : bucketId;
  switch (groupBy) {
    case "custom":
      return { bucket_id: bucketId === UNASSIGNED_ID ? null : bucketId };
    case "sb_status":
      return { "SB Status": value };
    case "status":
      return { status: value };
    case "priority":
      return { Priority: value };
    case "responsible":
      return { Responsible: value };
    case "area": {
      if (bucketId === UNASSIGNED_ID) {
        return { areaCode: "", areaName: "" };
      }
      const label = labelForBucketId("area", bucketId);
      return { areaCode: label, areaName: label };
    }
    default:
      return {};
  }
}

export function buildBoardBuckets(
  tasks: Task[],
  groupBy: BoardGroupBy,
  customBuckets: ProjectBucket[] = []
): BoardBucket[] {
  const mainTasks = tasks.filter((task) => !task.parent_task_id);
  const byId = new Map<string, Task[]>();

  for (const task of mainTasks) {
    const id = taskBoardBucketId(task, groupBy);
    const list = byId.get(id) ?? [];
    list.push(task);
    byId.set(id, list);
  }

  if (groupBy === "custom") {
    const buckets: BoardBucket[] = customBuckets.map((bucket) => ({
      id: bucket.id,
      label: bucket.name,
      custom: true,
      tasks: (byId.get(bucket.id) ?? []).sort((a, b) => a.id - b.id),
    }));
    const unassigned = byId.get(UNASSIGNED_ID) ?? [];
    buckets.push({
      id: UNASSIGNED_ID,
      label: "Unassigned",
      custom: true,
      tasks: unassigned.sort((a, b) => a.id - b.id),
    });
    return buckets;
  }

  const order = fixedBucketOrder(groupBy);
  const buckets: BoardBucket[] = [];
  const seen = new Set<string>();

  for (const id of order) {
    seen.add(id);
    buckets.push({
      id,
      label: labelForBucketId(groupBy, id),
      tasks: (byId.get(id) ?? []).sort((a, b) => a.id - b.id),
    });
  }

  const extras = [...byId.keys()]
    .filter((id) => !seen.has(id))
    .sort((a, b) =>
      labelForBucketId(groupBy, a).localeCompare(labelForBucketId(groupBy, b))
    );

  for (const id of extras) {
    buckets.push({
      id,
      label: labelForBucketId(groupBy, id),
      tasks: (byId.get(id) ?? []).sort((a, b) => a.id - b.id),
    });
  }

  if (buckets.length === 0) {
    buckets.push({ id: UNASSIGNED_ID, label: "Unassigned", tasks: [] });
  }

  return buckets;
}

const BOARD_GROUP_STORAGE_KEY = "task-board-group-by";

export function readBoardGroupBy(mode: TaskViewMode): BoardGroupBy {
  if (typeof window === "undefined") return defaultBoardGroupBy(mode);
  try {
    const raw = window.localStorage.getItem(`${BOARD_GROUP_STORAGE_KEY}:${mode}`);
    const allowed: BoardGroupBy[] = [
      "custom",
      "sb_status",
      "status",
      "area",
      "priority",
      "responsible",
    ];
    if (raw && (allowed as string[]).includes(raw)) {
      return raw as BoardGroupBy;
    }
  } catch {
    /* ignore */
  }
  return defaultBoardGroupBy(mode);
}

export function persistBoardGroupBy(mode: TaskViewMode, groupBy: BoardGroupBy): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${BOARD_GROUP_STORAGE_KEY}:${mode}`, groupBy);
  } catch {
    /* ignore */
  }
}

export { UNASSIGNED_ID as BOARD_UNASSIGNED_ID };
