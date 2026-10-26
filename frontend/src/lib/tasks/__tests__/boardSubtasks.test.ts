import assert from "node:assert/strict";
import test from "node:test";
import type { Task } from "../types";
import { resolveBoardTasksForSubtaskMode } from "../boardBuckets";

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
