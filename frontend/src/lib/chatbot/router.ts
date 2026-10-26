import {
  toCompactTaskHeader,
  type CompactTaskInput,
} from "../../types/task-compact";

export type TaskListFilter = "today" | "overdue" | "all";

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
    };

export type RouterHandlers = {
  completeTask: (taskId: number) => Promise<CompactTaskInput | null>;
  listCompactTasks: (filter: TaskListFilter) => Promise<readonly CompactTaskInput[]>;
  callLLM: (message: string) => Promise<string>;
};

export type RouteChatResult = {
  reply: string;
  bypassedLLM: boolean;
  intent: "complete_task" | "list_tasks" | "llm";
};

const COMPLETE_TASK_REGEX = /^(done|complete|finish)\s+#?(\d+)$/i;
const LIST_TASKS_REGEX = /^(list|show)\s+(today|overdue|all)$/i;

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

  return null;
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
        task: toCompactTaskHeader(updated),
      }),
      bypassedLLM: true,
      intent: "complete_task",
    };
  }

  if (matched?.type === "list_tasks") {
    const rawTasks = await handlers.listCompactTasks(matched.filter);
    const compactTasks = rawTasks.map((t) => toCompactTaskHeader(t));

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

  const reply = await handlers.callLLM(message);
  return {
    reply,
    bypassedLLM: false,
    intent: "llm",
  };
}
