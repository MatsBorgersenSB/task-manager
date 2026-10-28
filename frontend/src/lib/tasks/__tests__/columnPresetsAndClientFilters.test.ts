import assert from "node:assert/strict";
import test from "node:test";
import {
  TABLE_COLUMN_PRESETS,
  applyColumnPreset,
  defaultColumnGroups,
  defaultColumnLayout,
  resolveVisibleColumnsAndGroupSegments,
} from "../columnLayout";
import { getTableColumns } from "../labels";
import {
  summaryFilterPatch,
  isUnacknowledgedClientTask,
} from "../summaryFilters";
import type { Task } from "../types";

test("TABLE_COLUMN_PRESETS exposes Field Execution, Schedule & Dates, Client Review, and All Columns presets", () => {
  const ids = TABLE_COLUMN_PRESETS.map((p) => p.id);
  assert.deepEqual(ids, [
    "compact_execution",
    "schedule_triage",
    "client_review",
    "all_columns",
  ]);
});

test("applyColumnPreset configures column toggles and group collapse state for schedule_triage", () => {
  const initial = defaultColumnLayout("internal");
  const result = applyColumnPreset("internal", initial, "schedule_triage");

  assert.equal(result.showOptionalColumns, true);
  assert.equal(result.showClientColumns, false);

  const byId = new Map(result.layout.groups.map((g) => [g.id, g.collapsed]));
  assert.equal(byId.get("core"), false);
  assert.equal(byId.get("schedule"), false);
  assert.equal(byId.get("sb"), true);
});

test("applyColumnPreset expands all groups and enables all columns for all_columns", () => {
  const initial = defaultColumnLayout("internal");
  const result = applyColumnPreset("internal", initial, "all_columns");

  assert.equal(result.showOptionalColumns, true);
  assert.equal(result.showClientColumns, true);
  assert.equal(
    result.layout.groups.every((g) => g.collapsed === false),
    true
  );
});

test("summaryFilterPatch supports unacknowledged and myTasks client triage filters", () => {
  const unack = summaryFilterPatch("unacknowledged");
  assert.equal(unack.unacknowledgedOnly, true);

  const mine = summaryFilterPatch("myTasks");
  assert.equal(mine.myTasksOnly, true);
});

test("isUnacknowledgedClientTask identifies open tasks missing acknowledged_at or modified after acknowledgement", () => {
  const unacked: Task = {
    id: 1,
    _uuid: "t-1",
    Issue: "Pump alignment check",
    status: "In Progress",
    acknowledged_at: null,
  };
  assert.equal(isUnacknowledgedClientTask(unacked), true);

  const ackedAndFresh: Task = {
    id: 2,
    _uuid: "t-2",
    Issue: "Valve test",
    status: "In Progress",
    acknowledged_at: "2026-10-20T10:00:00Z",
    _updatedAt: "2026-10-20T09:59:00Z",
  };
  assert.equal(isUnacknowledgedClientTask(ackedAndFresh), false);

  const completed: Task = {
    id: 3,
    _uuid: "t-3",
    Issue: "Completed item",
    status: "Complete",
    acknowledged_at: null,
  };
  assert.equal(isUnacknowledgedClientTask(completed), false);
});

test("defaultColumnGroups does not place Action Comment under the Client header group and omits Client group on internal-only projects", () => {
  const internalGroups = defaultColumnGroups("internal");
  const clientGroup = internalGroups.find((g) => g.id === "client");
  assert.equal(
    clientGroup?.columnIds.includes("response_or_action_taken_by_sb"),
    false
  );

  const internalOnlyCols = getTableColumns("internal", {
    isProjectShared: false,
  });
  const internalOnlyGroups = defaultColumnGroups("internal", {
    isProjectShared: false,
  });
  const { segments } = resolveVisibleColumnsAndGroupSegments(
    internalOnlyCols,
    internalOnlyGroups
  );
  assert.equal(
    segments.some((seg) => seg.group?.id === "client"),
    false
  );
});

