import assert from "node:assert/strict";
import test from "node:test";
import { buildGanttTasks } from "../ganttTasks";
import {
  canStartTaskWithDependencies,
  formatBlockedBySummary,
  getDirectPredecessorTasks,
  getEffectiveBlockingPredecessors,
  listPredecessorCandidates,
  validateTaskDependencyLink,
} from "../dependencies";
import type { Task } from "../types";
import type { TaskDependency } from "@/lib/templates/types";

const TASKS: Task[] = [
  {
    id: 1,
    _uuid: "uuid-main-1",
    project_id: "proj-1",
    Issue: "Main task 1",
    status: "In Progress",
    "Intervention Date": "2026-10-20",
    "Date Due": "2026-10-25",
  },
  {
    id: 2,
    _uuid: "uuid-sub-1-1",
    project_id: "proj-1",
    parent_task_id: "uuid-main-1",
    Issue: "Sub task 1",
    status: "Pending",
    "Intervention Date": "2026-10-20",
    "Date Due": "2026-10-23",
  },
  {
    id: 3,
    _uuid: "uuid-main-2",
    project_id: "proj-1",
    Issue: "Main task 2",
    status: "Pending",
    "Intervention Date": "2026-10-24",
    "Date Due": "2026-10-30",
  },
  {
    id: 4,
    _uuid: "uuid-sub-2-1",
    project_id: "proj-1",
    parent_task_id: "uuid-main-2",
    Issue: "Sub task 2",
    status: "Pending",
    "Intervention Date": "2026-10-24",
    "Date Due": "2026-10-28",
  },
];

const DEPENDENCIES: TaskDependency[] = [
  {
    id: "dep-1",
    project_id: "proj-1",
    predecessor_task_id: "uuid-sub-1-1",
    successor_task_id: "uuid-main-2",
    dependency_type: "FS",
    lag_days: 0,
  },
];

test("connecting Main task 2 to Sub task 1.1 blocks both Main task 2 and Sub task 2.1 until 1.1 is completed", () => {
  const main2 = TASKS[2];
  const sub2_1 = TASKS[3];

  const directMain2 = getDirectPredecessorTasks(main2._uuid, TASKS, DEPENDENCIES);
  assert.equal(directMain2.length, 1);
  assert.equal(directMain2[0]._uuid, "uuid-sub-1-1");

  const blockersForMain2 = getEffectiveBlockingPredecessors(
    main2,
    TASKS,
    DEPENDENCIES
  );
  assert.equal(blockersForMain2.length, 1);
  assert.equal(blockersForMain2[0].predecessor._uuid, "uuid-sub-1-1");
  assert.equal(blockersForMain2[0].inheritedFromTask?._uuid, undefined);

  const blockersForSub2_1 = getEffectiveBlockingPredecessors(
    sub2_1,
    TASKS,
    DEPENDENCIES
  );
  assert.equal(blockersForSub2_1.length, 1);
  assert.equal(blockersForSub2_1[0].predecessor._uuid, "uuid-sub-1-1");
  assert.equal(blockersForSub2_1[0].inheritedFromTask?._uuid, "uuid-main-2");

  const startMain2 = canStartTaskWithDependencies(main2, TASKS, DEPENDENCIES);
  assert.equal(startMain2.allowed, false);
  assert.match(startMain2.reason ?? "", /#1\.1/);

  const startSub2_1 = canStartTaskWithDependencies(sub2_1, TASKS, DEPENDENCIES);
  assert.equal(startSub2_1.allowed, false);
  assert.match(startSub2_1.reason ?? "", /#1\.1/);

  assert.equal(
    formatBlockedBySummary(blockersForSub2_1, TASKS),
    "Waiting on #1.1"
  );
});

test("once Sub task 1.1 is completed, Main task 2 and Sub task 2.1 are unblocked and can be started", () => {
  const tasksWithCompleted1_1 = TASKS.map((t) =>
    t._uuid === "uuid-sub-1-1" ? { ...t, status: "Complete" } : t
  );

  const main2 = tasksWithCompleted1_1[2];
  const sub2_1 = tasksWithCompleted1_1[3];

  assert.equal(
    getEffectiveBlockingPredecessors(main2, tasksWithCompleted1_1, DEPENDENCIES)
      .length,
    0
  );
  assert.equal(
    getEffectiveBlockingPredecessors(sub2_1, tasksWithCompleted1_1, DEPENDENCIES)
      .length,
    0
  );
  assert.equal(
    canStartTaskWithDependencies(main2, tasksWithCompleted1_1, DEPENDENCIES)
      .allowed,
    true
  );
  assert.equal(
    canStartTaskWithDependencies(sub2_1, tasksWithCompleted1_1, DEPENDENCIES)
      .allowed,
    true
  );
});

test("validateTaskDependencyLink and listPredecessorCandidates allow linking a main task to another task's subtask while preventing cycles and ancestor/descendant links", () => {
  const main1 = TASKS[0];
  const sub1_1 = TASKS[1];
  const main2 = TASKS[2];
  const sub2_1 = TASKS[3];

  // Valid: Main task 2 depends on Subtask 1.1
  assert.doesNotThrow(() =>
    validateTaskDependencyLink(sub1_1._uuid, main2._uuid, TASKS, [])
  );

  // Invalid: Task cannot depend on its own parent or child
  assert.throws(
    () => validateTaskDependencyLink(main1._uuid, sub1_1._uuid, TASKS, []),
    /parent or subtask/i
  );
  assert.throws(
    () => validateTaskDependencyLink(sub2_1._uuid, main2._uuid, TASKS, []),
    /parent or subtask/i
  );

  // Invalid: Circular dependency (1.1 -> 2 already exists, so 2 -> 1.1 or 2.1 -> 1.1 is circular)
  assert.throws(
    () =>
      validateTaskDependencyLink(
        main2._uuid,
        sub1_1._uuid,
        TASKS,
        DEPENDENCIES
      ),
    /circular/i
  );

  const candidatesForMain2 = listPredecessorCandidates(
    main2,
    TASKS,
    DEPENDENCIES
  );
  // main1 is allowed, sub1_1 is already linked, sub2_1 is a child of main2
  assert.deepEqual(
    candidatesForMain2.map((t) => t._uuid),
    ["uuid-main-1"]
  );
});

test("buildGanttTasks attaches visual dependencies to Main task 2 group and Sub task 2.1 when Main task 2 depends on Sub task 1.1", () => {
  const { ganttTasks } = buildGanttTasks(TASKS, DEPENDENCIES);

  const groupMain2 = ganttTasks.find((g) => g.id === "group-uuid-main-2");
  const ganttSub2_1 = ganttTasks.find((g) => g.id === "uuid-sub-2-1");

  assert.ok(groupMain2, "Main task 2 group row should exist");
  assert.ok(ganttSub2_1, "Sub task 2.1 row should exist");

  assert.deepEqual(groupMain2.dependencies, ["uuid-sub-1-1"]);
  assert.deepEqual(ganttSub2_1.dependencies, ["uuid-sub-1-1"]);
  assert.match(groupMain2.name, /🔒 #1\.1/);
  assert.match(ganttSub2_1.name, /🔒 #1\.1/);
});
