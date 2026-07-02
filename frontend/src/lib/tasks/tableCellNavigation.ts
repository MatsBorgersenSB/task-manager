import type { TableColumnDef } from "@/lib/tasks/labels";
import type { Task } from "@/lib/tasks/types";

export type TableCellAddress = {
  taskUuid: string;
  columnId: string;
};

export const TABLE_INLINE_EDITABLE_COLUMN_IDS = new Set([
  "issue",
  "sb_status",
  "priority",
  "date_due",
]);

export function isTableCellEditable(
  columnId: string,
  canEditTasks: boolean
): boolean {
  return canEditTasks && TABLE_INLINE_EDITABLE_COLUMN_IDS.has(columnId);
}

export function tableCellKey(address: TableCellAddress): string {
  return `${address.taskUuid}:${address.columnId}`;
}

export function addressesEqual(
  a: TableCellAddress | null | undefined,
  b: TableCellAddress | null | undefined
): boolean {
  if (!a || !b) return false;
  return a.taskUuid === b.taskUuid && a.columnId === b.columnId;
}

type MoveDirection = "up" | "down" | "left" | "right" | "tab" | "shift-tab";

export function moveTableCellSelection(
  current: TableCellAddress,
  tasks: Task[],
  columns: TableColumnDef[],
  direction: MoveDirection
): TableCellAddress | null {
  if (tasks.length === 0 || columns.length === 0) return null;

  const rowIndex = tasks.findIndex((task) => task._uuid === current.taskUuid);
  const colIndex = columns.findIndex((column) => column.id === current.columnId);
  if (rowIndex < 0 || colIndex < 0) return null;

  let nextRow = rowIndex;
  let nextCol = colIndex;

  switch (direction) {
    case "up":
      nextRow = Math.max(0, rowIndex - 1);
      break;
    case "down":
      nextRow = Math.min(tasks.length - 1, rowIndex + 1);
      break;
    case "left":
      nextCol = Math.max(0, colIndex - 1);
      break;
    case "right":
      nextCol = Math.min(columns.length - 1, colIndex + 1);
      break;
    case "tab": {
      if (colIndex < columns.length - 1) {
        nextCol = colIndex + 1;
      } else if (rowIndex < tasks.length - 1) {
        nextRow = rowIndex + 1;
        nextCol = 0;
      } else {
        return current;
      }
      break;
    }
    case "shift-tab": {
      if (colIndex > 0) {
        nextCol = colIndex - 1;
      } else if (rowIndex > 0) {
        nextRow = rowIndex - 1;
        nextCol = columns.length - 1;
      } else {
        return current;
      }
      break;
    }
  }

  return {
    taskUuid: tasks[nextRow]._uuid,
    columnId: columns[nextCol].id,
  };
}
