/** Sort/filter helpers for column header controls in the task table. */

const COLUMN_SORT_OPTIONS: Record<string, readonly string[]> = {
  id: ["id"],
  status: ["status"],
  priority: ["priority"],
  date_due: ["due-asc", "due-desc"],
  sb_status: ["sb-status"],
  sb_owner: ["sb-owners-asc", "sb-owners-desc"],
};

export function columnSupportsSort(columnId: string): boolean {
  return columnId in COLUMN_SORT_OPTIONS;
}

export function isColumnSortActive(columnId: string, currentSort: string): boolean {
  const options = COLUMN_SORT_OPTIONS[columnId];
  return options?.includes(currentSort) ?? false;
}

export function sortIndicatorForColumn(
  columnId: string,
  currentSort: string
): string {
  if (!isColumnSortActive(columnId, currentSort)) return "";
  if (currentSort.endsWith("-desc") || currentSort === "sb-owners-desc") {
    return " ↓";
  }
  return " ↑";
}

/** Cycle sort for a column header click; returns next filters.sort value. */
export function cycleColumnSort(columnId: string, currentSort: string): string {
  const options = COLUMN_SORT_OPTIONS[columnId];
  if (!options || options.length === 0) return currentSort;

  if (options.length === 1) {
    return currentSort === options[0] ? "id" : options[0];
  }

  const index = options.indexOf(currentSort);
  if (index === -1) return options[0];
  if (index >= options.length - 1) return "id";
  return options[index + 1];
}
