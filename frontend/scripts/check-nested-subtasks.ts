import type { Task } from "../src/lib/tasks/types";
import {
  canMoveTaskToSubtask,
  canReparentSubtask,
  flattenVisibleHierarchy,
  listParentTaskCandidates,
  taskDepth,
  taskDisplayId,
  validateAssignParent,
} from "../src/lib/tasks/subtasks";

function task(
  id: number,
  uuid: string,
  parent: string | null = null,
  projectId = "project-1"
): Task {
  return {
    id,
    _uuid: uuid,
    parent_task_id: parent,
    project_id: projectId,
    Issue: `Task ${id}`,
  };
}

const main = task(1, "main");
const level1 = task(2, "l1", "main");
const level2 = task(3, "l2", "l1");
const level3 = task(4, "l3", "l2");
const other = task(5, "other");
const tasks = [main, level1, level2, level3, other];

const failures: string[] = [];

function expect(condition: boolean, message: string) {
  if (!condition) failures.push(message);
}

function expectThrow(fn: () => void, includes: string, message: string) {
  try {
    fn();
    failures.push(`${message} (did not throw)`);
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    if (!text.includes(includes)) {
      failures.push(`${message} (threw "${text}")`);
    }
  }
}

expect(taskDisplayId(main, tasks) === "1", `main id ${taskDisplayId(main, tasks)}`);
expect(taskDisplayId(level1, tasks) === "1.1", `l1 id ${taskDisplayId(level1, tasks)}`);
expect(taskDisplayId(level2, tasks) === "1.1.1", `l2 id ${taskDisplayId(level2, tasks)}`);
expect(taskDisplayId(level3, tasks) === "1.1.1.1", `l3 id ${taskDisplayId(level3, tasks)}`);
expect(taskDepth(main, tasks) === 0, "main depth");
expect(taskDepth(level1, tasks) === 1, "level 1 depth");
expect(taskDepth(level2, tasks) === 2, "level 2 depth");
expect(taskDepth(level3, tasks) === 3, "level 3 depth");

expectThrow(
  () => validateAssignParent(level3, level3._uuid, tasks),
  "itself",
  "self parent"
);
expectThrow(
  () => validateAssignParent(main, level3._uuid, tasks),
  "own subtasks",
  "cycle under descendant"
);
expectThrow(
  () => validateAssignParent(level1, level2._uuid, tasks),
  "own subtasks",
  "cycle level1 under level2"
);

validateAssignParent(other, level2._uuid, tasks);
validateAssignParent(level1, other._uuid, tasks);

const parentsForLevel3 = listParentTaskCandidates(tasks, level3, {
  excludeParentId: level3.parent_task_id,
}).map((row) => row._uuid);
expect(
  parentsForLevel3.includes("l1") &&
    parentsForLevel3.includes("main") &&
    parentsForLevel3.includes("other") &&
    !parentsForLevel3.includes("l2") &&
    !parentsForLevel3.includes("l3"),
  `level3 parents ${parentsForLevel3.join(",")}`
);

const collapsed = flattenVisibleHierarchy(tasks.filter((row) => !row.parent_task_id), tasks, new Set());
expect(
  collapsed.map((row) => row._uuid).join(",") === "main,other",
  `collapsed ${collapsed.map((row) => row._uuid).join(",")}`
);

const expandedMain = flattenVisibleHierarchy(
  [main, other],
  tasks,
  new Set(["main"])
);
expect(
  expandedMain.map((row) => row._uuid).join(",") === "main,l1,other",
  `expand main ${expandedMain.map((row) => row._uuid).join(",")}`
);

const expandedDeep = flattenVisibleHierarchy(
  [main, other],
  tasks,
  new Set(["main", "l1", "l2"])
);
expect(
  expandedDeep.map((row) => row._uuid).join(",") === "main,l1,l2,l3,other",
  `expand deep ${expandedDeep.map((row) => row._uuid).join(",")}`
);

expect(canMoveTaskToSubtask(main, tasks), "main with children can move when another task exists");
expect(
  !canMoveTaskToSubtask(main, [main, level1, level2]),
  "main cannot move when every other task is a descendant"
);
expect(canReparentSubtask(level1, tasks), "level1 with children can move to another parent");
expect(
  !canReparentSubtask(level1, [main, level1]),
  "subtask cannot reparent when the only other task is its parent"
);

const foreign = task(9, "foreign", null, "project-2");
expectThrow(
  () => validateAssignParent(level3, foreign._uuid, [...tasks, foreign]),
  "same project",
  "cross project"
);

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("nested subtask checks passed");
