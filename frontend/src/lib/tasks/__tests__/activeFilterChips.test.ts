import assert from "node:assert/strict";
import test from "node:test";
import type { Task, TaskFilters } from "../types";
import { filterAndSortTasks } from "../utils";
import {
  buildActiveFilterChips,
  matchesQuickSearch,
  removeFilterChip,
} from "../activeFilterChips";

const BASE_FILTERS: TaskFilters = {
  searchQuery: "",
  columnFilters: {},
  columnMultiFilters: {},
  priority: "",
  status: "",
  sbStatus: "",
  sbPriority: "",
  sbOwners: [],
  area: "ALL",
  visibilityScope: "",
  due: "",
  risk: "",
  sort: "id",
};

const SAMPLE_TASKS: Task[] = [
  {
    id: 101,
    _uuid: "uuid-101",
    Issue: "Calibrate pH sensor on bioreactor",
    areaName: "Fermentation",
    areaCode: "FER-01",
    Responsible: "Alice Hansen",
    "SB Owner": "Martin; Emil",
    "SB Status": "In Progress",
    status: "In Progress",
    Priority: "High",
    "CE Comments": "Need verification certificate",
  },
  {
    id: 204,
    _uuid: "uuid-204",
    Issue: "Inspect steam trap valve",
    areaName: "Utilities",
    areaCode: "UTL-09",
    Responsible: "Bob Larsen",
    "SB Owner": "Søren",
    "SB Status": "Pending",
    status: "Pending",
    Priority: "Low",
    "Response or Action taken by SB": "Ordered replacement gasket",
  },
];

test("matchesQuickSearch matches task ID, Issue, area code/name, Responsible, and SB Owner", () => {
  assert.equal(matchesQuickSearch(SAMPLE_TASKS[0], "101"), true);
  assert.equal(matchesQuickSearch(SAMPLE_TASKS[0], "#101"), true);
  assert.equal(matchesQuickSearch(SAMPLE_TASKS[0], "bioreactor"), true);
  assert.equal(matchesQuickSearch(SAMPLE_TASKS[0], "fer-01"), true);
  assert.equal(matchesQuickSearch(SAMPLE_TASKS[0], "emil"), true);
  assert.equal(matchesQuickSearch(SAMPLE_TASKS[0], "steam trap"), false);
});

test("filterAndSortTasks filters by searchQuery when provided", () => {
  const result = filterAndSortTasks(SAMPLE_TASKS, {
    ...BASE_FILTERS,
    searchQuery: "gasket",
  });
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 204);
});

test("buildActiveFilterChips returns removable chips for active filters and removeFilterChip clears each one", () => {
  const active: TaskFilters = {
    ...BASE_FILTERS,
    searchQuery: "valve",
    sbStatus: "In Progress",
    priority: "High",
    sbOwners: ["Martin"],
    columnFilters: { issue: "sensor" },
    columnMultiFilters: { responsible: ["Alice Hansen", "Bob Larsen"] },
  };

  const chips = buildActiveFilterChips(active, "internal");
  assert.equal(chips.length, 6);
  assert.deepEqual(
    chips.map((c) => c.key),
    [
      "searchQuery",
      "sbStatus",
      "priority",
      "sbOwners:Martin",
      "columnFilter:issue",
      "columnMultiFilter:responsible",
    ]
  );

  const afterRemoveSearch = removeFilterChip(active, "searchQuery");
  assert.equal(afterRemoveSearch.searchQuery, "");

  const afterRemoveOwner = removeFilterChip(active, "sbOwners:Martin");
  assert.deepEqual(afterRemoveOwner.sbOwners, []);

  const afterRemoveMulti = removeFilterChip(
    active,
    "columnMultiFilter:responsible"
  );
  assert.deepEqual(afterRemoveMulti.columnMultiFilters.responsible, []);
});
