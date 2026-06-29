import { CLIENT_WRITABLE_FIELDS } from "@/lib/tasks/labels";
import { parseTaskLinks } from "@/lib/tasks/taskLinks";
import { normalizeVisibilityScope } from "@/lib/tasks/visibility";
import type { Task, TaskLink, TaskPayload, TaskViewMode } from "@/lib/tasks/types";

/** Row shape returned by Supabase `tasks` table. */
export type TaskRow = {
  id: string;
  task_number: number;
  project_id: string | null;
  title: string;
  description: string | null;
  status: string | null;
  priority: string | null;
  assigned_to: string | null;
  responsible: string | null;
  created_by: string | null;
  created_at: string;
  updated_by: string | null;
  updated_at: string | null;
  registration_date: string | null;
  risk: string | null;
  risk_comment: string | null;
  date_due: string | null;
  intervention_date: string | null;
  intervention_hours: number | null;
  date_completed: string | null;
  sb_status: string | null;
  sb_priority: string | null;
  sb_owner: string | null;
  sb_note: string | null;
  response_sb: string | null;
  area_name: string | null;
  area_code: string | null;
  visibility_scope: string | null;
  parent_task_id: string | null;
  links?: unknown;
  creator?: { email: string; role: string } | null;
};

const UI_TO_COLUMN: Record<string, keyof TaskRow> = {
  Issue: "title",
  "CE Comments": "description",
  status: "status",
  Priority: "priority",
  Responsible: "responsible",
  "Registration Date": "registration_date",
  Risk: "risk",
  "Risk Comment": "risk_comment",
  "Date Due": "date_due",
  "Intervention Date": "intervention_date",
  "Date Completed": "date_completed",
  "SB Status": "sb_status",
  "SB Priority": "sb_priority",
  "SB Owner": "sb_owner",
  "SB Note": "sb_note",
  "Response or Action taken by SB": "response_sb",
  areaName: "area_name",
  areaCode: "area_code",
};

/** Columns added in migrations 031–032; may be absent on older databases. */
export const INTERVENTION_TASK_COLUMNS = [
  "intervention_date",
  "intervention_hours",
] as const satisfies readonly (keyof TaskRow)[];

/** Fields hidden from client task views (table still uses CLIENT_VISIBLE_FIELDS). */
const CLIENT_HIDDEN_FROM_VIEW = new Set([
  "Risk",
  "Risk Comment",
  "SB Status",
  "SB Priority",
  "SB Owner",
  "SB Note",
  "Registration Date",
  "Visibility",
]);

function emptyToNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function formatDate(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.slice(0, 10);
}

export function rowToTask(row: TaskRow, mode: TaskViewMode): Task {
  const task: Task = {
    id: row.task_number,
    _uuid: row.id,
    Issue: row.title,
    "Registration Date": formatDate(row.registration_date),
    status: row.status,
    Priority: row.priority,
    Responsible: row.responsible,
    "CE Comments": row.description,
    "Response or Action taken by SB": row.response_sb,
    "SB Note": row.sb_note,
    "Date Due": formatDate(row.date_due),
    "Intervention Date": formatDate(row.intervention_date),
    intervention_date: formatDate(row.intervention_date),
    intervention_hours: row.intervention_hours,
    "Date Completed": formatDate(row.date_completed),
    "SB Status": row.sb_status,
    "SB Priority": row.sb_priority,
    Risk: row.risk,
    "Risk Comment": row.risk_comment,
    "SB Owner": row.sb_owner,
    areaName: row.area_name,
    areaCode: row.area_code,
    visibility_scope: normalizeVisibilityScope(row.visibility_scope),
    parent_task_id: row.parent_task_id ?? null,
    project_id: row.project_id ?? null,
    _createdByRole: row.creator?.role ?? null,
    _createdByEmail: row.creator?.email ?? null,
    _createdAt: row.created_at,
    _updatedAt: row.updated_at,
    _updatedBy: row.updated_by,
  };

  if (mode === "internal") {
    task.links = parseTaskLinks(row.links);
  }

  if (mode === "client") {
    for (const key of CLIENT_HIDDEN_FROM_VIEW) {
      delete task[key as keyof Task];
    }
    delete task.visibility_scope;
  }

  return task;
}

export function payloadToRow(
  payload: TaskPayload,
  mode: TaskViewMode
): Partial<TaskRow> {
  const row: Partial<TaskRow> = {};

  for (const [uiKey, column] of Object.entries(UI_TO_COLUMN)) {
    if (!(uiKey in payload)) continue;
    if (mode === "client" && !CLIENT_WRITABLE_FIELDS.has(uiKey)) continue;

    const raw = payload[uiKey as keyof TaskPayload];
    if (typeof raw !== "string") continue;

    (row as Record<string, string | null>)[column] = emptyToNull(raw);
  }

  if (mode !== "client") {
    row.visibility_scope = normalizeVisibilityScope(payload.visibility_scope);
  }

  if (mode === "internal" && payload.links !== undefined) {
    row.links = payload.links as TaskLink[];
  }

  if (payload.intervention_hours !== undefined && payload.intervention_hours !== null) {
    row.intervention_hours = payload.intervention_hours;
  }

  if ("parent_task_id" in payload) {
    row.parent_task_id = payload.parent_task_id ?? null;
  }

  if ("project_id" in payload && payload.project_id) {
    row.project_id = payload.project_id;
  }

  return row;
}

export function stripInterventionFieldsFromRow<T extends Partial<TaskRow>>(
  row: T
): T {
  const next = { ...row };
  for (const key of INTERVENTION_TASK_COLUMNS) {
    delete next[key];
  }
  return next;
}

export function isMissingInterventionColumnError(
  error: { message?: string; code?: string } | null
): boolean {
  const message = (error?.message ?? "").toLowerCase();
  return (
    message.includes("intervention_date") ||
    message.includes("intervention_hours") ||
    (message.includes("could not find") && message.includes("intervention"))
  );
}

export function supabaseErrorMessage(
  error: { message?: string } | null
): string {
  return error?.message ?? "Request failed";
}
