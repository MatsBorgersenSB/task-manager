import type { Task, TaskFilters } from "@/lib/tasks/types";
import { CLIENT_STATUS_FILTER_ALL } from "@/lib/tasks/constants";
import { normalizeVisibilityScope } from "@/lib/tasks/visibility";

const PRIORITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  med: 2,
  medium: 2,
  low: 3,
};

export function priorityBadgeClass(priority: string | null | undefined): string {
  const base =
    "inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap";
  if (!priority) return "";
  const value = priority.trim().toLowerCase();
  if (value === "critical") {
    return `${base} border-2 border-red-300 bg-red-200 font-bold text-red-950`;
  }
  if (value === "high") {
    return `${base} border border-orange-200 bg-orange-100 text-orange-950`;
  }
  if (value === "medium" || value === "med") {
    return `${base} border border-blue-200 bg-blue-100 text-blue-950`;
  }
  if (value === "low") {
    return `${base} border border-slate-200 bg-slate-100 text-slate-800`;
  }
  return `${base} border border-slate-200 bg-slate-100 text-slate-800`;
}

export function sbPriorityBadgeClass(
  sbPriority: string | null | undefined
): string {
  const base =
    "inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap";
  if (!sbPriority) return "";
  const value = sbPriority.trim().toLowerCase();
  if (value === "urgent") {
    return `${base} border-2 border-red-300 bg-red-200 font-bold text-red-950`;
  }
  if (value === "high") {
    return `${base} border border-orange-200 bg-orange-100 text-orange-950`;
  }
  if (value === "medium") {
    return `${base} border border-blue-200 bg-blue-100 text-blue-950`;
  }
  if (value === "low") {
    return `${base} border border-emerald-200 bg-emerald-100 text-emerald-950`;
  }
  return `${base} border border-slate-200 bg-slate-100 text-slate-800`;
}

export {
  DEFAULT_VISIBILITY_SCOPE,
  formatVisibilityScope,
  isClientVisibleTask,
  normalizeVisibilityScope,
  visibilityBadgeClass,
  visibilityBadgeLabel,
  type VisibilityScope,
} from "@/lib/tasks/visibility";

export function taskDateValue(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function normalizeDateInput(value: string | null | undefined): string {
  if (!value) return "";
  const trimmed = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return trimmed;
  return parsed.toISOString().slice(0, 10);
}

function matchesPriority(task: Task, filter: string): boolean {
  if (!filter) return true;
  const priority = (task.Priority ?? "").trim().toLowerCase();
  const wanted = filter.toLowerCase();
  if (wanted === "med") return priority === "med" || priority === "medium";
  if (wanted === "medium") return priority === "med" || priority === "medium";
  return priority === wanted;
}

function matchesClientStatus(task: Task, filter: string): boolean {
  const status = (task.status ?? "").trim();

  if (filter === CLIENT_STATUS_FILTER_ALL) {
    return true;
  }

  if (filter === "Complete") {
    return status === "Complete";
  }

  if (!filter) {
    return status !== "Complete";
  }

  return status === filter;
}

export function filterAndSortTasks(tasks: Task[], filters: TaskFilters): Task[] {
  let result = tasks.filter((task) => {
    if (filters.searchText) {
      const search = filters.searchText.toLowerCase();
      const matches = [
        task.Issue,
        task.Responsible,
        task["CE Comments"],
        task["SB Note"],
        task["Response or Action taken by SB"],
      ]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(search));

      if (!matches) return false;
    }

    if (!matchesPriority(task, filters.priority)) return false;
    if (!matchesClientStatus(task, filters.status)) return false;
    if (filters.sbStatus && (task["SB Status"] ?? "") !== filters.sbStatus) {
      return false;
    }
    if (filters.sbPriority && (task["SB Priority"] ?? "") !== filters.sbPriority) {
      return false;
    }
    if (filters.visibilityScope) {
      const scope = normalizeVisibilityScope(task.visibility_scope);
      if (scope !== filters.visibilityScope) return false;
    }

    const due = taskDateValue(task["Date Due"]);
    if (filters.due === "overdue") {
      if (!due || due >= todayIso()) return false;
    } else if (filters.due === "none") {
      if (due) return false;
    } else if (filters.due === "has") {
      if (!due) return false;
    }
    return true;
  });

  const sort = filters.sort || "id";
  result = [...result].sort((a, b) => {
    if (sort === "due-asc") {
      const dueA = taskDateValue(a["Date Due"]);
      const dueB = taskDateValue(b["Date Due"]);
      if (!dueA && !dueB) return a.id - b.id;
      if (!dueA) return 1;
      if (!dueB) return -1;
      return dueA.localeCompare(dueB) || a.id - b.id;
    }
    if (sort === "due-desc") {
      const dueA = taskDateValue(a["Date Due"]);
      const dueB = taskDateValue(b["Date Due"]);
      if (!dueA && !dueB) return a.id - b.id;
      if (!dueA) return 1;
      if (!dueB) return -1;
      return dueB.localeCompare(dueA) || a.id - b.id;
    }
    if (sort === "priority") {
      const rankA = PRIORITY_ORDER[(a.Priority ?? "").trim().toLowerCase()];
      const rankB = PRIORITY_ORDER[(b.Priority ?? "").trim().toLowerCase()];
      const safeA = rankA === undefined ? 99 : rankA;
      const safeB = rankB === undefined ? 99 : rankB;
      return safeA - safeB || a.id - b.id;
    }
    if (sort === "status") {
      return (a.status ?? "").localeCompare(b.status ?? "") || a.id - b.id;
    }
    if (sort === "sb-status") {
      return (
        (a["SB Status"] ?? "").localeCompare(b["SB Status"] ?? "") || a.id - b.id
      );
    }
    return a.id - b.id;
  });

  return result;
}

export function uniqueStatuses(tasks: Task[]): string[] {
  const values = new Set<string>();
  for (const task of tasks) {
    const status = (task.status ?? "").trim();
    if (status) values.add(status);
  }
  return [...values].sort();
}

export function parseSbOwners(value: string | null | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function formatSbOwners(selected: string[]): string | null {
  return selected.length ? selected.join(", ") : null;
}

export function buildPayloadFromForm(
  form: HTMLFormElement,
  fieldNames: readonly string[]
): Record<string, string> {
  const payload: Record<string, string> = {};
  for (const name of fieldNames) {
    if (name === "SB Owner") {
      const boxes = form.querySelectorAll<HTMLInputElement>(
        'input[name="SB Owner"]:checked'
      );
      const selected = [...boxes].map((box) => box.value);
      const value = formatSbOwners(selected);
      if (value) payload[name] = value;
      continue;
    }
    const field = form.elements.namedItem(name);
    if (!field || field instanceof RadioNodeList) continue;
    if (field instanceof HTMLSelectElement && field.multiple) {
      const selected = [...field.selectedOptions].map((o) => o.value);
      const value = formatSbOwners(selected);
      if (value) payload[name] = value;
      continue;
    }
    if ("value" in field && typeof field.value === "string") {
      const trimmed = field.value.trim();
      if (trimmed) payload[name] = trimmed;
    }
  }
  return payload;
}

export function fillFormFromTask(
  form: HTMLFormElement,
  task: Task,
  fieldNames: readonly string[]
) {
  for (const name of fieldNames) {
    if (name === "SB Owner") {
      const chosen = parseSbOwners(task["SB Owner"]);
      form.querySelectorAll<HTMLInputElement>('input[name="SB Owner"]').forEach(
        (box) => {
          box.checked = chosen.includes(box.value);
        }
      );
      continue;
    }
    const field = form.elements.namedItem(name);
    if (!field || field instanceof RadioNodeList) continue;
    const value = task[name as keyof Task];
    if (field instanceof HTMLInputElement && field.type === "date") {
      field.value = normalizeDateInput(value as string | null | undefined);
    } else if ("value" in field) {
      field.value = (value as string) ?? "";
    }
  }
}
