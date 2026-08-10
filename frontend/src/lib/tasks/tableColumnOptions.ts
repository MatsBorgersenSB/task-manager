/** Optional / client column visibility for the internal task table. */

export const INTERNAL_OPTIONAL_COLUMN_IDS = [
  "priority",
  "response_or_action_taken_by_sb",
  "intervention_date",
  "intervention_duration",
  "date_completed",
] as const;

export type InternalOptionalColumnId =
  (typeof INTERNAL_OPTIONAL_COLUMN_IDS)[number];

const OPTIONAL_STORAGE_KEY = "task-table-optional-columns";
const CLIENT_STORAGE_KEY = "task-table-client-columns";

export function readShowOptionalColumns(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(OPTIONAL_STORAGE_KEY) === "1";
}

export function persistShowOptionalColumns(value: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(OPTIONAL_STORAGE_KEY, value ? "1" : "0");
}

/** Client Status / Client Comment — off by default for internal-only work. */
export function readShowClientColumns(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(CLIENT_STORAGE_KEY) === "1";
}

export function persistShowClientColumns(value: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CLIENT_STORAGE_KEY, value ? "1" : "0");
}
