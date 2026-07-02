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

/** Always shown in General (after core fields), in this order. */
export const PROMINENT_CLIENT_PANEL_FIELDS = [
  "CE Comments",
  ACTION_COMMENT_FIELD,
] as const;

/** Shown in General immediately after client comments (internal mode). */
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
  // Panel always includes optional table fields (e.g. Action Comment).
  const editable = getTableColumns(mode, { showOptionalColumns: true }).filter(
    (col) => col.fieldName
  );
  return {
    client: editable.filter((col) => col.group === "client"),
    internal: editable.filter((col) => col.group === "sb"),
  };
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
