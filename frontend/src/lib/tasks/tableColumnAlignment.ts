import type { TableColumnDef } from "@/lib/tasks/labels";

const CENTER_ALIGNED_COLUMN_IDS = new Set([
  "id",
  "area",
  "status",
  "responsible",
  "priority",
  "sb_status",
  "sb_priority",
  "visibility",
  "risk",
]);

const DATE_TABLE_FIELDS = new Set([
  "Date Due",
  "Intervention Date",
  "Date Completed",
  "Registration Date",
]);

export function isDateTableField(fieldName: string | undefined): boolean {
  if (!fieldName) return false;
  if (DATE_TABLE_FIELDS.has(fieldName)) return true;
  return /\bdate\b/i.test(fieldName);
}

export function isCenterAlignedTableColumn(column: TableColumnDef): boolean {
  if (CENTER_ALIGNED_COLUMN_IDS.has(column.id)) return true;
  if (isDateTableField(column.fieldName)) return true;
  return false;
}

export function tableColumnHeaderAlignClass(column: TableColumnDef): string {
  return isCenterAlignedTableColumn(column) ? "text-center" : "text-left";
}

export function tableColumnHeaderContentClass(column: TableColumnDef): string {
  return isCenterAlignedTableColumn(column) ? "justify-center" : "";
}

export function tableColumnCellAlignClass(column: TableColumnDef): string {
  return isCenterAlignedTableColumn(column)
    ? "text-center align-middle"
    : "text-left align-top";
}
