import assert from "node:assert/strict";
import test from "node:test";
import { SB_STATUS_OPTIONS } from "../constants";
import { buildBoardBuckets } from "../boardBuckets";
import { isStartedOrCompletedStatus } from "../dependencies";
import {
  HIDEABLE_CLIENT_PANEL_FIELDS,
  buildPanelFieldSections,
  isHideableClientPanelField,
  panelColumnsByGroup,
} from "../panelFields";
import { getTableColumns } from "../labels";

test("SB_STATUS_OPTIONS includes On Hold in workflow order", () => {
  assert.equal(SB_STATUS_OPTIONS.includes("On Hold" as never), true);
  assert.deepEqual([...SB_STATUS_OPTIONS], [
    "Not started",
    "In planning",
    "In execution",
    "On Hold",
    "Finished",
  ]);
});

test("buildBoardBuckets includes an On Hold bucket when grouped by sb_status", () => {
  const buckets = buildBoardBuckets([], "sb_status");
  const bucketIds = buckets.map((b) => b.id);
  assert.equal(bucketIds.includes("On Hold"), true);
});

test("isStartedOrCompletedStatus treats On Hold as non-started so blocked tasks can be placed On Hold", () => {
  assert.equal(isStartedOrCompletedStatus("On Hold"), false);
  assert.equal(isStartedOrCompletedStatus("on hold"), false);
  assert.equal(isStartedOrCompletedStatus("In execution"), true);
  assert.equal(isStartedOrCompletedStatus("Finished"), true);
});

test("buildPanelFieldSections hides client fields in internal mode when showClientFields is false", () => {
  const { client, internal } = panelColumnsByGroup("internal");
  const allColumns = [...client, ...internal];

  const withClient = buildPanelFieldSections("internal", allColumns, {
    showClientFields: true,
  });
  const withoutClient = buildPanelFieldSections("internal", allColumns, {
    showClientFields: false,
  });

  // Core task fields (Issue, Area) and Schedule extra fields remain visible
  assert.deepEqual(
    withoutClient.task.map((c) => c.fieldName),
    ["Issue", "Area"]
  );
  assert.deepEqual(
    withoutClient.scheduleExtra.map((c) => c.fieldName),
    ["Intervention Duration", "Date Completed"]
  );

  // When showClientFields is true, status includes client status/priority/responsible + SB fields
  assert.equal(
    withClient.status.some((c) => c.fieldName === "status"),
    true
  );
  assert.equal(
    withClient.notes.some((c) => c.fieldName === "CE Comments"),
    true
  );

  // When showClientFields is false, hideable client fields are omitted and SB fields remain
  for (const col of [
    ...withoutClient.status,
    ...withoutClient.notes,
    ...withoutClient.other,
  ]) {
    assert.equal(
      HIDEABLE_CLIENT_PANEL_FIELDS.has(col.fieldName ?? ""),
      false,
      `Expected client field ${col.fieldName} to be hidden`
    );
  }

  assert.deepEqual(
    withoutClient.status.map((c) => c.fieldName),
    ["SB Status", "SB Priority", "SB Owner"]
  );
  assert.deepEqual(
    withoutClient.notes.map((c) => c.fieldName),
    ["Response or Action taken by SB", "Risk", "Risk Comment", "SB Note"]
  );
});

test("isHideableClientPanelField only marks client-specific panel fields, never Action Comment, Area, or Schedule fields", () => {
  assert.equal(isHideableClientPanelField("status"), true);
  assert.equal(isHideableClientPanelField("Priority"), true);
  assert.equal(isHideableClientPanelField("Responsible"), true);
  assert.equal(isHideableClientPanelField("CE Comments"), true);
  assert.equal(
    isHideableClientPanelField("Response or Action taken by SB"),
    false
  );

  assert.equal(isHideableClientPanelField("Area"), false);
  assert.equal(isHideableClientPanelField("Issue"), false);
  assert.equal(isHideableClientPanelField("Intervention Duration"), false);
  assert.equal(isHideableClientPanelField("Date Completed"), false);
  assert.equal(isHideableClientPanelField("SB Status"), false);
});

test("getTableColumns includes Action Comment by default in internal mode", () => {
  const defaultInternalCols = getTableColumns("internal");
  assert.equal(
    defaultInternalCols.some(
      (col) => col.fieldName === "Response or Action taken by SB"
    ),
    true
  );
});
