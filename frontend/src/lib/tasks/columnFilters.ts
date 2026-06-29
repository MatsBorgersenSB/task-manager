import type { TableColumnDef } from "@/lib/tasks/labels";
import type { Task } from "@/lib/tasks/types";

/** Columns filtered via dedicated TaskFilters fields (dropdowns), not columnFilters text. */
export const STRUCTURED_FILTER_COLUMN_IDS = new Set([
  "area",
  "status",
  "priority",
  "date_due",
  "sb_status",
  "sb_priority",
  "visibility",
  "sb_owner",
  "risk",
]);

export type ColumnFilterContext = {
  columns: TableColumnDef[];
  subtaskSearchText?: (task: Task) => string;
};

export function columnSearchText(
  task: Task,
  column: TableColumnDef,
  context?: Pick<ColumnFilterContext, "subtaskSearchText">
): string {
  if (column.id === "links") {
    return (task.links ?? [])
      .map((link) => `${link.name} ${link.url}`.trim())
      .filter(Boolean)
      .join(" ");
  }

  if (column.id === "subtasks") {
    return context?.subtaskSearchText?.(task) ?? "";
  }

  const value = column.getValue(task);
  if (value === "—") return "";
  return value;
}

export function matchesColumnTextFilters(
  task: Task,
  columnFilters: Record<string, string>,
  context?: ColumnFilterContext
): boolean {
  if (!context?.columns.length) return true;

  for (const column of context.columns) {
    if (STRUCTURED_FILTER_COLUMN_IDS.has(column.id)) continue;

    const filterText = (columnFilters[column.id] ?? "").trim().toLowerCase();
    if (!filterText) continue;

    const cellText = columnSearchText(task, column, context).toLowerCase();
    if (!cellText.includes(filterText)) return false;
  }

  return true;
}
