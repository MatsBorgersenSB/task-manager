import {
  CLIENT_STATUS_OPTIONS,
  PRIORITY_FILTER_OPTIONS,
  RISK_OPTIONS,
  SB_STATUS_OPTIONS,
} from "@/lib/tasks/constants";
import {
  ACTION_COMMENT_FIELD,
  createFormFieldDef,
  getTableColumns,
  type FormFieldDef,
  type TableColumnDef,
} from "@/lib/tasks/labels";
import type { TaskViewMode } from "@/lib/tasks/types";

export function selectOptionsForField(
  fieldName: string
): readonly string[] | undefined {
  switch (fieldName) {
    case "status":
      return CLIENT_STATUS_OPTIONS;
    case "Priority":
      return PRIORITY_FILTER_OPTIONS;
    case "SB Status":
      return SB_STATUS_OPTIONS;
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
  return options ? { ...def, options } : def;
}

export function panelColumnsByGroup(mode: TaskViewMode): {
  client: TableColumnDef[];
  internal: TableColumnDef[];
} {
  const editable = getTableColumns(mode).filter((col) => col.fieldName);
  return {
    client: editable.filter((col) => col.group === "client"),
    internal: editable.filter((col) => col.group === "sb"),
  };
}

export {
  CLIENT_STATUS_OPTIONS,
  PRIORITY_FILTER_OPTIONS,
  RISK_OPTIONS,
  SB_STATUS_OPTIONS,
};
