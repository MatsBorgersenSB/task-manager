import type { Task } from "@/lib/tasks/types";
import { isNoAreaValue } from "@/lib/tasks/utils/areaCode";

export type Area = {
  id: string;
  name: string;
  code: string;
};

export type AreaOption = Pick<Area, "name" | "code">;

export const AREA_CUSTOM_VALUE = "custom";

export { AREA_NONE_VALUE, isNoAreaValue } from "@/lib/tasks/utils/areaCode";

export function areaOptionLabel(option: AreaOption): string {
  return `${option.name} (${option.code})`;
}

export function findAreaByCode(
  code: string,
  areas: AreaOption[]
): AreaOption | undefined {
  const trimmed = code.trim();
  if (!trimmed) return undefined;
  return areas.find(
    (option) => option.code.trim().toLowerCase() === trimmed.toLowerCase()
  );
}

export function findAreaOption(
  areas: AreaOption[],
  areaName?: string | null,
  areaCode?: string | null
): AreaOption | undefined {
  const name = (areaName ?? "").trim();
  const code = (areaCode ?? "").trim();
  if (!code && !name) return undefined;

  if (code) {
    const byCode = findAreaByCode(code, areas);
    if (
      byCode &&
      (!name || byCode.name.trim().toLowerCase() === name.toLowerCase())
    ) {
      return byCode;
    }
  }

  return areas.find(
    (option) =>
      option.name.trim().toLowerCase() === name.toLowerCase() &&
      option.code.trim().toLowerCase() === code.toLowerCase()
  );
}

/** Table / export display: "REA - Reactor", or "—" when empty. */
export function formatAreaDisplay(
  areaName?: string | null,
  areaCode?: string | null
): string {
  const name = (areaName ?? "").trim();
  const code = (areaCode ?? "").trim();
  if (!name && !code) return "—";
  if (code && name) return `${code} - ${name}`;
  if (code) return code;
  return name;
}

/** Table cell display: area code only (e.g. "REA"). */
export function formatAreaCodeOnly(code?: string | null): string {
  const trimmedCode = (code ?? "").trim();
  if (isNoAreaValue(trimmedCode)) return "—";
  return trimmedCode;
}

/** Hover tooltip for table area cells: "Reactor (REA)". */
export function formatAreaTableTooltip(
  name?: string | null,
  code?: string | null
): string | undefined {
  const trimmedName = (name ?? "").trim();
  const trimmedCode = (code ?? "").trim();
  if (isNoAreaValue(trimmedCode) || !trimmedName) return undefined;
  return `${trimmedName} (${trimmedCode})`;
}

/** Stored / filter value without em dash placeholder. */
export function formatAreaValue(
  areaName?: string | null,
  areaCode?: string | null
): string {
  const name = (areaName ?? "").trim();
  const code = (areaCode ?? "").trim();
  if (!name && !code) return "";
  if (code && name) return `${code} - ${name}`;
  if (code) return code;
  return name;
}

export function areaFilterKey(
  areaName?: string | null,
  areaCode?: string | null
): string {
  const name = (areaName ?? "").trim();
  const code = (areaCode ?? "").trim();
  if (!name && !code) return "";
  return `${code}|${name}`;
}

export function parseAreaFilterKey(key: string): { code: string; name: string } {
  const [code = "", name = ""] = key.split("|");
  return { code, name };
}

export const AREA_FILTER_ALL = "ALL";
export const AREA_FILTER_NONE = "NONE";

export function taskHasNoArea(task: Task): boolean {
  return isNoAreaValue(task.areaCode);
}

export function taskMatchesAreaFilter(task: Task, filterKey: string): boolean {
  if (!filterKey || filterKey === AREA_FILTER_ALL) return true;

  if (filterKey === AREA_FILTER_NONE) {
    return taskHasNoArea(task);
  }

  if (filterKey.includes("|")) {
    const { code, name } = parseAreaFilterKey(filterKey);
    const taskCode = (task.areaCode ?? "").trim();
    const taskName = (task.areaName ?? "").trim();
    return taskCode === code && taskName === name;
  }

  const taskCode = (task.areaCode ?? "").trim();
  return taskCode.toLowerCase() === filterKey.trim().toLowerCase();
}

export function areaFilterSummaryLabel(
  filterKey: string,
  areas: AreaOption[]
): string {
  if (!filterKey || filterKey === AREA_FILTER_ALL) return "All";
  if (filterKey === AREA_FILTER_NONE) return "—";
  const match = areas.find(
    (area) => area.code.trim().toLowerCase() === filterKey.trim().toLowerCase()
  );
  return match?.code ?? filterKey;
}

export type AreaFilterOption = {
  value: string;
  label: string;
};

export function buildAreaFilterOptions(
  tasks: Task[],
  areas: AreaOption[]
): AreaFilterOption[] {
  const seen = new Set<string>();
  const options: AreaFilterOption[] = [];

  for (const option of areas) {
    const value = areaFilterKey(option.name, option.code);
    if (seen.has(value)) continue;
    seen.add(value);
    options.push({ value, label: formatAreaValue(option.name, option.code) });
  }

  for (const task of tasks) {
    const value = areaFilterKey(task.areaName, task.areaCode);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    options.push({
      value,
      label: formatAreaValue(task.areaName, task.areaCode),
    });
  }

  return options.sort((a, b) => a.label.localeCompare(b.label));
}

export function mergeAreas(existing: Area[], incoming: Area): Area[] {
  if (existing.some((area) => area.id === incoming.id)) {
    return existing;
  }
  return [...existing, incoming].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );
}

export function replaceAreaInList(existing: Area[], updated: Area): Area[] {
  const index = existing.findIndex((area) => area.id === updated.id);
  if (index === -1) {
    return mergeAreas(existing, updated);
  }
  const next = [...existing];
  next[index] = updated;
  return next.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );
}

export function findAreaRecordByCode(
  code: string,
  areas: Area[]
): Area | undefined {
  const trimmed = code.trim();
  if (!trimmed) return undefined;
  return areas.find(
    (area) => area.code.trim().toLowerCase() === trimmed.toLowerCase()
  );
}

export function findAreaInListById(
  areaId: string,
  areas: Area[]
): Area | undefined {
  const trimmed = areaId.trim();
  if (!trimmed) return undefined;
  return areas.find((area) => area.id === trimmed);
}
