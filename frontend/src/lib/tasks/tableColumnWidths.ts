import type { TableColumnDef } from "@/lib/tasks/labels";
import type { Task } from "@/lib/tasks/types";
import { NO_FILTER_COLUMN_IDS } from "@/lib/tasks/columnFilters";

const TABLE_FONT = "600 10px Inter, system-ui, sans-serif";
const CELL_FONT = "400 12px Inter, system-ui, sans-serif";

const CHECKBOX_COLUMN_WIDTH = 40;
const CELL_HORIZONTAL_PADDING = 20;
const HEADER_EXTRA = 30;

/** Priority text columns absorb leftover horizontal space. */
const FLEXIBLE_TEXT_FIELDS = new Set([
  "Issue",
  "CE Comments",
  "SB Note",
  "Risk Comment",
  "Response or Action taken by SB",
]);

const MIN_WIDTH_BY_FIELD: Record<string, number> = {
  Issue: 140,
  "CE Comments": 120,
  "SB Note": 120,
  "Risk Comment": 120,
  "Response or Action taken by SB": 120,
  Area: 48,
  status: 72,
  Responsible: 72,
  "Date Due": 92,
  "Intervention Date": 92,
  "Date Completed": 92,
  "Registration Date": 92,
  "Intervention Duration": 96,
  "SB Status": 88,
  "SB Priority": 80,
  Visibility: 88,
  Risk: 48,
  Priority: 72,
  "SB Owner": 80,
};

const MIN_WIDTH_BY_ID: Record<string, number> = {
  id: 40,
  subtasks: 56,
  links: 72,
};

const MAX_WIDTH_BY_FIELD: Record<string, number> = {
  Issue: 640,
  "CE Comments": 720,
  "SB Note": 560,
  "Risk Comment": 560,
  "Response or Action taken by SB": 640,
};

const MAX_WIDTH_BY_ID: Record<string, number> = {
  links: 200,
};

const DEFAULT_MIN_WIDTH = 56;
const DEFAULT_MAX_WIDTH = 360;
const MEASURE_SAMPLE_SIZE = 50;

let measureCanvas: HTMLCanvasElement | null = null;

function measureText(text: string, font: string): number {
  const value = text.trim() || "—";
  if (typeof document === "undefined") {
    return value.length * 7;
  }

  measureCanvas ??= document.createElement("canvas");
  const context = measureCanvas.getContext("2d");
  if (!context) return value.length * 7;

  context.font = font;
  return context.measureText(value).width;
}

function clampWidth(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function isFlexibleTextColumn(column: TableColumnDef): boolean {
  return (
    column.fieldName != null && FLEXIBLE_TEXT_FIELDS.has(column.fieldName)
  );
}

export function minColumnWidthPx(column: TableColumnDef): number {
  if (column.fieldName && MIN_WIDTH_BY_FIELD[column.fieldName] != null) {
    return MIN_WIDTH_BY_FIELD[column.fieldName];
  }
  if (MIN_WIDTH_BY_ID[column.id] != null) {
    return MIN_WIDTH_BY_ID[column.id];
  }
  return DEFAULT_MIN_WIDTH;
}

export function maxColumnWidthPx(column: TableColumnDef): number {
  if (column.fieldName && MAX_WIDTH_BY_FIELD[column.fieldName] != null) {
    return MAX_WIDTH_BY_FIELD[column.fieldName];
  }
  if (MAX_WIDTH_BY_ID[column.id] != null) {
    return MAX_WIDTH_BY_ID[column.id];
  }
  return isFlexibleTextColumn(column) ? 720 : DEFAULT_MAX_WIDTH;
}

export function measureColumnContentWidth(
  column: TableColumnDef,
  tasks: Task[]
): number {
  let max =
    measureText(column.label, TABLE_FONT) +
    HEADER_EXTRA +
    CELL_HORIZONTAL_PADDING;

  if (!NO_FILTER_COLUMN_IDS.has(column.id)) {
    max = Math.max(
      max,
      measureText("Filter…", CELL_FONT) + CELL_HORIZONTAL_PADDING
    );
  }

  const sample = tasks.slice(0, MEASURE_SAMPLE_SIZE);
  for (const task of sample) {
    if (column.id === "links") {
      const linkCount = task.links?.length ?? 0;
      max = Math.max(max, 72 + linkCount * 48);
      continue;
    }

    if (column.id === "subtasks") {
      max = Math.max(max, 56);
      continue;
    }

    const value = column.getValue(task);
    max = Math.max(
      max,
      measureText(value, CELL_FONT) + CELL_HORIZONTAL_PADDING
    );
  }

  return clampWidth(max, minColumnWidthPx(column), maxColumnWidthPx(column));
}

export type ComputeColumnWidthsInput = {
  columns: TableColumnDef[];
  tasks: Task[];
  containerWidth: number;
  userWidths: Record<string, number | undefined>;
};

export function computeColumnWidths({
  columns,
  tasks,
  containerWidth,
  userWidths,
}: ComputeColumnWidthsInput): Record<string, number> {
  const widths: Record<string, number> = {};
  const flexColumns: TableColumnDef[] = [];
  let fixedTotal = CHECKBOX_COLUMN_WIDTH;

  for (const column of columns) {
    const override = userWidths[column.id];
    if (override != null) {
      const width = clampWidth(
        override,
        minColumnWidthPx(column),
        maxColumnWidthPx(column)
      );
      widths[column.id] = width;
      fixedTotal += width;
      continue;
    }

    if (isFlexibleTextColumn(column)) {
      flexColumns.push(column);
      continue;
    }

    const width = measureColumnContentWidth(column, tasks);
    widths[column.id] = width;
    fixedTotal += width;
  }

  if (flexColumns.length === 0) {
    return widths;
  }

  const viewport = Math.max(containerWidth, fixedTotal + 320);
  const available = Math.max(0, viewport - fixedTotal);
  const flexMinTotal = flexColumns.reduce(
    (sum, column) => sum + minColumnWidthPx(column),
    0
  );

  if (available >= flexMinTotal) {
    const extra = available - flexMinTotal;
    const share = extra / flexColumns.length;
    for (const column of flexColumns) {
      widths[column.id] = clampWidth(
        minColumnWidthPx(column) + share,
        minColumnWidthPx(column),
        maxColumnWidthPx(column)
      );
      fixedTotal += widths[column.id];
    }
  } else {
    for (const column of flexColumns) {
      widths[column.id] = minColumnWidthPx(column);
      fixedTotal += widths[column.id];
    }
  }

  return widths;
}

export function getTableMinWidth(widths: Record<string, number>): number {
  const sum = Object.values(widths).reduce((total, width) => total + width, 0);
  return CHECKBOX_COLUMN_WIDTH + sum;
}

export { CHECKBOX_COLUMN_WIDTH };
