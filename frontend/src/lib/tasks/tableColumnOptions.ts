/** Optional internal table columns hidden by default to reduce visual overload. */
export const INTERNAL_OPTIONAL_COLUMN_IDS = [
  "priority",
  "response_or_action_taken_by_sb",
  "intervention_date",
  "intervention_duration",
  "date_completed",
] as const;

export type InternalOptionalColumnId =
  (typeof INTERNAL_OPTIONAL_COLUMN_IDS)[number];

const STORAGE_KEY = "task-table-optional-columns";

export function readShowOptionalColumns(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(STORAGE_KEY) === "1";
}

export function persistShowOptionalColumns(value: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
}
