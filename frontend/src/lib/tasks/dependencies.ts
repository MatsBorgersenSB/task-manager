import {
  collectDescendantIds,
  isSubtaskComplete,
  parentCreatesCycle,
  taskDisplayId,
} from "@/lib/tasks/subtasks";
import type { Task } from "@/lib/tasks/types";
import type { TaskDependency } from "@/lib/templates/types";

export type EffectiveTaskBlocker = {
  dependency: TaskDependency;
  predecessor: Task;
  /** Present when this blocker comes from an ancestor task (e.g. Main Task 2 blocking Subtask 2.1). */
  inheritedFromTask?: Task;
  isComplete: boolean;
};

/**
 * Returns true when `task` is marked Complete (client status, SB Status, or Date Completed).
 */
export function isTaskCompleted(task: Task): boolean {
  if (isSubtaskComplete(task)) return true;
  const sbStatus = (task["SB Status"] ?? "").trim().toLowerCase();
  return sbStatus === "complete" || sbStatus === "completed";
}

/**
 * Returns true when a status value represents starting or completing work
 * (i.e. anything beyond Pending / Not Started).
 */
export function isStartedOrCompletedStatus(
  status: string | null | undefined
): boolean {
  const normalized = (status ?? "").trim().toLowerCase();
  if (!normalized) return false;
  return (
    normalized !== "pending" &&
    normalized !== "not started" &&
    normalized !== "on hold" &&
    normalized !== "open" &&
    normalized !== "backlog"
  );
}

/**
 * Walk ancestors of `task` from immediate parent up to root main task.
 */
export function getAncestorTasks(task: Task, allTasks: Task[]): Task[] {
  const ancestors: Task[] = [];
  const seen = new Set<string>([task._uuid]);
  let currentParentId = task.parent_task_id;

  while (currentParentId && !seen.has(currentParentId)) {
    seen.add(currentParentId);
    const parent = allTasks.find((t) => t._uuid === currentParentId);
    if (!parent) break;
    ancestors.push(parent);
    currentParentId = parent.parent_task_id;
  }

  return ancestors;
}

/**
 * Direct predecessor tasks linked specifically to `taskUuid` (`successor_task_id === taskUuid`).
 */
export function getDirectPredecessorTasks(
  taskUuid: string,
  allTasks: Task[],
  dependencies: TaskDependency[]
): Task[] {
  const byId = new Map(allTasks.map((t) => [t._uuid, t]));
  const result: Task[] = [];
  for (const dep of dependencies) {
    if (dep.successor_task_id !== taskUuid) continue;
    const pred = byId.get(dep.predecessor_task_id);
    if (pred) result.push(pred);
  }
  return result;
}

/**
 * Direct successor tasks that depend on `taskUuid` (`predecessor_task_id === taskUuid`).
 */
export function getDirectSuccessorTasks(
  taskUuid: string,
  allTasks: Task[],
  dependencies: TaskDependency[]
): Task[] {
  const byId = new Map(allTasks.map((t) => [t._uuid, t]));
  const result: Task[] = [];
  for (const dep of dependencies) {
    if (dep.predecessor_task_id !== taskUuid) continue;
    const succ = byId.get(dep.successor_task_id);
    if (succ) result.push(succ);
  }
  return result;
}

/**
 * All predecessors that apply to `task`, including those inherited from its parent/ancestor main task.
 */
export function getEffectivePredecessors(
  task: Task,
  allTasks: Task[],
  dependencies: TaskDependency[]
): EffectiveTaskBlocker[] {
  if (dependencies.length === 0) return [];
  const byId = new Map(allTasks.map((t) => [t._uuid, t]));
  const seenPredecessorIds = new Set<string>();
  const results: EffectiveTaskBlocker[] = [];

  // 1. Direct dependencies on `task`
  for (const dep of dependencies) {
    if (dep.successor_task_id !== task._uuid) continue;
    const pred = byId.get(dep.predecessor_task_id);
    if (!pred || seenPredecessorIds.has(pred._uuid)) continue;
    seenPredecessorIds.add(pred._uuid);
    results.push({
      dependency: dep,
      predecessor: pred,
      isComplete: isTaskCompleted(pred),
    });
  }

  // 2. Inherited dependencies from ancestors (e.g. Main task 2 -> Subtask 2.1)
  const ancestors = getAncestorTasks(task, allTasks);
  for (const ancestor of ancestors) {
    for (const dep of dependencies) {
      if (dep.successor_task_id !== ancestor._uuid) continue;
      const pred = byId.get(dep.predecessor_task_id);
      if (!pred || seenPredecessorIds.has(pred._uuid)) continue;
      seenPredecessorIds.add(pred._uuid);
      results.push({
        dependency: dep,
        predecessor: pred,
        inheritedFromTask: ancestor,
        isComplete: isTaskCompleted(pred),
      });
    }
  }

  return results;
}

/**
 * Incomplete predecessors that currently block `task` (either directly or inherited from its parent).
 */
export function getEffectiveBlockingPredecessors(
  task: Task,
  allTasks: Task[],
  dependencies: TaskDependency[]
): EffectiveTaskBlocker[] {
  return getEffectivePredecessors(task, allTasks, dependencies).filter(
    (entry) => !entry.isComplete
  );
}

/**
 * Checks whether `task` can be started or completed given its direct and inherited dependencies.
 */
export function canStartTaskWithDependencies(
  task: Task,
  allTasks: Task[],
  dependencies: TaskDependency[]
): {
  allowed: boolean;
  blockers: EffectiveTaskBlocker[];
  reason?: string;
} {
  const blockers = getEffectiveBlockingPredecessors(
    task,
    allTasks,
    dependencies
  );
  if (blockers.length === 0) {
    return { allowed: true, blockers: [] };
  }

  const taskLabel = `#${taskDisplayId(task, allTasks)}`;
  const blockerLabels = blockers.map((b) => {
    const id = taskDisplayId(b.predecessor, allTasks);
    const title = (b.predecessor.Issue ?? "").trim() || "Untitled";
    return `#${id} (${title})`;
  });

  const inheritedNote = blockers.some((b) => b.inheritedFromTask)
    ? ` (required before #${taskDisplayId(blockers.find((b) => b.inheritedFromTask)!.inheritedFromTask!, allTasks)} and its subtasks can start)`
    : "";

  return {
    allowed: false,
    blockers,
    reason: `Cannot start or complete ${taskLabel} yet — waiting for ${blockerLabels.join(", ")} to be completed${inheritedNote}.`,
  };
}

/**
 * Compact badge text for blocked tasks, e.g. "Waiting on #1.1" or "Waiting on #1.1, #1.2".
 */
export function formatBlockedBySummary(
  blockers: EffectiveTaskBlocker[],
  allTasks: Task[]
): string {
  if (blockers.length === 0) return "";
  const ids = blockers.map((b) => `#${taskDisplayId(b.predecessor, allTasks)}`);
  if (ids.length <= 2) {
    return `Waiting on ${ids.join(", ")}`;
  }
  return `Waiting on ${ids[0]} +${ids.length - 1}`;
}

/**
 * Compact Gantt label suffix showing predecessor links and whether they are still blocking.
 */
export function formatGanttDependencySuffix(
  task: Task,
  allTasks: Task[],
  dependencies: TaskDependency[]
): string {
  const effective = getEffectivePredecessors(task, allTasks, dependencies);
  if (effective.length === 0) return "";

  const incomplete = effective.filter((b) => !b.isComplete);
  if (incomplete.length > 0) {
    const ids = incomplete.map(
      (b) => `#${taskDisplayId(b.predecessor, allTasks)}`
    );
    return ` [🔒 ${ids.join(", ")}]`;
  }

  const ids = effective.map(
    (b) => `#${taskDisplayId(b.predecessor, allTasks)}`
  );
  return ` [✓ after ${ids.join(", ")}]`;
}

/**
 * True when `predecessorId` and `successorId` share a parent/subtask ancestor relationship.
 */
export function areTasksInSameHierarchyLine(
  taskAId: string,
  taskBId: string,
  allTasks: Task[]
): boolean {
  if (taskAId === taskBId) return true;
  return (
    parentCreatesCycle(taskAId, taskBId, allTasks) ||
    parentCreatesCycle(taskBId, taskAId, allTasks)
  );
}

/**
 * True when adding `predecessorId -> successorId` would create a dependency cycle
 * (including across parent/subtask inheritance).
 */
export function dependencyCreatesCycle(
  predecessorId: string,
  successorId: string,
  allTasks: Task[],
  dependencies: TaskDependency[]
): boolean {
  if (predecessorId === successorId) return true;

  // Build directed graph of (predecessor -> successor), including parent -> child inheritance
  // because if P blocks M, P also blocks M's subtasks.
  const adjacency = new Map<string, Set<string>>();
  const addEdge = (from: string, to: string) => {
    let set = adjacency.get(from);
    if (!set) {
      set = new Set();
      adjacency.set(from, set);
    }
    set.add(to);
  };

  for (const dep of dependencies) {
    addEdge(dep.predecessor_task_id, dep.successor_task_id);
    for (const descId of collectDescendantIds(dep.successor_task_id, allTasks)) {
      addEdge(dep.predecessor_task_id, descId);
    }
  }

  // Also include the proposed edge and its inherited effect on successor's descendants
  addEdge(predecessorId, successorId);
  for (const descId of collectDescendantIds(successorId, allTasks)) {
    addEdge(predecessorId, descId);
  }

  // Check if predecessorId (or any of its ancestors whose blockage would block predecessorId)
  // is reachable from successorId
  const targets = new Set<string>([predecessorId]);
  const predTask = allTasks.find((t) => t._uuid === predecessorId);
  if (predTask) {
    for (const anc of getAncestorTasks(predTask, allTasks)) {
      targets.add(anc._uuid);
    }
  }

  const visited = new Set<string>();
  const queue: string[] = [successorId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (targets.has(current)) return true;
    if (visited.has(current)) continue;
    visited.add(current);

    for (const next of adjacency.get(current) ?? []) {
      if (!visited.has(next)) {
        queue.push(next);
      }
    }
  }

  return false;
}

/**
 * Validates connecting `predecessorId` (can be a main task or a subtask like 1.1)
 * as a prerequisite for `successorId` (can be a main task like 2 or a subtask).
 */
export function validateTaskDependencyLink(
  predecessorId: string,
  successorId: string,
  allTasks: Task[],
  dependencies: TaskDependency[]
): void {
  if (predecessorId === successorId) {
    throw new Error("A task cannot depend on itself.");
  }

  const pred = allTasks.find((t) => t._uuid === predecessorId);
  const succ = allTasks.find((t) => t._uuid === successorId);
  if (!pred || !succ) {
    throw new Error("Predecessor or successor task not found.");
  }

  if (
    pred.project_id &&
    succ.project_id &&
    pred.project_id !== succ.project_id
  ) {
    throw new Error("Dependencies must belong to the same project.");
  }

  if (areTasksInSameHierarchyLine(predecessorId, successorId, allTasks)) {
    throw new Error(
      "A task cannot depend on its own parent or subtask."
    );
  }

  if (dependencyCreatesCycle(predecessorId, successorId, allTasks, dependencies)) {
    throw new Error("Circular task dependency is not allowed.");
  }
}

/**
 * Lists all valid predecessor candidates (both main tasks and subtasks in the same project)
 * that `currentTask` can be connected to.
 */
export function listPredecessorCandidates(
  currentTask: Task,
  allTasks: Task[],
  dependencies: TaskDependency[]
): Task[] {
  const existingPredecessorIds = new Set(
    dependencies
      .filter((d) => d.successor_task_id === currentTask._uuid)
      .map((d) => d.predecessor_task_id)
  );

  return allTasks
    .filter((candidate) => {
      if (candidate._uuid === currentTask._uuid) return false;
      if (existingPredecessorIds.has(candidate._uuid)) return false;
      if (
        currentTask.project_id &&
        candidate.project_id &&
        currentTask.project_id !== candidate.project_id
      ) {
        return false;
      }
      if (
        areTasksInSameHierarchyLine(
          candidate._uuid,
          currentTask._uuid,
          allTasks
        )
      ) {
        return false;
      }
      if (
        dependencyCreatesCycle(
          candidate._uuid,
          currentTask._uuid,
          allTasks,
          dependencies
        )
      ) {
        return false;
      }
      return true;
    })
    .sort((a, b) =>
      taskDisplayId(a, allTasks).localeCompare(
        taskDisplayId(b, allTasks),
        undefined,
        { numeric: true }
      )
    );
}
