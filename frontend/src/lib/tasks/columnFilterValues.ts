import type { TableColumnDef } from "@/lib/tasks/labels";
import type { Task } from "@/lib/tasks/types";
import {
  type ColumnFilterContext,
  columnSearchText,
  NO_FILTER_COLUMN_IDS,
} from "@/lib/tasks/columnFilters";

/** Display token for empty cells in filter menus. */
export const BLANK_FILTER_VALUE = "(Blank)";

export function getColumnFilterValue(
  task: Task,
  column: TableColumnDef,
  context?: Pick<ColumnFilterContext, "subtaskSearchText">
): string {
  if (column.id === "id") return String(task.id);

  const raw = column.getValue(task);
  const text = typeof raw === "string" ? raw.trim() : String(raw ?? "").trim();

  if (!text || text === "—") {
    if (column.id === "links" || column.id === "subtasks") {
      const search = columnSearchText(task, column, context).trim();
      return search || BLANK_FILTER_VALUE;
    }
    return BLANK_FILTER_VALUE;
  }

  return text;
}

export function getUniqueColumnFilterValues(
  tasks: Task[],
  column: TableColumnDef,
  context?: ColumnFilterContext
): string[] {
  const values = new Set<string>();
  for (const task of tasks) {
    values.add(getColumnFilterValue(task, column, context));
  }
  return [...values].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
  );
}

export function columnSupportsHeaderFilter(columnId: string): boolean {
  return !NO_FILTER_COLUMN_IDS.has(columnId);
}

export function isColumnFilterActive(
  columnMultiFilters: Record<string, string[]>,
  columnId: string
): boolean {
  const selected = columnMultiFilters[columnId];
  return Boolean(selected && selected.length > 0);
}

export function matchesColumnMultiFilters(
  task: Task,
  columnMultiFilters: Record<string, string[]>,
  context?: ColumnFilterContext
): boolean {
  if (!context?.columns.length) return true;

  for (const column of context.columns) {
    const selected = columnMultiFilters[column.id];
    if (!selected?.length) continue;

    const cellValue = getColumnFilterValue(task, column, context);
    if (!selected.includes(cellValue)) return false;
  }

  return true;
}
