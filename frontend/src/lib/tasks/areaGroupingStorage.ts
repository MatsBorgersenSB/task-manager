const GROUP_BY_AREA_STORAGE_KEY = "task-table-group-by-area";

export function readGroupByArea(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(GROUP_BY_AREA_STORAGE_KEY) === "1";
}

export function persistGroupByArea(enabled: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(GROUP_BY_AREA_STORAGE_KEY, enabled ? "1" : "0");
}
