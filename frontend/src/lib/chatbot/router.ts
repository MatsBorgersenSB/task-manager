import type { TaskViewMode } from "@/lib/tasks/types";
import { todayIso } from "@/lib/tasks/taskDates";
import {
  toCompactTaskHeader,
  type CompactTaskInput,
  type TaskCompactHeader,
} from "../../types/task-compact";

export type TaskListFilter =
  | "today"
  | "overdue"
  | "all"
  | "blocked"
  | "critical"
  | "milestones"
  | "unassigned";

export type DeterministicCommand =
  | {
      type: "complete_task";
      action: "done" | "complete" | "finish";
      taskId: number;
    }
  | {
      type: "list_tasks";
      verb: "list" | "show";
      filter: TaskListFilter;
    }
  | {
      type: "standup";
    }
  | {
      type: "workload";
    };

export type RouterHandlers = {
  completeTask: (taskId: number) => Promise<CompactTaskInput | null>;
  listCompactTasks: (filter: TaskListFilter) => Promise<readonly CompactTaskInput[]>;
  callLLM: (message: string) => Promise<string>;
  today?: string;
  mode?: TaskViewMode;
};

export type RouteChatResult = {
  reply: string;
  bypassedLLM: boolean;
  intent: "complete_task" | "list_tasks" | "standup" | "workload" | "llm";
};

const COMPLETE_TASK_REGEX = /^(done|complete|finish)\s+#?(\d+)$/i;
const LIST_TASKS_REGEX =
  /^(list|show)\s+(today|overdue|all|blocked|critical|milestones|unassigned)$/i;
const STANDUP_REGEX = /^(standup|project\s+status|daily\s+standup|pulse)$/i;
const WORKLOAD_REGEX = /^(workload|team\s+workload|owner\s+workload)$/i;

/**
 * Matches deterministic task commands before invoking any LLM wrapper.
 */
export function matchDeterministicCommand(
  input: string
): DeterministicCommand | null {
  const trimmed = input.trim();

  const completeMatch = COMPLETE_TASK_REGEX.exec(trimmed);
  if (completeMatch) {
    return {
      type: "complete_task",
      action: completeMatch[1].toLowerCase() as "done" | "complete" | "finish",
      taskId: Number.parseInt(completeMatch[2], 10),
    };
  }

  const listMatch = LIST_TASKS_REGEX.exec(trimmed);
  if (listMatch) {
    return {
      type: "list_tasks",
      verb: listMatch[1].toLowerCase() as "list" | "show",
      filter: listMatch[2].toLowerCase() as TaskListFilter,
    };
  }

  if (STANDUP_REGEX.test(trimmed)) {
    return { type: "standup" };
  }

  if (WORKLOAD_REGEX.test(trimmed)) {
    return { type: "workload" };
  }

  return null;
}

function isCompletedTask(task: TaskCompactHeader): boolean {
  const status = task.status?.toLowerCase() ?? "";
  const sbStatus = task.sbStatus?.toLowerCase() ?? "";
  return (
    status === "complete" ||
    status === "completed" ||
    sbStatus === "complete" ||
    sbStatus === "completed"
  );
}

function isBlockedTask(task: TaskCompactHeader): boolean {
  const status = task.status?.toLowerCase() ?? "";
  const sbStatus = task.sbStatus?.toLowerCase() ?? "";
  return (
    status.includes("block") ||
    status.includes("on hold") ||
    sbStatus.includes("block") ||
    sbStatus.includes("on hold")
  );
}

function isCriticalTask(task: TaskCompactHeader): boolean {
  const priority = task.priority?.toLowerCase() ?? "";
  const sbPriority = task.sbPriority?.toLowerCase() ?? "";
  return (
    task.is_critical === true ||
    priority === "critical" ||
    priority === "high" ||
    sbPriority === "critical"
  );
}

function resolveTaskOwner(
  task: TaskCompactHeader,
  mode?: TaskViewMode
): string | undefined {
  if (mode === "client") {
    return task.responsible;
  }
  return task.sbOwner || task.responsible;
}

/**
 * Filters compact task headers by a deterministic TaskListFilter.
 * Ensures client mode never filters on stripped SB-only fields.
 */
export function filterCompactTaskHeaders(
  headers: readonly TaskCompactHeader[],
  filter: TaskListFilter,
  options?: { today?: string; mode?: TaskViewMode }
): TaskCompactHeader[] {
  const today = options?.today ?? todayIso();
  const mode = options?.mode;

  if (filter === "all") {
    return [...headers];
  }

  const openHeaders = headers.filter((t) => !isCompletedTask(t));

  switch (filter) {
    case "today":
      return openHeaders.filter((t) => t.dateDue === today);
    case "overdue":
      return openHeaders.filter((t) => Boolean(t.dateDue && t.dateDue < today));
    case "blocked":
      return openHeaders.filter(isBlockedTask);
    case "critical":
      return openHeaders.filter(isCriticalTask);
    case "milestones":
      return openHeaders.filter((t) => t.is_milestone === true);
    case "unassigned":
      return openHeaders.filter((t) => !resolveTaskOwner(t, mode));
    default:
      return openHeaders;
  }
}

/**
 * Routes a user message through the deterministic regex pre-filter first.
 * If matched, executes the corresponding handler directly and returns compact JSON,
 * bypassing the LLM completely.
 */
export async function routeChatMessage(
  message: string,
  handlers: RouterHandlers
): Promise<RouteChatResult> {
  const matched = matchDeterministicCommand(message);
  const mode = handlers.mode;
  const today = handlers.today ?? todayIso();

  if (matched?.type === "complete_task") {
    const updated = await handlers.completeTask(matched.taskId);
    if (!updated) {
      return {
        reply: JSON.stringify({
          ok: false,
          action: "complete_task",
          taskId: matched.taskId,
          error: `Task #${matched.taskId} not found`,
        }),
        bypassedLLM: true,
        intent: "complete_task",
      };
    }

    return {
      reply: JSON.stringify({
        ok: true,
        action: "complete_task",
        task: toCompactTaskHeader(updated, { mode }),
      }),
      bypassedLLM: true,
      intent: "complete_task",
    };
  }

  if (matched?.type === "list_tasks") {
    const rawTasks = await handlers.listCompactTasks(matched.filter);
    const compactTasks = rawTasks.map((t) => toCompactTaskHeader(t, { mode }));

    return {
      reply: JSON.stringify({
        filter: matched.filter,
        count: compactTasks.length,
        tasks: compactTasks,
      }),
      bypassedLLM: true,
      intent: "list_tasks",
    };
  }

  if (matched?.type === "standup") {
    const rawTasks = await handlers.listCompactTasks("all");
    const openTasks = rawTasks
      .map((t) => toCompactTaskHeader(t, { mode }))
      .filter((t) => !isCompletedTask(t));

    const overdue = openTasks.filter((t) => t.dateDue && t.dateDue < today);
    const dueToday = openTasks.filter((t) => t.dateDue === today);
    const blocked = openTasks.filter(isBlockedTask);
    const critical = openTasks.filter(isCriticalTask);
    const unassignedCount = openTasks.filter(
      (t) => !resolveTaskOwner(t, mode)
    ).length;

    return {
      reply: JSON.stringify({
        action: "standup",
        openCount: openTasks.length,
        overdue: overdue.slice(0, 5),
        overdueCount: overdue.length,
        dueToday: dueToday.slice(0, 5),
        dueTodayCount: dueToday.length,
        blocked: blocked.slice(0, 5),
        blockedCount: blocked.length,
        critical: critical.slice(0, 5),
        criticalCount: critical.length,
        unassignedCount,
      }),
      bypassedLLM: true,
      intent: "standup",
    };
  }

  if (matched?.type === "workload") {
    const rawTasks = await handlers.listCompactTasks("all");
    const openTasks = rawTasks
      .map((t) => toCompactTaskHeader(t, { mode }))
      .filter((t) => !isCompletedTask(t));

    const ownerMap = new Map<string, { open: number; overdue: number }>();
    let unassignedCount = 0;

    for (const task of openTasks) {
      const owner = resolveTaskOwner(task, mode);
      if (!owner) {
        unassignedCount += 1;
        continue;
      }
      const existing = ownerMap.get(owner) ?? { open: 0, overdue: 0 };
      existing.open += 1;
      if (task.dateDue && task.dateDue < today) {
        existing.overdue += 1;
      }
      ownerMap.set(owner, existing);
    }

    const owners = Array.from(ownerMap.entries())
      .map(([owner, counts]) => ({
        owner,
        open: counts.open,
        overdue: counts.overdue,
      }))
      .sort((a, b) => b.open - a.open || b.overdue - a.overdue);

    return {
      reply: JSON.stringify({
        action: "workload",
        openCount: openTasks.length,
        unassignedCount,
        owners,
      }),
      bypassedLLM: true,
      intent: "workload",
    };
  }

  const reply = await handlers.callLLM(message);
  return {
    reply,
    bypassedLLM: false,
    intent: "llm",
  };
}
