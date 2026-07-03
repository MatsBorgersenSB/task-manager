import { formatAreaCodeOnly } from "@/lib/tasks/areas";
import type { Task } from "@/lib/tasks/types";

export type AreaTaskGroup = {
  key: string;
  label: string;
  tasks: Task[];
};

export type TableDisplayRow =
  | {
      type: "group";
      key: string;
      label: string;
      count: number;
      collapsed: boolean;
    }
  | {
      type: "task";
      task: Task;
    };

const NO_AREA_KEY = "__none__";

export function areaGroupKey(task: Task): string {
  const code = (task.areaCode ?? "").trim();
  return code || NO_AREA_KEY;
}

export function areaGroupLabel(key: string): string {
  if (key === NO_AREA_KEY) return "—";
  return formatAreaCodeOnly(key) === "—" ? key : formatAreaCodeOnly(key);
}

export function groupVisibleTasksByArea(
  tasks: Task[],
  areaSortDirection: "asc" | "desc" = "asc"
): AreaTaskGroup[] {
  const map = new Map<string, Task[]>();

  for (const task of tasks) {
    const key = areaGroupKey(task);
    const bucket = map.get(key);
    if (bucket) bucket.push(task);
    else map.set(key, [task]);
  }

  const direction = areaSortDirection === "desc" ? -1 : 1;

  return [...map.entries()]
    .sort(([left], [right]) => {
      if (left === NO_AREA_KEY) return 1 * direction;
      if (right === NO_AREA_KEY) return -1 * direction;
      return left.localeCompare(right) * direction;
    })
    .map(([key, groupTasks]) => ({
      key,
      label: areaGroupLabel(key),
      tasks: groupTasks,
    }));
}

export function buildTableDisplayRows(
  tasks: Task[],
  groupByArea: boolean,
  collapsedGroupKeys: ReadonlySet<string>,
  areaSort: string = "area-asc"
): TableDisplayRow[] {
  if (!groupByArea) {
    return tasks.map((task) => ({ type: "task", task }));
  }

  const areaSortDirection = areaSort === "area-desc" ? "desc" : "asc";
  const rows: TableDisplayRow[] = [];
  for (const group of groupVisibleTasksByArea(tasks, areaSortDirection)) {
    const collapsed = collapsedGroupKeys.has(group.key);
    rows.push({
      type: "group",
      key: group.key,
      label: group.label,
      count: group.tasks.length,
      collapsed,
    });
    if (!collapsed) {
      for (const task of group.tasks) {
        rows.push({ type: "task", task });
      }
    }
  }
  return rows;
}
