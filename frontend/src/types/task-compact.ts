import type { Task, TaskViewMode } from "@/lib/tasks/types";
import type { TaskRow } from "@/lib/tasks/db-mapper";

/**
 * Compact Task Header DTO for token-efficient summaries and deterministic responses.
 * Excludes long markdown descriptions, nested comment trees, and audit logs.
 */
export type TaskCompactHeader = {
  id: number;
  _uuid?: string;
  title?: string;
  status?: string;
  priority?: string;
  sbStatus?: string;
  sbPriority?: string;
  sbOwner?: string;
  responsible?: string;
  dateDue?: string;
  dateCompleted?: string;
  areaName?: string;
  areaCode?: string;
  project_id?: string;
  parent_task_id?: string;
  is_milestone?: boolean;
  is_critical?: boolean;
  board_label_ids?: string[];
};

export type CompactTaskInput =
  | Partial<Task>
  | Partial<TaskRow>
  | Record<string, unknown>;

export type CompactTaskOptions = {
  mode?: TaskViewMode;
};

const DEFAULT_STATUS_VALUES = new Set(["open", "not started"]);

function cleanString(
  value: unknown,
  defaultValues?: ReadonlySet<string>
): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (defaultValues && defaultValues.has(trimmed.toLowerCase())) {
    return undefined;
  }
  return trimmed;
}

function cleanStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const items = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

/**
 * Projects a full Task or TaskRow into a compact header object,
 * omitting descriptions, comment trees, audit logs, nulls, empty arrays, and defaults.
 */
export function toCompactTaskHeader(
  input: CompactTaskInput,
  options?: CompactTaskOptions
): TaskCompactHeader {
  const rec = input as Record<string, unknown>;
  const isClient = options?.mode === "client";

  const rawId =
    typeof rec.id === "number"
      ? rec.id
      : typeof rec.task_number === "number"
        ? rec.task_number
        : Number(rec.id ?? rec.task_number ?? 0);

  const rawUuid =
    typeof rec._uuid === "string"
      ? rec._uuid
      : typeof rec.id === "string"
        ? rec.id
        : undefined;

  const candidate: Record<string, unknown> = {
    id: rawId,
    _uuid: cleanString(rawUuid),
    title: cleanString(rec.Issue ?? rec.title),
    status: cleanString(rec.status, DEFAULT_STATUS_VALUES),
    priority: isClient
      ? undefined
      : cleanString(rec.Priority ?? rec.priority),
    sbStatus: isClient
      ? undefined
      : cleanString(
          rec["SB Status"] ?? rec.sb_status ?? rec.sbStatus,
          DEFAULT_STATUS_VALUES
        ),
    sbPriority: isClient
      ? undefined
      : cleanString(rec["SB Priority"] ?? rec.sb_priority ?? rec.sbPriority),
    sbOwner: isClient
      ? undefined
      : cleanString(rec["SB Owner"] ?? rec.sb_owner ?? rec.sbOwner),
    responsible: cleanString(rec.Responsible ?? rec.responsible),
    dateDue: cleanString(rec["Date Due"] ?? rec.date_due ?? rec.dateDue)?.slice(
      0,
      10
    ),
    dateCompleted: cleanString(
      rec["Date Completed"] ?? rec.date_completed ?? rec.dateCompleted
    )?.slice(0, 10),
    areaName: cleanString(rec.areaName ?? rec.area_name),
    areaCode: cleanString(rec.areaCode ?? rec.area_code),
    project_id: cleanString(rec.project_id),
    parent_task_id: cleanString(rec.parent_task_id),
    is_milestone: rec.is_milestone === true ? true : undefined,
    is_critical: rec.is_critical === true ? true : undefined,
    board_label_ids: cleanStringArray(rec.board_label_ids),
  };

  const compact: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(candidate)) {
    if (value === undefined || value === null || value === "" || value === false) {
      continue;
    }
    if (Array.isArray(value) && value.length === 0) {
      continue;
    }
    compact[key] = value;
  }

  return compact as TaskCompactHeader;
}

/**
 * Serializes a single task into a compact JSON string.
 */
export function serializeCompactTask(
  input: CompactTaskInput,
  options?: CompactTaskOptions
): string {
  return JSON.stringify(toCompactTaskHeader(input, options));
}

/**
 * Serializes a list of tasks into a compact JSON array string.
 */
export function serializeCompactTaskList(
  inputs: readonly CompactTaskInput[],
  options?: CompactTaskOptions
): string {
  return JSON.stringify(inputs.map((item) => toCompactTaskHeader(item, options)));
}
