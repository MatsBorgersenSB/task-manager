import assert from "node:assert/strict";
import test from "node:test";
import type { Task } from "../types";
import { resolveBoardTasksForSubtaskMode } from "../boardBuckets";
import { taskDisplayId } from "../subtasks";

const MAIN_1: Task = {
  id: 13,
  _uuid: "u-13",
  Issue: "Control system",
  "SB Status": "In planning",
};

const SUB_1_1: Task = {
  id: 14,
  _uuid: "u-13-1",
  parent_task_id: "u-13",
  Issue: "PLC",
  "SB Status": "In execution",
};

const SUB_1_1_1: Task = {
  id: 15,
  _uuid: "u-13-1-1",
  parent_task_id: "u-13-1",
  Issue: "Temperature sensor shaft syngas fan",
  "SB Status": "Finished",
};

const MAIN_2: Task = {
  id: 20,
  _uuid: "u-20",
  Issue: "Burner",
  "SB Status": "Not started",
};

const ALL_TASKS: Task[] = [MAIN_1, SUB_1_1, SUB_1_1_1, MAIN_2];

test("resolveBoardTasksForSubtaskMode returns only main tasks in nested and hidden modes", () => {
  const nested = resolveBoardTasksForSubtaskMode(
    [MAIN_1, SUB_1_1, MAIN_2],
    ALL_TASKS,
    "nested"
  );
  assert.deepEqual(
    nested.map((t) => t._uuid),
    ["u-13", "u-20"]
  );

  const hidden = resolveBoardTasksForSubtaskMode(
    [MAIN_1, SUB_1_1, MAIN_2],
    ALL_TASKS,
    "hidden"
  );
  assert.deepEqual(
    hidden.map((t) => t._uuid),
    ["u-13", "u-20"]
  );
});

test("resolveBoardTasksForSubtaskMode returns main tasks and all nested subtasks in separate mode without duplicates", () => {
  const separate = resolveBoardTasksForSubtaskMode(
    [MAIN_1, MAIN_2],
    ALL_TASKS,
    "separate"
  );
  assert.deepEqual(
    separate.map((t) => t._uuid),
    ["u-13", "u-13-1", "u-13-1-1", "u-20"]
  );
});

test("taskDisplayId numbers main tasks sequentially (1, 2, 3…) and subtasks hierarchically (1.1, 1.1.1, 2.1…) even when raw task_number has gaps from subtasks", () => {
  const fase0: Task = { id: 1, _uuid: "f0", Issue: "Fase 0" };
  const sub0_1: Task = {
    id: 2,
    _uuid: "f0-1",
    parent_task_id: "f0",
    Issue: "SPV",
  };
  const sub0_2: Task = {
    id: 3,
    _uuid: "f0-2",
    parent_task_id: "f0",
    Issue: "MoU",
  };
  const sub0_3: Task = {
    id: 4,
    _uuid: "f0-3",
    parent_task_id: "f0",
    Issue: "New Subtask",
  };
  const fase1: Task = { id: 5, _uuid: "f1", Issue: "Fase 1" };
  const sub1_1: Task = {
    id: 6,
    _uuid: "f1-1",
    parent_task_id: "f1",
    Issue: "Datapakke",
  };
  const sub1_2: Task = {
    id: 7,
    _uuid: "f1-2",
    parent_task_id: "f1",
    Issue: "Gap-analyse",
  };
  const fase2: Task = { id: 11, _uuid: "f2", Issue: "Fase 2" };
  const sub2_1: Task = {
    id: 12,
    _uuid: "f2-1",
    parent_task_id: "f2",
    Issue: "FEED",
  };

  const projectTasks = [
    fase0,
    sub0_1,
    sub0_2,
    sub0_3,
    fase1,
    sub1_1,
    sub1_2,
    fase2,
    sub2_1,
  ];

  assert.equal(taskDisplayId(fase0, projectTasks), "1");
  assert.equal(taskDisplayId(sub0_1, projectTasks), "1.1");
  assert.equal(taskDisplayId(sub0_2, projectTasks), "1.2");
  assert.equal(taskDisplayId(sub0_3, projectTasks), "1.3");
  assert.equal(taskDisplayId(fase1, projectTasks), "2");
  assert.equal(taskDisplayId(sub1_1, projectTasks), "2.1");
  assert.equal(taskDisplayId(sub1_2, projectTasks), "2.2");
  assert.equal(taskDisplayId(fase2, projectTasks), "3");
  assert.equal(taskDisplayId(sub2_1, projectTasks), "3.1");
});

