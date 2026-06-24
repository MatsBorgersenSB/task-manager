import type { Task } from "@/lib/tasks/types";

export type EquipmentType = {
  id: string;
  name: string;
  code: string;
};

export type EquipmentTypeOption = Pick<EquipmentType, "name" | "code">;

export const EQUIPMENT_TYPE_CUSTOM_VALUE = "custom";

export function equipmentTypeOptionLabel(option: EquipmentTypeOption): string {
  return `${option.name} (${option.code})`;
}

export function findEquipmentTypeByCode(
  code: string,
  equipmentTypes: EquipmentTypeOption[]
): EquipmentTypeOption | undefined {
  const trimmed = code.trim();
  if (!trimmed) return undefined;
  return equipmentTypes.find(
    (option) => option.code.trim().toLowerCase() === trimmed.toLowerCase()
  );
}

export function findEquipmentTypeOption(
  equipmentTypes: EquipmentTypeOption[],
  equipmentTypeName?: string | null,
  equipmentTypeCode?: string | null
): EquipmentTypeOption | undefined {
  const name = (equipmentTypeName ?? "").trim();
  const code = (equipmentTypeCode ?? "").trim();
  if (!code && !name) return undefined;

  if (code) {
    const byCode = findEquipmentTypeByCode(code, equipmentTypes);
    if (
      byCode &&
      (!name || byCode.name.trim().toLowerCase() === name.toLowerCase())
    ) {
      return byCode;
    }
  }

  return equipmentTypes.find(
    (option) =>
      option.name.trim().toLowerCase() === name.toLowerCase() &&
      option.code.trim().toLowerCase() === code.toLowerCase()
  );
}

/** Table / export display: "MOT - Motor", or "—" when empty. */
export function formatEquipmentTypeDisplay(
  equipmentTypeName?: string | null,
  equipmentTypeCode?: string | null
): string {
  const name = (equipmentTypeName ?? "").trim();
  const code = (equipmentTypeCode ?? "").trim();
  if (!name && !code) return "—";
  if (code && name) return `${code} - ${name}`;
  if (code) return code;
  return name;
}

/** Stored / filter value without em dash placeholder. */
export function formatEquipmentTypeValue(
  equipmentTypeName?: string | null,
  equipmentTypeCode?: string | null
): string {
  const name = (equipmentTypeName ?? "").trim();
  const code = (equipmentTypeCode ?? "").trim();
  if (!name && !code) return "";
  if (code && name) return `${code} - ${name}`;
  if (code) return code;
  return name;
}

export function equipmentTypeFilterKey(
  equipmentTypeName?: string | null,
  equipmentTypeCode?: string | null
): string {
  const name = (equipmentTypeName ?? "").trim();
  const code = (equipmentTypeCode ?? "").trim();
  if (!name && !code) return "";
  return `${code}|${name}`;
}

export function parseEquipmentTypeFilterKey(key: string): {
  code: string;
  name: string;
} {
  const [code = "", name = ""] = key.split("|");
  return { code, name };
}

export function taskMatchesEquipmentTypeFilter(
  task: Task,
  filterKey: string
): boolean {
  if (!filterKey) return true;
  const { code, name } = parseEquipmentTypeFilterKey(filterKey);
  const taskCode = (task.equipmentTypeCode ?? "").trim();
  const taskName = (task.equipmentTypeName ?? "").trim();
  return taskCode === code && taskName === name;
}

export type EquipmentTypeFilterOption = {
  value: string;
  label: string;
};

export function buildEquipmentTypeFilterOptions(
  tasks: Task[],
  equipmentTypes: EquipmentTypeOption[]
): EquipmentTypeFilterOption[] {
  const seen = new Set<string>();
  const options: EquipmentTypeFilterOption[] = [];

  for (const option of equipmentTypes) {
    const value = equipmentTypeFilterKey(option.name, option.code);
    if (seen.has(value)) continue;
    seen.add(value);
    options.push({
      value,
      label: formatEquipmentTypeValue(option.name, option.code),
    });
  }

  for (const task of tasks) {
    const value = equipmentTypeFilterKey(
      task.equipmentTypeName,
      task.equipmentTypeCode
    );
    if (!value || seen.has(value)) continue;
    seen.add(value);
    options.push({
      value,
      label: formatEquipmentTypeValue(
        task.equipmentTypeName,
        task.equipmentTypeCode
      ),
    });
  }

  return options.sort((a, b) => a.label.localeCompare(b.label));
}

export function mergeEquipmentTypes(
  existing: EquipmentType[],
  incoming: EquipmentType
): EquipmentType[] {
  if (existing.some((item) => item.id === incoming.id)) {
    return existing;
  }
  return [...existing, incoming].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );
}
