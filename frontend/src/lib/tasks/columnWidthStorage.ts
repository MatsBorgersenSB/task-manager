import type { TaskViewMode } from "@/lib/tasks/types";

const STORAGE_PREFIX = "task-table-column-widths";

export function columnWidthStorageKey(
  mode: TaskViewMode,
  showOptionalColumns: boolean,
  showClientColumns = false
): string {
  const opt = showOptionalColumns ? "opt" : "base";
  const client = showClientColumns ? "client" : "noclient";
  return `${STORAGE_PREFIX}:${mode}:${opt}:${client}`;
}

export function readStoredColumnWidths(
  storageKey: string
): Record<string, number> {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return {};

    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};

    const widths: Record<string, number> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "number" && Number.isFinite(value) && value > 0) {
        widths[key] = Math.round(value);
      }
    }
    return widths;
  } catch {
    return {};
  }
}

export function writeStoredColumnWidths(
  storageKey: string,
  widths: Record<string, number>
): void {
  if (typeof window === "undefined") return;

  try {
    if (Object.keys(widths).length === 0) {
      window.localStorage.removeItem(storageKey);
      return;
    }
    window.localStorage.setItem(storageKey, JSON.stringify(widths));
  } catch {
    // Ignore quota / private mode errors.
  }
}
