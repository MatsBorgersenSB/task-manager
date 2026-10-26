import assert from "node:assert/strict";
import test from "node:test";
import {
  GANTT_DATE_COLUMN_WIDTH,
  GANTT_DAYS_COLUMN_WIDTH,
  GANTT_NAME_COLUMN_WIDTH,
  formatGanttTableDate,
  ganttTaskDurationDays,
  resolveGanttScheduleEdit,
} from "../ganttTasks";

test("formatGanttTableDate returns compact short date without weekday", () => {
  const aug28 = new Date(2026, 7, 28, 12, 0, 0);
  const formatted = formatGanttTableDate(aug28);

  assert.equal(formatted, "28 Aug 26");
  assert.equal(formatted.includes("Fri"), false);
  assert.equal(formatted.includes("August"), false);
});

test("Gantt table column widths keep date and days columns compact", () => {
  const namePx = Number.parseInt(GANTT_NAME_COLUMN_WIDTH, 10);
  const datePx = Number.parseInt(GANTT_DATE_COLUMN_WIDTH, 10);
  const daysPx = Number.parseInt(GANTT_DAYS_COLUMN_WIDTH, 10);

  assert.equal(Number.isFinite(namePx) && namePx <= 240, true);
  assert.equal(Number.isFinite(datePx) && datePx <= 90, true);
  assert.equal(Number.isFinite(daysPx) && daysPx <= 60, true);
});

test("ganttTaskDurationDays computes calendar day span for Gantt rows", () => {
  const start = new Date(2026, 7, 28, 12, 0, 0);
  const nextDay = new Date(2026, 7, 29, 12, 0, 0);
  const eightDaysLater = new Date(2026, 8, 5, 12, 0, 0);

  assert.equal(ganttTaskDurationDays(start, nextDay), 1);
  assert.equal(ganttTaskDurationDays(start, eightDaysLater), 8);
  assert.equal(ganttTaskDurationDays(start, start, true), 0);
});

test("resolveGanttScheduleEdit updates start date, end date, or duration in days", () => {
  const start = new Date(2026, 7, 20, 12, 0, 0); // 2026-08-20
  const end = new Date(2026, 7, 25, 12, 0, 0); // 2026-08-25 (5 days)

  // Editing Days -> keeps From date and updates To date
  assert.deepEqual(
    resolveGanttScheduleEdit(start, end, { type: "days", days: 10 }),
    {
      startDate: "2026-08-20",
      endDate: "2026-08-30",
    }
  );

  // Editing From date before To date -> keeps To date
  assert.deepEqual(
    resolveGanttScheduleEdit(start, end, {
      type: "start",
      startDate: "2026-08-22",
    }),
    {
      startDate: "2026-08-22",
      endDate: "2026-08-25",
    }
  );

  // Editing From date after To date -> shifts To date preserving 5-day duration
  assert.deepEqual(
    resolveGanttScheduleEdit(start, end, {
      type: "start",
      startDate: "2026-08-28",
    }),
    {
      startDate: "2026-08-28",
      endDate: "2026-09-02",
    }
  );

  // Editing To date after From date -> keeps From date
  assert.deepEqual(
    resolveGanttScheduleEdit(start, end, {
      type: "end",
      endDate: "2026-08-29",
    }),
    {
      startDate: "2026-08-20",
      endDate: "2026-08-29",
    }
  );

  // Editing To date on/before From date -> adjusts From date to 1 day before To date
  assert.deepEqual(
    resolveGanttScheduleEdit(start, end, {
      type: "end",
      endDate: "2026-08-18",
    }),
    {
      startDate: "2026-08-17",
      endDate: "2026-08-18",
    }
  );

  // Invalid inputs return null
  assert.equal(
    resolveGanttScheduleEdit(start, end, { type: "days", days: 0 }),
    null
  );
  assert.equal(
    resolveGanttScheduleEdit(start, end, { type: "start", startDate: "" }),
    null
  );
});
