import {
  CLIENT_STATUS_OPTIONS,
  PRIORITY_FILTER_OPTIONS,
  RISK_OPTIONS,
  SB_PRIORITY_OPTIONS,
  SB_STATUS_OPTIONS,
  VISIBILITY_OPTION_LABELS,
  VISIBILITY_SCOPE_VALUES,
} from "@/lib/tasks/constants";
import {
  ACTION_COMMENT_FIELD,
  createFormFieldDef,
  getTableColumns,
  type FormFieldDef,
  type TableColumnDef,
} from "@/lib/tasks/labels";
import type { TaskViewMode } from "@/lib/tasks/types";

/** Schedule block owns these; do not repeat them elsewhere in the panel. */
export const SCHEDULE_PANEL_FIELDS = new Set([
  "Date Due",
  "Intervention Date",
]);

/** User-friendly panel field sequence (identity → time → status → notes). */
export const PANEL_TASK_FIELDS = ["Issue", "Area"] as const;

export const PANEL_SCHEDULE_EXTRA_FIELDS = [
  "Intervention Duration",
  "Date Completed",
] as const;

export const PANEL_STATUS_FIELDS = [
  "status",
  "Priority",
  "Responsible",
  "SB Status",
  "SB Priority",
  "SB Owner",
] as const;

export const PANEL_NOTES_FIELDS = [
  "CE Comments",
  ACTION_COMMENT_FIELD,
  "Risk",
  "Risk Comment",
  "SB Note",
  "Response or Action taken by SB",
] as const;

/** @deprecated Prefer PANEL_* ordered lists. */
export const PROMINENT_CLIENT_PANEL_FIELDS = [
  "CE Comments",
  ACTION_COMMENT_FIELD,
] as const;

/** @deprecated Prefer PANEL_* ordered lists. */
export const PROMINENT_INTERNAL_PANEL_FIELDS = [
  "Risk",
  "Risk Comment",
  "SB Note",
] as const;

export function selectOptionsForField(
  fieldName: string
): readonly string[] | undefined {
  switch (fieldName) {
    case "status":
      return CLIENT_STATUS_OPTIONS;
    case "Priority":
      return PRIORITY_FILTER_OPTIONS;
    case "Visibility":
      return VISIBILITY_SCOPE_VALUES;
    case "SB Status":
      return SB_STATUS_OPTIONS;
    case "SB Priority":
      return SB_PRIORITY_OPTIONS;
    case "Risk":
      return RISK_OPTIONS;
    default:
      return undefined;
  }
}

export function panelFieldDef(
  column: TableColumnDef,
  mode: TaskViewMode
): FormFieldDef | null {
  if (!column.fieldName) return null;

  const section = column.group === "sb" ? "sb" : "client";
  const def = createFormFieldDef(column.fieldName, mode, section, {
    readOnly: mode === "client" && column.fieldName === ACTION_COMMENT_FIELD,
  });
  const options = selectOptionsForField(column.fieldName);
  if (options) {
    const optionLabels =
      column.fieldName === "Visibility" ? VISIBILITY_OPTION_LABELS : undefined;
    return { ...def, options, optionLabels };
  }
  return def;
}

export function panelColumnsByGroup(mode: TaskViewMode): {
  client: TableColumnDef[];
  internal: TableColumnDef[];
} {
  const editable = getTableColumns(mode, {
    showOptionalColumns: true,
    showClientColumns: true,
  }).filter((col) => col.fieldName);
  return {
    client: editable.filter((col) => col.group === "client"),
    internal: editable.filter((col) => col.group === "sb"),
  };
}

/** Pick columns in an explicit display order (skips missing fields). */
export function orderPanelColumns(
  columns: TableColumnDef[],
  order: readonly string[]
): TableColumnDef[] {
  const byName = new Map<string, TableColumnDef>();
  for (const column of columns) {
    if (column.fieldName) byName.set(column.fieldName, column);
  }
  const ordered: TableColumnDef[] = [];
  for (const name of order) {
    const column = byName.get(name);
    if (column) ordered.push(column);
  }
  return ordered;
}

export function buildPanelFieldSections(
  mode: TaskViewMode,
  allColumns: TableColumnDef[]
): {
  task: TableColumnDef[];
  scheduleExtra: TableColumnDef[];
  status: TableColumnDef[];
  notes: TableColumnDef[];
  other: TableColumnDef[];
} {
  const usable = allColumns.filter(
    (column) =>
      column.fieldName &&
      column.fieldName !== "Visibility" &&
      !SCHEDULE_PANEL_FIELDS.has(column.fieldName)
  );

  const task = orderPanelColumns(usable, PANEL_TASK_FIELDS);
  const scheduleExtra = orderPanelColumns(usable, PANEL_SCHEDULE_EXTRA_FIELDS);
  const status = orderPanelColumns(usable, PANEL_STATUS_FIELDS);
  const notes = orderPanelColumns(usable, PANEL_NOTES_FIELDS);

  const claimed = new Set(
    [...task, ...scheduleExtra, ...status, ...notes]
      .map((column) => column.fieldName)
      .filter(Boolean) as string[]
  );

  const other = usable.filter(
    (column) => column.fieldName && !claimed.has(column.fieldName)
  );

  // Client mode: keep only fields that exist for client views.
  if (mode === "client") {
    return {
      task,
      scheduleExtra: scheduleExtra.filter((c) => c.group === "client"),
      status: status.filter((c) => c.group === "client"),
      notes: notes.filter((c) => c.group === "client"),
      other: other.filter((c) => c.group === "client"),
    };
  }

  return { task, scheduleExtra, status, notes, other };
}

/** Always shown in the internal task panel (not part of hideable client fields). */
export const CORE_PANEL_FIELD_NAMES = new Set(["Area", "Issue"]);

export function splitClientPanelColumns(columns: TableColumnDef[]): {
  core: TableColumnDef[];
  clientFacing: TableColumnDef[];
} {
  const core: TableColumnDef[] = [];
  const clientFacing: TableColumnDef[] = [];
  for (const column of columns) {
    if (column.fieldName && CORE_PANEL_FIELD_NAMES.has(column.fieldName)) {
      core.push(column);
    } else {
      clientFacing.push(column);
    }
  }
  return { core, clientFacing };
}

/** Core + comment fields in General; remaining client fields in Client information. */
export function partitionClientPanelColumns(columns: TableColumnDef[]): {
  core: TableColumnDef[];
  generalProminent: TableColumnDef[];
  clientInfo: TableColumnDef[];
} {
  const { core, clientFacing } = splitClientPanelColumns(columns);
  const prominentSet = new Set<string>(PROMINENT_CLIENT_PANEL_FIELDS);
  const generalProminent: TableColumnDef[] = [];

  for (const fieldName of PROMINENT_CLIENT_PANEL_FIELDS) {
    const column = clientFacing.find((col) => col.fieldName === fieldName);
    if (column) generalProminent.push(column);
  }

  const clientInfo = clientFacing.filter(
    (column) => !column.fieldName || !prominentSet.has(column.fieldName)
  );

  return { core, generalProminent, clientInfo };
}

export function prominentInternalPanelColumns(
  internalColumns: TableColumnDef[]
): TableColumnDef[] {
  const prominent: TableColumnDef[] = [];
  for (const fieldName of PROMINENT_INTERNAL_PANEL_FIELDS) {
    const column = internalColumns.find((col) => col.fieldName === fieldName);
    if (column) prominent.push(column);
  }
  return prominent;
}

export function remainingInternalPanelColumns(
  internalColumns: TableColumnDef[]
): TableColumnDef[] {
  const prominentSet = new Set<string>(PROMINENT_INTERNAL_PANEL_FIELDS);
  return internalColumns.filter(
    (column) =>
      column.fieldName !== "Visibility" &&
      (!column.fieldName || !prominentSet.has(column.fieldName))
  );
}

export {
  CLIENT_STATUS_OPTIONS,
  PRIORITY_FILTER_OPTIONS,
  RISK_OPTIONS,
  SB_PRIORITY_OPTIONS,
  SB_STATUS_OPTIONS,
};
