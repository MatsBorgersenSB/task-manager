import { getSubtasksForParent } from "@/lib/tasks/subtasks";
import type { Task, TaskPayload } from "@/lib/tasks/types";
import { normalizeDateInput } from "@/lib/tasks/utils";

export type PlannedSubtaskShift = {
  task: Task;
  payload: TaskPayload;
};

/** Calendar-day delta between two YYYY-MM-DD dates. Null when either date is missing. */
export function calendarDayDelta(
  previousDate: string | null | undefined,
  nextDate: string | null | undefined
): number | null {
  const previous = normalizeDateInput(previousDate);
  const next = normalizeDateInput(nextDate);
  if (!previous || !next || previous === next) return null;
  const previousDay = utcDayNumber(previous);
  const nextDay = utcDayNumber(next);
  if (previousDay == null || nextDay == null) return null;
  return nextDay - previousDay;
}

export function shiftIsoDate(
  value: string | null | undefined,
  deltaDays: number
): string | null {
  const iso = normalizeDateInput(value);
  if (!iso || !Number.isFinite(deltaDays) || deltaDays === 0) {
    return iso || null;
  }
  const [year, month, day] = iso.split("-").map((part) => Number.parseInt(part, 10));
  if (!year || !month || !day) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + deltaDays);
  const shiftedYear = date.getUTCFullYear();
  const shiftedMonth = String(date.getUTCMonth() + 1).padStart(2, "0");
  const shiftedDay = String(date.getUTCDate()).padStart(2, "0");
  return `${shiftedYear}-${shiftedMonth}-${shiftedDay}`;
}

export function applyScheduleShift(task: Task, payload: TaskPayload): Task {
  const next: Task = { ...task, ...payload };
  if ("Intervention Date" in payload) {
    next.intervention_date = payload["Intervention Date"] ?? null;
  }
  return next;
}

/**
 * When a main task's due date moves, shift every descendant's due date and
 * start date by the same number of days so the schedule stays in line.
 * Tasks with no schedule dates are left unchanged.
 */
export function planSubtaskDueDateShift(
  allTasks: Task[],
  parentTaskId: string,
  previousDue: string | null | undefined,
  nextDue: string | null | undefined
): PlannedSubtaskShift[] {
  const delta = calendarDayDelta(previousDue, nextDue);
  if (delta == null || delta === 0) return [];

  const planned: PlannedSubtaskShift[] = [];
  for (const task of collectDescendants(allTasks, parentTaskId)) {
    const payload: TaskPayload = {};
    const due = normalizeDateInput(task["Date Due"]);
    if (due) {
      const shiftedDue = shiftIsoDate(due, delta);
      if (shiftedDue && shiftedDue !== due) {
        payload["Date Due"] = shiftedDue;
      }
    }

    const start = normalizeDateInput(
      task["Intervention Date"] ?? task.intervention_date
    );
    if (start) {
      const shiftedStart = shiftIsoDate(start, delta);
      if (shiftedStart && shiftedStart !== start) {
        payload["Intervention Date"] = shiftedStart;
      }
    }

    if (Object.keys(payload).length === 0) continue;
    planned.push({ task, payload });
  }

  return planned;
}

function collectDescendants(
  allTasks: Task[],
  parentTaskId: string,
  visited: Set<string> = new Set()
): Task[] {
  if (!parentTaskId || visited.has(parentTaskId)) return [];
  visited.add(parentTaskId);

  const descendants: Task[] = [];
  for (const child of getSubtasksForParent(allTasks, parentTaskId)) {
    descendants.push(child);
    descendants.push(...collectDescendants(allTasks, child._uuid, visited));
  }
  return descendants;
}

function utcDayNumber(iso: string): number | null {
  const [year, month, day] = iso.split("-").map((part) => Number.parseInt(part, 10));
  if (!year || !month || !day) return null;
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}
