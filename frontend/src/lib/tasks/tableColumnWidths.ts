import type { TableColumnDef } from "@/lib/tasks/labels";

/** Content-tuned default widths (px) for table columns. */
const DEFAULT_WIDTH_BY_FIELD: Record<string, number> = {
  Area: 72,
  Issue: 280,
  status: 108,
  Priority: 88,
  Responsible: 96,
  "CE Comments": 240,
  "Response or Action taken by SB": 260,
  "Date Due": 104,
  "Intervention Date": 104,
  "Intervention Duration": 112,
  "Date Completed": 104,
  "Registration Date": 104,
  "SB Status": 112,
  "SB Priority": 96,
  Visibility: 112,
  "SB Owner": 104,
  Risk: 72,
  "Risk Comment": 200,
  "SB Note": 200,
};

const DEFAULT_WIDTH_BY_ID: Record<string, number> = {
  id: 52,
  subtasks: 80,
  links: 120,
};

const MIN_WIDTH_BY_FIELD: Record<string, number> = {
  Issue: 160,
  "CE Comments": 120,
  "Response or Action taken by SB": 120,
  "Risk Comment": 120,
  "SB Note": 120,
};

const MIN_WIDTH_BY_ID: Record<string, number> = {
  id: 44,
  subtasks: 64,
  links: 88,
};

const MAX_WIDTH_BY_FIELD: Record<string, number> = {
  Issue: 520,
  "CE Comments": 640,
  "Response or Action taken by SB": 640,
  "Risk Comment": 480,
  "SB Note": 480,
};

const DEFAULT_MIN_WIDTH = 64;
const DEFAULT_MAX_WIDTH = 420;

export function defaultColumnWidthPx(column: TableColumnDef): number {
  if (column.fieldName && DEFAULT_WIDTH_BY_FIELD[column.fieldName] != null) {
    return DEFAULT_WIDTH_BY_FIELD[column.fieldName];
  }
  if (DEFAULT_WIDTH_BY_ID[column.id] != null) {
    return DEFAULT_WIDTH_BY_ID[column.id];
  }
  if (column.colWidth) {
    const parsed = Number.parseInt(column.colWidth, 10);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return 120;
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
  return DEFAULT_MAX_WIDTH;
}

export function buildDefaultWidthMap(
  columns: TableColumnDef[]
): Record<string, number> {
  return Object.fromEntries(
    columns.map((column) => [column.id, defaultColumnWidthPx(column)])
  );
}

export function loadStoredColumnWidths(
  storageKey: string,
  defaults: Record<string, number>
): Record<string, number> {
  if (typeof window === "undefined") return { ...defaults };

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return { ...defaults };

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const merged = { ...defaults };

    for (const [columnId, value] of Object.entries(parsed)) {
      if (typeof value !== "number" || !Number.isFinite(value)) continue;
      if (!(columnId in defaults)) continue;
      merged[columnId] = Math.round(value);
    }

    return merged;
  } catch {
    return { ...defaults };
  }
}

export function saveStoredColumnWidths(
  storageKey: string,
  widths: Record<string, number>
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(widths));
  } catch {
    // Ignore quota / private mode errors.
  }
}

export function taskTableColumnStorageKey(
  mode: string,
  showOptionalColumns: boolean
): string {
  return `task-table-column-widths:${mode}:${showOptionalColumns ? "full" : "default"}`;
}
