import type { Task } from "@/lib/tasks/types";
import { filterTasksByOwners, parseSbOwners } from "@/lib/tasks/sbOwners";
import { taskDateValue } from "@/lib/tasks/taskDates";

export type SortKey =
  | "id"
  | "dueDate"
  | "priority"
  | "status"
  | "sbStatus"
  | "sbOwners";

export type SortDirection = "asc" | "desc";

export type SortConfig = {
  key: SortKey;
  direction: SortDirection;
};

const PRIORITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  med: 2,
  medium: 2,
  low: 3,
};

const normalizedOwnersCache = new WeakMap<Task, string[]>();

function getNormalizedOwners(task: Task): string[] {
  let owners = normalizedOwnersCache.get(task);
  if (!owners) {
    owners = parseSbOwners(task["SB Owner"])
      .map((owner) => owner.toLowerCase())
      .sort((left, right) => left.localeCompare(right));
    normalizedOwnersCache.set(task, owners);
  }
  return owners;
}

function getPrimaryOwner(task: Task): string | null {
  return getNormalizedOwners(task)[0] ?? null;
}

function compareDates(
  dueA: string | null,
  dueB: string | null
): number {
  if (!dueA && !dueB) return 0;
  if (!dueA) return 1;
  if (!dueB) return -1;
  return dueA.localeCompare(dueB);
}

function compareSbOwners(a: Task, b: Task): number {
  const ownerA = getPrimaryOwner(a);
  const ownerB = getPrimaryOwner(b);

  if (!ownerA && !ownerB) return 0;
  if (!ownerA) return 1;
  if (!ownerB) return -1;

  return ownerA.localeCompare(ownerB);
}

function comparePrimary(a: Task, b: Task, key: SortKey): number {
  switch (key) {
    case "id":
      return a.id - b.id;
    case "dueDate":
      return compareDates(
        taskDateValue(a["Date Due"]),
        taskDateValue(b["Date Due"])
      );
    case "priority": {
      const rankA = PRIORITY_ORDER[(a.Priority ?? "").trim().toLowerCase()];
      const rankB = PRIORITY_ORDER[(b.Priority ?? "").trim().toLowerCase()];
      const safeA = rankA === undefined ? 99 : rankA;
      const safeB = rankB === undefined ? 99 : rankB;
      return safeA - safeB;
    }
    case "status":
      return (a.status ?? "").localeCompare(b.status ?? "");
    case "sbStatus":
      return (a["SB Status"] ?? "").localeCompare(b["SB Status"] ?? "");
    case "sbOwners":
      return compareSbOwners(a, b);
    default:
      return a.id - b.id;
  }
}

/** Map UI sort filter values to sort config. */
export function parseSortFilter(sort: string): SortConfig {
  switch (sort) {
    case "due-asc":
      return { key: "dueDate", direction: "asc" };
    case "due-desc":
      return { key: "dueDate", direction: "desc" };
    case "priority":
      return { key: "priority", direction: "asc" };
    case "status":
      return { key: "status", direction: "asc" };
    case "sb-status":
      return { key: "sbStatus", direction: "asc" };
    case "sb-owners-asc":
      return { key: "sbOwners", direction: "asc" };
    case "sb-owners-desc":
      return { key: "sbOwners", direction: "desc" };
    default:
      return { key: "id", direction: "asc" };
  }
}

export function sortTasks(tasks: Task[], config: SortConfig): Task[] {
  const dir = config.direction === "asc" ? 1 : -1;

  return [...tasks].sort((a, b) => {
    const primary = comparePrimary(a, b, config.key);
    if (primary !== 0) return primary * dir;

    const dueCompare = compareDates(
      taskDateValue(a["Date Due"]),
      taskDateValue(b["Date Due"])
    );
    if (dueCompare !== 0) return dueCompare;

    return a.id - b.id;
  });
}

/** Filter tasks that include a given SB owner (case-insensitive). */
export function filterTasksByOwner(tasks: Task[], owner: string): Task[] {
  const wanted = owner.trim();
  if (!wanted) return tasks;
  return filterTasksByOwners(tasks, [wanted]);
}
