import type { TableColumnDef } from "@/lib/tasks/labels";
import type { Task } from "@/lib/tasks/types";
import { columnSupportsHeaderFilter } from "@/lib/tasks/columnFilterValues";
import { columnSupportsSort } from "@/lib/tasks/tableHeaderControls";

const HEADER_FONT = "500 12px Inter, system-ui, sans-serif";
const CELL_FONT = "400 12px Inter, system-ui, sans-serif";
const SORT_INDICATOR = " ↓";

const CHECKBOX_COLUMN_WIDTH = 40;
const CELL_HORIZONTAL_PADDING = 20;

/** Matches `!px-3` on header cells (12px × 2). */
const HEADER_HORIZONTAL_PADDING = 24;
/** Matches `pr-3` reserved for the resize handle. */
const RESIZE_HANDLE_SPACE = 12;
/** Filter chevron control in the header row. */
const FILTER_CONTROL_WIDTH = 16;
/** Matches `gap-0.5` between header controls. */
const HEADER_CONTROL_GAP = 2;
const HEADER_BUFFER = 2;

/** Long text columns allow wider manual resize / fit-to-content. */
const FLEXIBLE_TEXT_FIELDS = new Set([
  "Issue",
  "CE Comments",
  "SB Note",
  "Risk Comment",
  "Response or Action taken by SB",
]);

const MIN_WIDTH_BY_FIELD: Record<string, number> = {
  Issue: 120,
  "CE Comments": 84,
  "SB Note": 72,
  "Risk Comment": 84,
  "Response or Action taken by SB": 96,
  Area: 44,
  status: 64,
  Responsible: 64,
  "Date Due": 80,
  "Intervention Date": 64,
  "Date Completed": 88,
  "Registration Date": 88,
  "Intervention Duration": 64,
  "SB Status": 72,
  "SB Priority": 72,
  Visibility: 72,
  Risk: 44,
  Priority: 64,
  "SB Owner": 64,
};

const MIN_WIDTH_BY_ID: Record<string, number> = {
  id: 36,
  subtasks: 52,
  links: 56,
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

const DEFAULT_MIN_WIDTH = 48;
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

export function measureIssueColumnDefaultWidth(containerWidth: number): number {
  const viewport = containerWidth > 0 ? containerWidth : 1280;
  const min = 220;
  const max = 300;
  const t = Math.min(1, Math.max(0, (viewport - 1024) / (1920 - 1024)));
  return Math.round(min + t * (max - min));
}

function isIssueColumn(column: TableColumnDef): boolean {
  return column.fieldName === "Issue" || column.id === "issue";
}

export function measureColumnHeaderWidth(column: TableColumnDef): number {
  const sortable = columnSupportsSort(column.id);
  const filterable = columnSupportsHeaderFilter(column.id);

  const labelWidth = column.headerLines?.length
    ? Math.max(
        ...column.headerLines.map((line) => measureText(line, HEADER_FONT))
      )
    : measureText(column.label, HEADER_FONT);

  let width = labelWidth;

  if (sortable) {
    width += HEADER_CONTROL_GAP + measureText(SORT_INDICATOR, HEADER_FONT);
  }

  if (filterable) {
    width += HEADER_CONTROL_GAP + FILTER_CONTROL_WIDTH;
  }

  width +=
    HEADER_HORIZONTAL_PADDING + RESIZE_HANDLE_SPACE + HEADER_BUFFER;

  return clampWidth(width, minColumnWidthPx(column), maxColumnWidthPx(column));
}

export function measureColumnContentWidth(
  column: TableColumnDef,
  tasks: Task[]
): number {
  let max = measureColumnHeaderWidth(column);

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
  userWidths?: Record<string, number | undefined>;
  containerWidth?: number;
};

export function computeColumnWidths({
  columns,
  userWidths = {},
  containerWidth = 0,
}: ComputeColumnWidthsInput): Record<string, number> {
  const widths: Record<string, number> = {};

  for (const column of columns) {
    const override = userWidths[column.id];
    if (override != null) {
      widths[column.id] = clampWidth(
        override,
        minColumnWidthPx(column),
        maxColumnWidthPx(column)
      );
      continue;
    }

    if (isIssueColumn(column)) {
      widths[column.id] = clampWidth(
        measureIssueColumnDefaultWidth(containerWidth),
        minColumnWidthPx(column),
        maxColumnWidthPx(column)
      );
      continue;
    }

    widths[column.id] = measureColumnHeaderWidth(column);
  }

  return widths;
}

export function getTableMinWidth(widths: Record<string, number>): number {
  const sum = Object.values(widths).reduce((total, width) => total + width, 0);
  return CHECKBOX_COLUMN_WIDTH + sum;
}

export { CHECKBOX_COLUMN_WIDTH };
