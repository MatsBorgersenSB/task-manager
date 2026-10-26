import assert from "node:assert/strict";
import test from "node:test";
import { planDependentSuccessorsShift } from "../cascadeDueDates";
import {
  computeOwnerWorkload,
  computeAreaReadiness,
  computeTemplateDrift,
} from "../pmAnalytics";
import type { Task } from "../types";
import type { TaskDependency, ProjectTemplateTask } from "../../templates/types";

test("planDependentSuccessorsShift shifts direct and transitive dependent tasks by the due-date delta while skipping completed tasks", () => {
  const tasks: Task[] = [
    {
      id: 1,
      _uuid: "t-1",
      Issue: "FAT Inspection",
      "Intervention Date": "2026-11-01",
      "Date Due": "2026-11-05",
      status: "In Progress",
    },
    {
      id: 2,
      _uuid: "t-2",
      Issue: "SAT Commissioning",
      "Intervention Date": "2026-11-06",
      "Date Due": "2026-11-10",
      status: "Not Started",
    },
    {
      id: 3,
      _uuid: "t-3",
      Issue: "Performance Qualification",
      "Intervention Date": "2026-11-11",
      "Date Due": "2026-11-15",
      status: "Not Started",
    },
    {
      id: 4,
      _uuid: "t-4",
      Issue: "Already Done",
      "Intervention Date": "2026-11-06",
      "Date Due": "2026-11-08",
      status: "Complete",
    },
  ];

  const deps: TaskDependency[] = [
    {
      id: "d-1",
      project_id: "p-1",
      predecessor_task_id: "t-1",
      successor_task_id: "t-2",
      dependency_type: "FS",
      lag_days: 0,
    },
    {
      id: "d-2",
      project_id: "p-1",
      predecessor_task_id: "t-2",
      successor_task_id: "t-3",
      dependency_type: "FS",
      lag_days: 0,
    },
    {
      id: "d-3",
      project_id: "p-1",
      predecessor_task_id: "t-1",
      successor_task_id: "t-4",
      dependency_type: "FS",
      lag_days: 0,
    },
  ];

  const planned = planDependentSuccessorsShift(
    tasks,
    deps,
    "t-1",
    "2026-11-05",
    "2026-11-09"
  );

  assert.equal(planned.length, 2);
  const byId = new Map(planned.map((p) => [p.task._uuid, p.payload]));
  assert.deepEqual(byId.get("t-2"), {
    "Intervention Date": "2026-11-10",
    "Date Due": "2026-11-14",
  });
  assert.deepEqual(byId.get("t-3"), {
    "Intervention Date": "2026-11-15",
    "Date Due": "2026-11-19",
  });
});

test("computeOwnerWorkload aggregates open tasks and intervention hours per SB Owner", () => {
  const tasks: Task[] = [
    {
      id: 1,
      _uuid: "t-1",
      Issue: "Task A",
      "SB Owner": "Alice, Bob",
      intervention_hours: 12,
      status: "In Progress",
    },
    {
      id: 2,
      _uuid: "t-2",
      Issue: "Task B",
      "SB Owner": "Alice",
      intervention_hours: 8,
      status: "Not Started",
    },
    {
      id: 3,
      _uuid: "t-3",
      Issue: "Task C",
      "SB Owner": "Alice",
      intervention_hours: 16,
      status: "Complete",
    },
  ];

  const rows = computeOwnerWorkload(tasks);
  const alice = rows.find((r) => r.owner === "Alice");
  const bob = rows.find((r) => r.owner === "Bob");

  assert.ok(alice);
  assert.equal(alice.openTasks, 2);
  assert.equal(alice.interventionHours, 20);

  assert.ok(bob);
  assert.equal(bob.openTasks, 1);
  assert.equal(bob.interventionHours, 12);
});

test("computeAreaReadiness includes both main tasks and subtasks in area completion percentages", () => {
  const tasks: Task[] = [
    {
      id: 1,
      _uuid: "t-1",
      areaName: "Boiler Room",
      status: "Complete",
    },
    {
      id: 2,
      _uuid: "t-2",
      parent_task_id: "t-1",
      areaName: "Boiler Room",
      status: "In Progress",
    },
  ];

  const areas = computeAreaReadiness(tasks);
  assert.equal(areas.length, 1);
  assert.equal(areas[0].area, "Boiler Room");
  assert.equal(areas[0].completed, 1);
  assert.equal(areas[0].total, 2);
  assert.equal(areas[0].percent, 50);
});

test("computeTemplateDrift identifies template tasks missing from the active project", () => {
  const projectTasks: Task[] = [
    { id: 1, _uuid: "t-1", Issue: "Hydrostatic Pressure Test" },
  ];

  const templateTasks: ProjectTemplateTask[] = [
    {
      id: "tt-1",
      template_id: "tpl-1",
      parent_template_task_id: null,
      title: "Hydrostatic Pressure Test",
      description: null,
      area_id: null,
      area_name: "Piping",
      area_code: "P01",
      responsible: null,
      sb_owner: null,
      sb_status: null,
      priority: "High",
      visibility_scope: "internal_client",
      sort_order: 1,
      due_offset_days: 5,
      intervention_offset_days: 3,
      default_status: null,
      is_milestone: false,
      is_critical: true,
      estimated_duration_days: 2,
      template_notes: null,
      metadata: {},
    },
    {
      id: "tt-2",
      template_id: "tpl-1",
      parent_template_task_id: null,
      title: "Safety Relief Valve Calibration",
      description: "New check added in template v2",
      area_id: null,
      area_name: "Safety",
      area_code: "S01",
      responsible: null,
      sb_owner: null,
      sb_status: null,
      priority: "High",
      visibility_scope: "internal_client",
      sort_order: 2,
      due_offset_days: 7,
      intervention_offset_days: 5,
      default_status: null,
      is_milestone: true,
      is_critical: true,
      estimated_duration_days: 1,
      template_notes: null,
      metadata: {},
    },
  ];

  const missing = computeTemplateDrift(projectTasks, templateTasks);
  assert.equal(missing.length, 1);
  assert.equal(missing[0].title, "Safety Relief Valve Calibration");
});
