"use client";

import {
  applyScheduleFieldChange,
  inclusiveScheduleDays,
  type ScheduleFieldKey,
} from "@/lib/tasks/scheduleDates";
import { ui } from "@/lib/ui/classes";

type TaskScheduleFieldsProps = {
  fromDate: string;
  toDate: string;
  readOnly?: boolean;
  onChange: (next: { fromDate: string; toDate: string }) => void;
};

export default function TaskScheduleFields({
  fromDate,
  toDate,
  readOnly = false,
  onChange,
}: TaskScheduleFieldsProps) {
  const days = inclusiveScheduleDays(fromDate, toDate);

  function commit(field: ScheduleFieldKey, value: string) {
    const next = applyScheduleFieldChange(
      { fromDate, toDate, days },
      field,
      value
    );
    onChange({ fromDate: next.fromDate, toDate: next.toDate });
  }

  return (
    <div className="space-y-3 rounded-md border border-border/70 bg-slate-50/80 p-3">
      <div>
        <p className="text-sm font-semibold text-primary">Schedule</p>
        <p className="mt-0.5 text-xs text-muted">
          Enter any two of From, To, or Days — the third fills in automatically.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <label className={ui.label}>
          From
          <input
            type="date"
            value={fromDate}
            onChange={(event) => commit("fromDate", event.target.value)}
            className={ui.input}
            disabled={readOnly}
          />
        </label>
        <label className={ui.label}>
          To
          <input
            type="date"
            value={toDate}
            onChange={(event) => commit("toDate", event.target.value)}
            className={ui.input}
            disabled={readOnly}
          />
        </label>
        <label className={ui.label}>
          Days
          <input
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            placeholder="e.g. 9"
            value={days ?? ""}
            onChange={(event) => commit("days", event.target.value)}
            className={ui.input}
            disabled={readOnly}
            aria-label="Number of calendar days"
          />
        </label>
      </div>
    </div>
  );
}
